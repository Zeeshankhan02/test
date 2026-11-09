import { fail } from "../../common/errors/app-error.js";
import { Quiz, QuizAttempt, User } from "../models.js";
import { requireQuizEventRegistration } from "../quizzes/quizzes.service.js";

export async function listLeaderboard(
  quizId: string,
  userId: string,
  role: "student" | "admin",
) {
  const quiz = await Quiz.findById(quizId).select("eventId resultsPublishedAt").lean();
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
  // Feature 3: the leaderboard is result data. Students cannot see it until
  // an administrator has explicitly published this quiz's results; the
  // check runs at the trusted data-access layer on every request, so a
  // cached client, refresh, or direct URL cannot bypass it.
  if (role !== "admin" && !quiz.resultsPublishedAt)
    return fail(
      403,
      "RESULTS_NOT_PUBLISHED",
      "Results have not been published for this quiz yet",
    );
  if (role === "student")
    await requireQuizEventRegistration(
      quiz.eventId ? String(quiz.eventId) : "",
      userId,
    );
  const rows = await QuizAttempt.find({
    quizId,
    submittedAt: { $exists: true },
  })
    .sort({ score: -1, submittedAt: 1 })
    .limit(100)
    .populate("userId", "name avatar")
    .lean();
  return rows.map((row, index) => {
    const profile = row.userId as unknown as { name: string; avatar?: string } | null;
    return {
      rank: index + 1,
      userName: profile?.name ?? "Deleted participant",
      avatar: profile?.avatar ?? "",
      score: row.score,
      submittedAt: row.submittedAt,
    };
  });
}

export async function listCompetitionLeaderboards(
  quizId: string,
  userId: string,
  role: "student" | "admin",
) {
  const quiz = await Quiz.findById(quizId).select(
    "title eventId resultsPublishedAt round2Rankings round2PublishedAt round3Rankings round3PublishedAt winnerUserId winnerConfirmedAt",
  ).lean();
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
  if (role === "student")
    await requireQuizEventRegistration(String(quiz.eventId ?? ""), userId);

  const attempts = quiz.resultsPublishedAt
    ? await QuizAttempt.find({ quizId, submittedAt: { $exists: true } })
        .sort({ score: -1, submittedAt: 1, _id: 1 })
        .select("userId score submittedAt")
        .lean()
    : [];
  const users = await User.find({
    _id: {
      $in: [
        ...attempts.map((row) => row.userId),
        ...(quiz.round2Rankings as { userId: string }[]).map((row) => row.userId),
        ...(quiz.round3Rankings as { userId: string }[]).map((row) => row.userId),
        ...(quiz.winnerUserId ? [quiz.winnerUserId] : []),
      ],
    },
  }).select("name avatar").lean();
  const profiles = new Map(users.map((user) => [String(user._id), user]));
  const round1 = attempts.map((attempt, index) => ({
    rank: index + 1,
    userId: String(attempt.userId),
    userName: profiles.get(String(attempt.userId))?.name ?? "Deleted participant",
    avatar: profiles.get(String(attempt.userId))?.avatar ?? "",
    score: attempt.score ?? 0,
    submittedAt: attempt.submittedAt,
  }));
  const round2 = (quiz.round2PublishedAt ? quiz.round2Rankings : []).map((row) => ({
    ...row,
    userName: profiles.get(String(row.userId))?.name ?? "Deleted participant",
    avatar: profiles.get(String(row.userId))?.avatar ?? "",
    score: row.score ?? null,
  })).sort((a, b) => a.rank - b.rank || String(a.userId).localeCompare(String(b.userId)));
  const final = (quiz.round3PublishedAt ? quiz.round3Rankings : []).map((row) => ({
    ...row,
    userName: profiles.get(String(row.userId))?.name ?? "Deleted participant",
    avatar: profiles.get(String(row.userId))?.avatar ?? "",
    score: row.score ?? null,
  })).sort((a, b) => a.rank - b.rank || String(a.userId).localeCompare(String(b.userId)));
  const winner = quiz.winnerConfirmedAt && quiz.winnerUserId
    ? {
        userId: String(quiz.winnerUserId),
        userName: profiles.get(String(quiz.winnerUserId))?.name ?? "Deleted participant",
        confirmedAt: quiz.winnerConfirmedAt,
      }
    : null;

  return {
    quiz: { id: String(quiz._id), title: quiz.title },
    round1: { published: Boolean(quiz.resultsPublishedAt), publishedAt: quiz.resultsPublishedAt ?? null, rankings: round1 },
    round2: { published: Boolean(quiz.round2PublishedAt), publishedAt: quiz.round2PublishedAt ?? null, rankings: round2 },
    final: { published: Boolean(quiz.round3PublishedAt), publishedAt: quiz.round3PublishedAt ?? null, rankings: final, winner },
  };
}
