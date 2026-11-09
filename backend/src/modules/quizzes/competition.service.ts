import { Types } from "mongoose";
import { fail } from "../../common/errors/app-error.js";
import { recordAudit } from "../../common/utils/audit.js";
import { announceEventToRegistrants } from "../notifications/notifications.service.js";
import { Certificate, Quiz, QuizAttempt, Registration, User } from "../models.js";

type RankInput = { userId: string; rank: number; score?: number | undefined; notes?: string | undefined };
type Candidate = { userId: string; rank: number; score: number; submittedAt: Date };

export async function prepareQualification(adminId: string, quizId: string) {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
  if (quiz.status !== "closed" || !quiz.resultsPublishedAt)
    return fail(409, "ROUND1_NOT_FINAL", "Publish finalized Round 1 results first");
  if (await QuizAttempt.exists({ quizId, submittedAt: { $exists: false } }))
    return fail(409, "ATTEMPTS_PENDING", "Every started Round 1 attempt must be finalized");
  const eligibleIds = await Registration.distinct("userId", {
    eventId: quiz.eventId,
    status: "confirmed",
  });
  const attempts = await QuizAttempt.find({
    quizId,
    submittedAt: { $exists: true },
    userId: { $in: eligibleIds },
  }).sort({ score: -1, submittedAt: 1, _id: 1 }).select("userId score submittedAt").lean();
  const candidates: Candidate[] = attempts.slice(0, 10).map((attempt, index) => ({
    userId: String(attempt.userId),
    rank: index + 1,
    score: attempt.score ?? 0,
    submittedAt: attempt.submittedAt!,
  }));
  const cutoffScore = candidates[9]?.score;
  if (cutoffScore !== undefined) {
    for (const attempt of attempts.slice(10)) {
      if ((attempt.score ?? 0) !== cutoffScore) break;
      candidates.push({ userId: String(attempt.userId), rank: 10, score: attempt.score ?? 0, submittedAt: attempt.submittedAt! });
    }
  }
  const prepared = await Quiz.findOneAndUpdate(
    { _id: quizId, status: "closed", resultsPublishedAt: { $exists: true }, qualificationPublishedAt: { $exists: false } },
    { $set: { qualificationCandidates: candidates } },
    { new: true },
  );
  if (!prepared) return fail(409, "QUALIFICATION_PUBLISHED", "Qualification changed while being prepared");
  await recordAudit(adminId, "quiz.qualification.prepared", "quiz", quizId, { candidates: candidates.length });
  return decorateCandidates(candidates);
}

export async function publishQualification(adminId: string, quizId: string, userIds: string[], reason?: string) {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
  if (!quiz.resultsPublishedAt || quiz.status !== "closed") return fail(409, "ROUND1_NOT_FINAL", "Publish finalized Round 1 results first");
  if (quiz.qualificationPublishedAt) return fail(409, "QUALIFICATION_PUBLISHED", "Published qualification is immutable");
  const candidates = quiz.qualificationCandidates as Candidate[];
  const uniqueIds = [...new Set(userIds)];
  if (!candidates.length || !uniqueIds.length || uniqueIds.length > candidates.length || uniqueIds.some((id) => !Types.ObjectId.isValid(id)))
    return fail(400, "INVALID_QUALIFIERS", "Select valid participants from the qualification candidates");
  if (uniqueIds.some((id) => !candidates.some((row) => row.userId === id)))
    return fail(400, "INVALID_QUALIFIERS", "Only Round 1 qualification candidates may advance");
  const defaultIds = candidates.filter((row) => row.rank <= 10).map((row) => row.userId);
  const changed = defaultIds.length !== uniqueIds.length || defaultIds.some((id) => !uniqueIds.includes(id));
  if (changed && !reason?.trim()) return fail(400, "OVERRIDE_REASON_REQUIRED", "Explain the qualification list change");
  const confirmed = uniqueIds.map((id) => candidates.find((row) => row.userId === id)!);
  const saved = await Quiz.findOneAndUpdate(
    { _id: quizId, resultsPublishedAt: { $exists: true }, qualificationPublishedAt: { $exists: false } },
    { $set: { qualifiedParticipants: confirmed, qualificationPublishedAt: new Date() } },
    { new: true },
  );
  if (!saved) return fail(409, "QUALIFICATION_PUBLISHED", "Qualification was published by another administrator");
  const delivery = await announceEventToRegistrants(
    String(quiz.eventId),
    `Quiz qualification announced: ${quiz.title}`,
    `${confirmed.length} participant${confirmed.length === 1 ? " has" : "s have"} qualified for Round 2 of ${quiz.title}. View the quiz page for your status.`,
  );
  await recordAudit(adminId, "quiz.qualification.published", "quiz", quizId, {
    qualified: confirmed.length,
    overrideReason: changed ? reason!.trim() : "",
    delivered: delivery.delivered,
    emailSent: delivery.email.sent,
    emailFailed: delivery.email.failed,
  });
  return { ...delivery, participants: await decorateCandidates(confirmed) };
}

export async function correctQualification(adminId: string, quizId: string, userIds: string[], reason: string) {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
  if (!quiz.qualificationPublishedAt) return fail(409, "QUALIFICATION_NOT_PUBLISHED", "Publish the qualification before correcting it");
  if (quiz.round2PublishedAt) return fail(409, "ROUND2_ALREADY_PUBLISHED", "Qualification cannot change after Round 2 publication");
  const candidates = quiz.qualificationCandidates as Candidate[];
  const ids = [...new Set(userIds)];
  if (!ids.length || ids.length !== userIds.length || ids.some((id) => !candidates.some((row) => row.userId === id)))
    return fail(400, "INVALID_QUALIFIERS", "Select unique participants from the persisted Round 1 candidates");
  const corrected = ids.map((id) => candidates.find((row) => row.userId === id)!);
  const updated = await Quiz.findOneAndUpdate(
    { _id: quizId, qualificationPublishedAt: { $exists: true }, round2PublishedAt: { $exists: false } },
    { $set: { qualifiedParticipants: corrected, round2Rankings: [] } },
    { new: true },
  );
  if (!updated) return fail(409, "QUALIFICATION_CONFLICT", "Competition advanced while correcting qualification");
  await recordAudit(adminId, "quiz.qualification.corrected", "quiz", quizId, { reason, previousUserIds: JSON.stringify((quiz.qualifiedParticipants as Candidate[]).map((row) => row.userId)), userIds: JSON.stringify(ids) });
  return decorateCandidates(corrected);
}

export async function saveRoundRankings(adminId: string, quizId: string, round: 2 | 3, rows: RankInput[], advancementLimit = 3) {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
  const publishedAt = round === 2 ? quiz.round2PublishedAt : quiz.round3PublishedAt;
  if (publishedAt) return fail(409, "ROUND_PUBLISHED", "Published rankings are immutable");
  if (round === 2 && !quiz.qualificationPublishedAt) return fail(409, "QUALIFICATION_REQUIRED", "Publish Round 1 qualification first");
  if (round === 3 && !quiz.round2PublishedAt) return fail(409, "ROUND2_REQUIRED", "Publish Round 2 rankings first");
  const allowed = round === 2
    ? (quiz.qualifiedParticipants as Candidate[]).map((row) => row.userId)
    : ((quiz.round2Rankings as RankInput[]).filter((row) => row.rank <= (quiz.round3AdvancementLimit ?? 3)).map((row) => row.userId));
  if (round === 3 && (!Number.isInteger(advancementLimit) || advancementLimit < 1 || advancementLimit > 10))
    return fail(400, "INVALID_ADVANCEMENT_LIMIT", "Advancement limit must be between 1 and 10");
  const permitted = round === 3
    ? ((quiz.round2Rankings as RankInput[]).filter((row) => row.rank <= advancementLimit).map((row) => row.userId))
    : allowed;
  if (!rows.length || rows.length > permitted.length || rows.some((row) => !permitted.includes(row.userId)))
    return fail(400, "INVALID_RANKING_PARTICIPANTS", "Select only eligible participants");
  const ids = rows.map((row) => row.userId);
  const ranks = rows.map((row) => row.rank);
  if (new Set(ids).size !== ids.length || new Set(ranks).size !== ranks.length || rows.some((row) => !Types.ObjectId.isValid(row.userId) || !Number.isInteger(row.rank) || row.rank < 1 || (row.score !== undefined && (!Number.isFinite(row.score) || row.score < 0))))
    return fail(400, "INVALID_RANKINGS", "Participant and rank values must be unique and valid");
  if (ranks.some((rank) => rank > permitted.length))
    return fail(400, "INVALID_RANKINGS", "Rank values cannot exceed the eligible participant count");
  const updates = round === 2
    ? { round2Rankings: rows, round3AdvancementLimit: advancementLimit }
    : { round3Rankings: rows };
  const saved = await Quiz.updateOne({
    _id: quizId,
    ...(round === 2
      ? { qualificationPublishedAt: { $exists: true }, round2PublishedAt: { $exists: false } }
      : { round2PublishedAt: { $exists: true }, round3PublishedAt: { $exists: false } }),
  }, { $set: updates });
  if (!saved.matchedCount) return fail(409, "ROUND_PUBLISHED", "Round state changed while saving the draft");
  await recordAudit(adminId, `quiz.round${round}.draft.saved`, "quiz", quizId, { participants: rows.length });
  return rows;
}

export async function publishRoundRankings(adminId: string, quizId: string, round: 2 | 3) {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
  if (round === 2 && !quiz.qualificationPublishedAt) return fail(409, "QUALIFICATION_REQUIRED", "Publish Round 1 qualification first");
  if (round === 3 && !quiz.round2PublishedAt) return fail(409, "ROUND2_REQUIRED", "Publish Round 2 rankings first");
  const rows = (round === 2 ? quiz.round2Rankings : quiz.round3Rankings) as RankInput[];
  const eligibleIds = round === 2
    ? (quiz.qualifiedParticipants as Candidate[]).map((row) => row.userId)
    : (quiz.round2Rankings as RankInput[]).filter((row) => row.rank <= (quiz.round3AdvancementLimit ?? 3)).map((row) => row.userId);
  const ids = rows.map((row) => row.userId);
  const ranks = rows.map((row) => row.rank);
  if (!eligibleIds.length || rows.length !== eligibleIds.length || new Set(ids).size !== ids.length || eligibleIds.some((id) => !ids.includes(id)) || new Set(ranks).size !== ranks.length || ranks.some((rank) => !Number.isInteger(rank) || rank < 1 || rank > rows.length))
    return fail(409, "RANKINGS_INCOMPLETE", `Round ${round} has ${rows.length} valid saved rankings for ${eligibleIds.length} eligible participants. Save a complete ranking with unique participants and ranks before publishing.`);
  const field = round === 2 ? "round2PublishedAt" : "round3PublishedAt";
  const updated = await Quiz.findOneAndUpdate({ _id: quizId, [field]: { $exists: false } }, { $set: { [field]: new Date() } }, { new: true });
  if (!updated) return fail(409, "ROUND_PUBLISHED", "Rankings are already published");
  const delivery = await announceEventToRegistrants(
    String(quiz.eventId),
    `Round ${round} results: ${quiz.title}`,
    `Round ${round} rankings for ${quiz.title} have been published. Sign in to view the leaderboard and your result.`,
  );
  await recordAudit(adminId, `quiz.round${round}.published`, "quiz", quizId, {
    participants: rows.length,
    delivered: delivery.delivered,
    emailSent: delivery.email.sent,
    emailFailed: delivery.email.failed,
  });
  return { publishedAt: updated.get(field), rankings: rows, ...delivery };
}

export async function correctPublishedRankings(adminId: string, quizId: string, round: 2 | 3, rows: RankInput[], reason: string) {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
  const current = (round === 2 ? quiz.round2Rankings : quiz.round3Rankings) as RankInput[];
  if (!(round === 2 ? quiz.round2PublishedAt : quiz.round3PublishedAt)) return fail(409, "ROUND_NOT_PUBLISHED", "Publish rankings before submitting a correction");
  if (round === 2 && quiz.round3PublishedAt) return fail(409, "ROUND3_ALREADY_PUBLISHED", "Round 2 cannot change after Round 3 publication");
  if (round === 3 && quiz.winnerConfirmedAt) return fail(409, "WINNER_CONFIRMED", "Final rankings cannot change after winner confirmation");
  const allowed = round === 2
    ? (quiz.qualifiedParticipants as Candidate[]).map((row) => row.userId)
    : (quiz.round2Rankings as RankInput[]).filter((row) => row.rank <= (quiz.round3AdvancementLimit ?? 3)).map((row) => row.userId);
  if (rows.length !== allowed.length || rows.some((row) => !allowed.includes(row.userId)))
    return fail(400, "INVALID_RANKING_PARTICIPANTS", "Include every eligible participant exactly once");
  const ids = rows.map((row) => row.userId);
  const ranks = rows.map((row) => row.rank);
  if (new Set(ids).size !== ids.length || new Set(ranks).size !== ranks.length || ranks.some((rank) => rank < 1 || rank > rows.length) || rows.some((row) => row.score !== undefined && (row.score < 0 || !Number.isFinite(row.score))))
    return fail(400, "INVALID_RANKINGS", "Participant and rank values must be unique and valid");
  const field = round === 2 ? "round2Rankings" : "round3Rankings";
  const updated = await Quiz.findOneAndUpdate(
    { _id: quizId, [round === 2 ? "round2PublishedAt" : "round3PublishedAt"]: { $exists: true }, ...(round === 2 ? { round3PublishedAt: { $exists: false } } : { winnerConfirmedAt: { $exists: false } }) },
    { $set: { [field]: rows, ...(round === 2 ? { round3Rankings: [] } : {}) } },
    { new: true },
  );
  if (!updated) return fail(409, "ROUND_CORRECTION_CONFLICT", "Competition advanced while saving the correction");
  if (round === 3)
    await Certificate.updateMany(
      { competitionId: quizId, awardType: "winner", staleAt: { $exists: false } },
      { $set: { staleAt: new Date(), revokedAt: new Date() } },
    );
  await recordAudit(adminId, `quiz.round${round}.corrected`, "quiz", quizId, { reason, previous: JSON.stringify(current), corrected: JSON.stringify(rows) });
  return rows;
}

export async function confirmCompetitionWinner(adminId: string, quizId: string) {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
  if (!quiz.round3PublishedAt) return fail(409, "ROUND3_REQUIRED", "Publish Round 3 before confirming the winner");
  const first = (quiz.round3Rankings as RankInput[]).filter((row) => row.rank === 1);
  if (first.length !== 1) return fail(409, "WINNER_AMBIGUOUS", "Round 3 must have one first-ranked participant");
  const winnerId = String(first[0]!.userId);
  const winner = await User.findById(winnerId).select("name").lean();
  const title = `Quiz winner announced: ${quiz.title}`;
  const message = `${winner?.name ?? "The top-ranked participant"} has been confirmed as the winner of ${quiz.title}. View the published final leaderboard for the results.`;
  if (quiz.winnerConfirmedAt) {
    const { email } = await announceEventToRegistrants(
      String(quiz.eventId),
      title,
      message,
      false,
    );
    return {
      userId: String(quiz.winnerUserId),
      confirmedAt: quiz.winnerConfirmedAt,
      alreadyConfirmed: true,
      delivered: 0,
      email,
    };
  }
  const updated = await Quiz.findOneAndUpdate({ _id: quizId, round3PublishedAt: { $exists: true }, winnerConfirmedAt: { $exists: false } }, { $set: { winnerUserId: first[0]!.userId, winnerConfirmedAt: new Date() } }, { new: true });
  if (!updated) return fail(409, "WINNER_CONFIRMED", "Winner was confirmed by another administrator");
  const delivery = await announceEventToRegistrants(
    String(quiz.eventId),
    title,
    message,
  );
  await recordAudit(adminId, "quiz.winner.confirmed", "quiz", quizId, {
    userId: winnerId,
    delivered: delivery.delivered,
    emailSent: delivery.email.sent,
    emailFailed: delivery.email.failed,
  });
  return {
    userId: winnerId,
    confirmedAt: updated.winnerConfirmedAt,
    alreadyConfirmed: false,
    ...delivery,
  };
}

export async function getCompetition(quizId: string, userId: string, isAdmin: boolean) {
  const quiz = await Quiz.findById(quizId).select("title eventId status resultsPublishedAt qualificationCandidates qualifiedParticipants qualificationPublishedAt round2Rankings round2PublishedAt round3AdvancementLimit round3Rankings round3PublishedAt winnerUserId winnerConfirmedAt").lean();
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
  if (!isAdmin) {
    const attempt = await QuizAttempt.findOne({ quizId, userId }).select("score submittedAt").lean();
    if (!attempt && !(await Registration.exists({ eventId: quiz.eventId, userId, status: "confirmed" }))) return fail(403, "QUIZ_ACCESS_DENIED", "Register for the quiz event to view competition progress");
    const qualifies = quiz.qualificationPublishedAt ? (quiz.qualifiedParticipants as Candidate[]).some((row) => row.userId === userId) : null;
    const round2Row = quiz.round2PublishedAt ? (quiz.round2Rankings as RankInput[]).find((row) => row.userId === userId) : null;
    const round3Row = quiz.round3PublishedAt ? (quiz.round3Rankings as RankInput[]).find((row) => row.userId === userId) : null;
    const round2 = round2Row ? { rank: round2Row.rank, score: round2Row.score ?? null } : null;
    const round3 = round3Row ? { rank: round3Row.rank, score: round3Row.score ?? null } : null;
    const isWinner = Boolean(quiz.winnerConfirmedAt && String(quiz.winnerUserId) === userId);
    const certificate = isWinner ? await Certificate.findOne({ competitionId: quizId, userId }).select("_id certificateId").lean() : null;
    let round1Rank: number | null = null;
    if (quiz.resultsPublishedAt && attempt?.submittedAt) {
      round1Rank = (await QuizAttempt.countDocuments({ quizId, submittedAt: { $exists: true }, $or: [
        { score: { $gt: attempt.score ?? 0 } },
        { score: attempt.score ?? 0, submittedAt: { $lt: attempt.submittedAt } },
      ] })) + 1;
    }
    return { title: quiz.title, round1Started: Boolean(attempt), round1Submitted: Boolean(attempt?.submittedAt), round1Published: Boolean(quiz.resultsPublishedAt), round1Score: quiz.resultsPublishedAt ? attempt?.score ?? null : null, round1Rank, qualified: qualifies, round2, round3, isWinner, winnerCertificate: certificate ? { id: String(certificate._id), certificateId: certificate.certificateId } : null };
  }
  const ids = [...new Set([
    ...(quiz.qualificationCandidates as Candidate[]).map((row) => row.userId),
    ...(quiz.qualifiedParticipants as Candidate[]).map((row) => row.userId),
    ...(quiz.round2Rankings as RankInput[]).map((row) => row.userId),
    ...(quiz.round3Rankings as RankInput[]).map((row) => row.userId),
  ])];
  const users = await User.find({ _id: { $in: ids } }).select("name email").lean();
  const names = new Map(users.map((row) => [String(row._id), { name: row.name, email: row.email }]));
  const decorate = (rows: (Candidate | RankInput)[]) => rows.map((row) => ({ ...row, participant: names.get(row.userId) ?? null }));
  const winnerCertificate = await Certificate.findOne({ competitionId: quizId }).select("_id userId certificateId").lean();
  return { ...quiz, winnerCertificate: winnerCertificate ? { id: String(winnerCertificate._id), userId: String(winnerCertificate.userId), certificateId: winnerCertificate.certificateId } : null, qualificationCandidates: decorate(quiz.qualificationCandidates as Candidate[]), qualifiedParticipants: decorate(quiz.qualifiedParticipants as Candidate[]), round2Rankings: decorate(quiz.round2Rankings as RankInput[]), round3Rankings: decorate(quiz.round3Rankings as RankInput[]) };
}

async function decorateCandidates(rows: Candidate[]) {
  const users = await User.find({ _id: { $in: rows.map((row) => row.userId) } }).select("name email").lean();
  const names = new Map(users.map((row) => [String(row._id), { name: row.name, email: row.email }]));
  return rows.map((row) => ({ ...row, participant: names.get(row.userId) ?? null }));
}
