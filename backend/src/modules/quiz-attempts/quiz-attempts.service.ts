import { fail } from "../../common/errors/app-error.js";
import { recordAudit } from "../../common/utils/audit.js";
import { Quiz, QuizAttempt } from "../models.js";
import { requireQuizEventRegistration } from "../quizzes/quizzes.service.js";

/**
 * Feature 5/6 helpers. The browser countdown is only a display mechanism:
 * every answer write goes through atomic, conditional MongoDB updates that
 * re-check the authoritative deadline (`questionDeadlines[i]`) and the
 * terminal flag (`finalizedAt[i]`) inside the same statement. A refresh,
 * a stale tab, a duplicate retry, or a second tab can therefore never
 * overwrite a finalized answer — repeated requests simply return the
 * persisted final state.
 */

type AttemptRow = {
  answers?: (number | null)[];
  finalizedAt?: (Date | string | null)[];
  submittedAt?: Date | string | null;
};

function iso(value?: Date | string | null) {
  return value ? new Date(value).toISOString() : null;
}

/** Idempotently arm an attempt with server-issued per-question deadlines. */
async function ensureTiming(
  attemptId: string,
  userId: string,
  durationSeconds: number,
  total: number,
) {
  const now = new Date();
  await QuizAttempt.updateOne(
    {
      _id: attemptId,
      userId,
      submittedAt: { $exists: false },
      questionDeadlines: { $size: 0 },
    },
    [
      {
        $set: {
          answers: {
            $cond: [
              { $lt: [{ $size: { $ifNull: ["$answers", []] } }, total] },
              {
                $concatArrays: [
                  { $ifNull: ["$answers", []] },
                  {
                    $map: {
                      input: {
                        $range: [{ $size: { $ifNull: ["$answers", []] } }, total, 1],
                      },
                      as: "i",
                      in: -1,
                    },
                  },
                ],
              },
              { $ifNull: ["$answers", []] },
            ],
          },
          finalizedAt: {
            $cond: [
              { $lt: [{ $size: { $ifNull: ["$finalizedAt", []] } }, total] },
              {
                $concatArrays: [
                  { $ifNull: ["$finalizedAt", []] },
                  {
                    $map: {
                      input: {
                        $range: [
                          { $size: { $ifNull: ["$finalizedAt", []] } },
                          total,
                          1,
                        ],
                      },
                      as: "i",
                      in: null,
                    },
                  },
                ],
              },
              { $ifNull: ["$finalizedAt", []] },
            ],
          },
          overallDeadline: {
            $ifNull: [
              "$overallDeadline",
              {
                $dateAdd: {
                  startDate: "$$NOW",
                  unit: "second",
                  amount: durationSeconds * total,
                },
              },
            ],
          },
          questionDeadlines: Array.from(
            { length: total },
            (_, index) =>
              new Date(now.getTime() + (index + 1) * durationSeconds * 1000),
          ),
        },
      },
    ],
  );
}

export async function beginAttempt(quizId: string, userId: string) {
  const quiz = await Quiz.findOne({ _id: quizId }).lean();
  if (!quiz || quiz.status === "draft") return fail(404, "NOT_FOUND", "Quiz not found");
  await requireQuizEventRegistration(quiz.eventId ? String(quiz.eventId) : "", userId);
  const attempt = await QuizAttempt.findOneAndUpdate(
    { quizId, userId },
    { $setOnInsert: { quizId, userId, startedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  if (attempt.submittedAt)
    fail(409, "ALREADY_SUBMITTED", "This quiz attempt was already submitted");
  // An ended event (scheduled end or admin termination) is authoritative:
  // resuming must finalize, never reopen, the attempt.
  if (quiz.status !== "published" || (quiz.endsAt && quiz.endsAt <= new Date())) {
    const finalized = await finalizeAttempt(String(attempt._id), userId);
    return {
      ...finalized,
      resumed: false,
      endedByAdmin: Boolean(attempt.endedByAdminAt),
    };
  }
  const total = quiz.questions.length;
  await ensureTiming(String(attempt._id), userId, quiz.durationSeconds, total);
  const fresh = await QuizAttempt.findById(attempt._id)
    .select("overallDeadline questionDeadlines answers finalizedAt")
    .lean();
  return {
    attemptId: String(attempt._id),
    quiz: {
      id: quizId,
      eventId: String(quiz.eventId),
      title: quiz.title,
      durationSeconds: quiz.durationSeconds,
      questions: quiz.questions.map((question, index) => ({
        id: String(index),
        text: question.text,
        options: question.options,
      })),
    },
    serverTime: new Date().toISOString(),
    overallDeadline: iso(fresh?.overallDeadline),
    questionDeadlines: (fresh?.questionDeadlines ?? []).map(iso),
    answers: fresh?.answers ?? [],
    finalizedAt: (fresh?.finalizedAt ?? []).map(iso),
  };
}

/**
 * Idempotent per-question answer persistence. The client may call this for
 * the current question on every change, on timeout, and again before
 * navigating to the next question; whichever request satisfies the
 * authoritative deadline first wins and later calls receive the persisted
 * final state unchanged. `answer: null` finalizes the question as skipped.
 */
export async function saveQuestionAnswer(
  attemptId: string,
  userId: string,
  index: number,
  answer: number | null,
) {
  const attempt = await QuizAttempt.findOne({ _id: attemptId, userId });
  if (!attempt) return fail(404, "NOT_FOUND", "Quiz attempt not found");
  const quiz = await Quiz.findById(attempt.quizId).select("questions").lean();
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
  const total = quiz.questions.length;
  if (!Number.isInteger(index) || index < 0 || index >= total)
    return fail(400, "INVALID_QUESTION", "Unknown question index");
  if (attempt.submittedAt)
    return finalizedResponse(attempt, index, "already_submitted");
  if (attempt.finalizedAt?.[index])
    return finalizedResponse(attempt, index, "already_finalized");
  const validAnswer =
    typeof answer === "number" &&
    Number.isInteger(answer) &&
    answer >= 0 &&
    answer < quiz.questions[index]!.options.length;
  const outcome = validAnswer ? "answered" : "skipped";
  const now = new Date();
  const deadline = attempt.questionDeadlines?.[index];
  if (deadline && now > new Date(deadline)) {
    // Past the authoritative deadline: lock it, do not accept the value.
    await QuizAttempt.updateOne(
      {
        _id: attemptId,
        userId,
        submittedAt: { $exists: false },
        [`finalizedAt.${index}`]: null,
      },
      { $set: { [`finalizedAt.${index}`]: now } },
    );
    const locked = await QuizAttempt.findById(attemptId).select("answers").lean();
    return {
      index,
      accepted: false,
      status: (locked?.answers?.[index] ?? -1) >= 0 ? "answered" : "skipped",
      locked: true,
      reason: "expired",
    };
  }
  const updated = await QuizAttempt.updateOne(
    {
      _id: attemptId,
      userId,
      submittedAt: { $exists: false },
      [`finalizedAt.${index}`]: null,
      ...(deadline ? { [`questionDeadlines.${index}`]: { $gte: now } } : {}),
    },
    {
      $set: {
        [`answers.${index}`]: validAnswer ? answer : -1,
        [`finalizedAt.${index}`]: now,
      },
    },
  );
  if (updated.modifiedCount === 0) {
    // Lost a race with another tab, a retry, or the admin termination —
    // return the persisted final state instead of overwriting it.
    const current = await QuizAttempt.findById(attemptId).lean();
    if (current?.finalizedAt?.[index])
      return finalizedResponse(current, index, "already_finalized");
    if (current?.submittedAt)
      return finalizedResponse(current, index, "already_submitted");
    return fail(409, "ATTEMPT_LOCKED", "This quiz attempt is no longer editable");
  }
  return { index, accepted: true, status: outcome, locked: true };
}

function finalizedResponse(attempt: AttemptRow, index: number, reason: string) {
  return {
    index,
    accepted: false,
    status: (attempt.answers?.[index] ?? -1) >= 0 ? "answered" : "skipped",
    locked: true,
    finalizedAt: iso(attempt.finalizedAt?.[index] ?? attempt.submittedAt ?? null),
    reason,
  };
}

/** Snapshot used by the student player after a refresh or reconnect. */
export async function getAttemptState(attemptId: string, userId: string) {
  const attempt = await QuizAttempt.findOne({ _id: attemptId, userId })
    .populate("quizId", "title durationSeconds questions")
    .lean();
  if (!attempt) return fail(404, "NOT_FOUND", "Quiz attempt not found");
  const quiz = attempt.quizId as unknown as {
    title: string;
    durationSeconds: number;
    questions: { text: string; options: string[] }[];
  };
  return {
    attemptId,
    status: attempt.submittedAt ? ("completed" as const) : ("in_progress" as const),
    endedByAdmin: Boolean(attempt.endedByAdminAt),
    serverTime: new Date().toISOString(),
    overallDeadline: iso(attempt.overallDeadline ?? null),
    questionDeadlines: (attempt.questionDeadlines ?? []).map(iso),
    answers: attempt.answers ?? [],
    finalizedAt: (attempt.finalizedAt ?? []).map(iso),
    submittedAt: iso(attempt.submittedAt ?? null),
    scoreRevealed: false,
    quiz: {
      title: quiz.title,
      durationSeconds: quiz.durationSeconds,
      questions: quiz.questions.map((question, index) => ({
        id: String(index),
        text: question.text,
        options: question.options,
      })),
    },
  };
}

/**
 * Admin-controlled early termination (Feature 6): atomically marks the quiz
 * closed once, then finalizes every active attempt from its latest persisted
 * answers. Unanswered/open questions become skipped. Repeated calls are
 * idempotent and safe to resume after a partial failure because each step
 * only touches attempts that are still open.
 */
export async function terminateQuiz(adminId: string, quizId: string) {
  const now = new Date();
  const closed = await Quiz.findOneAndUpdate(
    { _id: quizId, status: "published" },
    {
      $set: {
        status: "closed",
        endsAt: now,
        terminatedAt: now,
        terminatedBy: adminId,
      },
    },
    { new: true },
  );
  if (!closed) {
    const existing = await Quiz.findById(quizId)
      .select("status endsAt terminatedAt resultsPublishedAt")
      .lean();
    if (!existing) return fail(404, "NOT_FOUND", "Quiz not found");
    if (existing.status === "draft")
      return fail(409, "QUIZ_NOT_ACTIVE", "Only a live quiz can be ended early");
    return {
      alreadyEnded: true,
      endedAt: existing.terminatedAt || existing.endsAt,
      finalizedAttempts: 0,
      pendingAttempts: await QuizAttempt.countDocuments({
        quizId,
        submittedAt: { $exists: false },
      }),
      resultsPublishedAt: existing.resultsPublishedAt || null,
    };
  }
  const finalizedAttempts = await finalizeOpenAttempts(quizId, adminId, now);
  await recordAudit(adminId, "quiz.terminated", "quiz", quizId, { finalizedAttempts });
  return {
    alreadyEnded: false,
    endedAt: now,
    finalizedAttempts,
    pendingAttempts: await QuizAttempt.countDocuments({
      quizId,
      submittedAt: { $exists: false },
    }),
    resultsPublishedAt: null,
  };
}

/**
 * Resumable finalization pass: converts every still-open attempt into a
 * submitted one using the latest persisted answers (-1 becomes null/skipped,
 * unfinalized slots stamp the cutoff time). Attempts finalized earlier keep
 * their own timestamps. Safe to run repeatedly (e.g. after a crash).
 */
async function finalizeOpenAttempts(quizId: string, adminId: string, cutoff: Date) {
  let finalizedAttempts = 0;
  while (true) {
    const target = await QuizAttempt.findOne({
      quizId,
      submittedAt: { $exists: false },
    }).select("_id");
    if (!target) break;
    await QuizAttempt.updateOne({ _id: target._id, submittedAt: { $exists: false } }, [
      {
        $set: {
          answers: {
            $map: {
              input: { $ifNull: ["$answers", []] },
              as: "value",
              in: { $cond: [{ $eq: ["$$value", -1] }, null, "$$value"] },
            },
          },
          finalizedAt: {
            $map: {
              input: { $ifNull: ["$finalizedAt", []] },
              as: "value",
              in: { $cond: [{ $eq: ["$$value", null] }, cutoff, "$$value"] },
            },
          },
          submittedAt: cutoff,
          endedByAdminAt: cutoff,
          endedBy: adminId,
        },
      },
    ]);
    finalizedAttempts += 1;
  }
  return finalizedAttempts;
}

/**
 * Resume finalization after a partial failure (idempotent retry endpoint).
 */
export async function resumeFinalization(adminId: string, quizId: string) {
  const quiz = await Quiz.findById(quizId).select("status").lean();
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
  if (quiz.status !== "closed")
    return fail(409, "QUIZ_NOT_ENDED", "Only an ended quiz needs finalization retried");
  const finalizedAttempts = await finalizeOpenAttempts(quizId, adminId, new Date());
  await recordAudit(adminId, "quiz.finalization.retried", "quiz", quizId, {
    finalizedAttempts,
  });
  return {
    finalizedAttempts,
    pendingAttempts: await QuizAttempt.countDocuments({
      quizId,
      submittedAt: { $exists: false },
    }),
  };
}

/**
 * Finalize an attempt from the latest persisted answers. Questions without a
 * persisted selection become skipped (never silently dropped). After this the
 * attempt is immutable and scores stay hidden until publication.
 */
export async function finalizeAttempt(attemptId: string, userId: string) {
  const attempt = await QuizAttempt.findOne({ _id: attemptId, userId });
  if (!attempt) return fail(404, "NOT_FOUND", "Quiz attempt not found");
  if (attempt.submittedAt)
    return {
      completed: true,
      alreadyCompleted: true,
      scoreRevealed: false,
      submittedAt: attempt.submittedAt.toISOString(),
    };
  const quiz = await Quiz.findById(attempt.quizId);
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
  const total = quiz.questions.length;
  const now = new Date();
  const rawAnswers = attempt.answers ?? [];
  const answers = Array.from({ length: total }, (_, index) => {
    const value = rawAnswers[index];
    return value != null && value >= 0 ? value : null;
  });
  const finalizedAt = Array.from({ length: total }, (_, index) =>
    attempt.finalizedAt?.[index] ? new Date(attempt.finalizedAt[index]!) : now,
  );
  const submitted = await QuizAttempt.findOneAndUpdate(
    { _id: attemptId, userId, submittedAt: { $exists: false } },
    {
      $set: {
        answers,
        finalizedAt,
        submittedAt: now,
        ...(quiz.status !== "published" ? { endedByAdminAt: now } : {}),
      },
    },
    { new: true },
  );
  if (!submitted) {
    const current = await QuizAttempt.findById(attemptId).select("submittedAt").lean();
    return {
      completed: true,
      alreadyCompleted: true,
      scoreRevealed: false,
      submittedAt: current?.submittedAt
        ? new Date(current.submittedAt).toISOString()
        : null,
    };
  }
  return {
    completed: true,
    alreadyCompleted: false,
    scoreRevealed: false,
    submittedAt: submitted.submittedAt!.toISOString(),
  };
}

export async function scoreAttempt(
  attemptId: string,
  userId: string,
  answers: (number | null)[],
) {
  const attempt = await QuizAttempt.findOne({ _id: attemptId, userId });
  if (!attempt) return fail(404, "NOT_FOUND", "Quiz attempt not found");
  if (attempt.submittedAt)
    fail(409, "ALREADY_SUBMITTED", "Quiz attempt was already submitted");
  const quiz = await Quiz.findById(attempt.quizId);
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
  await requireQuizEventRegistration(quiz.eventId ? String(quiz.eventId) : "", userId);
  const timedOut =
    Date.now() > attempt.startedAt.getTime() + quiz.durationSeconds * 1000;
  if (
    !timedOut &&
    (answers.length !== quiz.questions.length ||
      answers.some(
        (answer, index) =>
          answer != null && answer >= quiz.questions[index]!.options.length,
      ))
  )
    fail(400, "INVALID_ANSWERS", "Provide one valid answer for every question");
  // null entries are skipped questions and simply score zero.
  const score = timedOut
    ? 0
    : answers.reduce(
        (total: number, answer, index) =>
          answer == null
            ? total
            : total + Number(answer === quiz.questions[index]!.correctAnswer),
        0,
      );
  const submitted = await QuizAttempt.findOneAndUpdate(
    { _id: attemptId, userId, submittedAt: { $exists: false } },
    {
      $set: {
        answers: timedOut ? [] : answers,
        score,
        submittedAt: new Date(),
      },
    },
    { new: true },
  );
  if (!submitted)
    return fail(409, "ALREADY_SUBMITTED", "Quiz attempt was already submitted");
  return {
    score,
    total: quiz.questions.length,
    submittedAt: submitted.submittedAt,
    timedOut,
    scoreRevealed: false,
  };
}
