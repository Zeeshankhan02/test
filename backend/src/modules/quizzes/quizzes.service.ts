import { fail } from "../../common/errors/app-error.js";
import { recordAudit } from "../../common/utils/audit.js";
import { emitUserNotification } from "../../sockets/socket-server.js";
import { Event, Notification, Quiz, QuizAttempt, Registration } from "../models.js";
import type { z } from "zod";
import type { quizInput, quizUpdateInput } from "./quizzes.validator.js";

type QuizInput = z.infer<typeof quizInput>;

function validateAnswerKeys(data: QuizInput) {
  if (
    data.questions.some((question) => question.correctAnswer >= question.options.length)
  )
    return fail(
      400,
      "INVALID_ANSWER",
      "Correct answer must reference an available option",
    );
  return data;
}

export async function requireQuizEventRegistration(eventId: string, userId: string) {
  if (
    !eventId ||
    !(await Registration.exists({ eventId, userId, status: "confirmed" }))
  )
    return fail(
      403,
      "QUIZ_ACCESS_DENIED",
      "Register for the quiz event to access this quiz",
    );
}

export async function getPublishedQuizzes(userId: string, role: "student" | "admin") {
  const eventIds =
    role === "admin"
      ? undefined
      : await Registration.distinct("eventId", { userId, status: "confirmed" });
  return (
    await Quiz.find({
      status: "published",
      ...(eventIds ? { eventId: { $in: eventIds } } : {}),
    }).lean()
  ).map((quiz) => ({
    ...quiz,
    // Students need to know whether the window is still open and whether
    // results are published; correctAnswer stays stripped above.
    endsAt: quiz.endsAt ?? null,
    resultsPublishedAt: quiz.resultsPublishedAt ?? null,
    questions: quiz.questions.map(({ text, options }, index) => ({
      id: String(index),
      text,
      options,
    })),
  }));
}

export async function addQuiz(adminId: string, input: QuizInput) {
  if (!(await Event.exists({ _id: input.eventId })))
    return fail(404, "EVENT_NOT_FOUND", "Quiz event not found");
  const quiz = await Quiz.create(validateAnswerKeys(input));
  await recordAudit(adminId, "quiz.created", "quiz", String(quiz._id), {
    status: quiz.status,
  });
  return quiz;
}

export async function editQuiz(
  adminId: string,
  id: string,
  input: z.input<typeof quizUpdateInput>,
) {
  if (input.questions) {
    const quiz = await Quiz.findById(id);
    if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
    if (await QuizAttempt.exists({ quizId: id }))
      return fail(
        409,
        "QUIZ_HAS_ATTEMPTS",
        "Questions cannot change after an attempt starts",
      );
    validateAnswerKeys({ ...quiz.toObject(), ...input } as QuizInput);
  }
  if (input.eventId) {
    if (!(await Event.exists({ _id: input.eventId })))
      return fail(404, "EVENT_NOT_FOUND", "Quiz event not found");
    if (await QuizAttempt.exists({ quizId: id }))
      return fail(
        409,
        "QUIZ_HAS_ATTEMPTS",
        "The quiz event cannot change after an attempt starts",
      );
  }
  const updated = await Quiz.findOneAndUpdate(
    { _id: id, status: "draft" },
    { $set: input },
    { new: true, runValidators: true },
  );
  if (!updated)
    return fail(409, "QUIZ_NOT_EDITABLE", "Only draft quizzes can be edited");
  await recordAudit(adminId, "quiz.updated", "quiz", String(updated._id));
  return updated;
}

export async function changeQuizStatus(
  adminId: string,
  id: string,
  from: "draft" | "published",
  to: "published" | "closed",
) {
  const updated = await Quiz.findOneAndUpdate(
    { _id: id, status: from },
    to === "closed"
      ? { $set: { status: to, endsAt: new Date() } }
      : { $set: { status: to } },
    { new: true },
  );
  if (!updated)
    return fail(
      404,
      "NOT_FOUND",
      from === "draft" ? "Draft quiz not found" : "Published quiz not found",
    );
  await recordAudit(adminId, `quiz.${to}`, "quiz", String(updated._id));
  return to === "closed"
    ? { id: String(updated._id), status: updated.status }
    : updated;
}

/** Server-side evaluation of every submitted attempt for a closed quiz. */
async function finalizeQuizAttempts(quiz: {
  _id: unknown;
  questions: { options: string[]; correctAnswer: number }[];
}) {
  const attempts = await QuizAttempt.find({
    quizId: quiz._id,
    submittedAt: { $exists: true },
  });
  let evaluated = 0;
  for (const attempt of attempts) {
    // -1 marks an unanswered question in the per-question autosave format;
    // null marks one skipped at finalization. Both simply score zero, so we
    // only compare entries that actually reference an option index.
    const expected =
      attempt.answers.length === quiz.questions.length
        ? attempt.answers.reduce<number>(
            (total, answer, index) =>
              typeof answer === "number" && answer >= 0
                ? total + Number(answer === quiz.questions[index]!.correctAnswer)
                : total,
            0,
          )
        : 0;
    if (attempt.score !== expected) {
      attempt.score = expected;
      await attempt.save();
    }
    evaluated += 1;
  }
  return evaluated;
}

export async function listQuizzesForAdmin(adminId: string) {
  // Audit the listing so every admin pass over quiz metadata (which includes
  // participant counts and publication state) leaves a trace.
  await recordAudit(adminId, "quiz.list.viewed", "quiz", "all");
  const quizzes = await Quiz.find()
    .populate("eventId", "title")
    .sort({ createdAt: -1 })
    .lean();
  return Promise.all(
    quizzes.map(async (quiz) => {
      const [started, submitted] = await Promise.all([
        QuizAttempt.countDocuments({ quizId: quiz._id }),
        QuizAttempt.countDocuments({
          quizId: quiz._id,
          submittedAt: { $exists: true },
        }),
      ]);
      return {
        id: String(quiz._id),
        title: quiz.title,
        eventTitle: (quiz.eventId as unknown as { title?: string })?.title || "",
        status: quiz.status,
        endsAt: quiz.endsAt ?? null,
        resultsPublishedAt: quiz.resultsPublishedAt ?? null,
        resultsAnnouncedAt: quiz.resultsAnnouncedAt ?? null,
        startedAttempts: started,
        submittedAttempts: submitted,
        pendingEvaluations: started - submitted,
      };
    }),
  );
}

export async function getQuizResultsSummary(adminId: string, id: string) {
  const quiz = await Quiz.findById(id).populate("eventId", "title").lean();
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
  const [submitted, started, participants] = await Promise.all([
    QuizAttempt.countDocuments({ quizId: id, submittedAt: { $exists: true } }),
    QuizAttempt.countDocuments({ quizId: id }),
    Registration.countDocuments({ eventId: quiz.eventId, status: "confirmed" }),
  ]);
  return {
    id: String(quiz._id),
    title: quiz.title,
    eventTitle: (quiz.eventId as unknown as { title?: string })?.title || "",
    status: quiz.status,
    endsAt: quiz.endsAt || null,
    resultsPublishedAt: quiz.resultsPublishedAt || null,
    resultsAnnouncedAt: quiz.resultsAnnouncedAt || null,
    participants,
    startedAttempts: started,
    submittedAttempts: submitted,
    pendingEvaluations: started - submitted,
  };
}

export async function listQuizResultRows(adminId: string, id: string) {
  const quiz = await Quiz.findById(id);
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
  const attempts = await QuizAttempt.find({
    quizId: id,
    submittedAt: { $exists: true },
  })
    .sort({ score: -1, submittedAt: 1 })
    .limit(200)
    .populate("userId", "name")
    .lean();
  return attempts.map((attempt, index) => ({
    rank: index + 1,
    userName: (attempt.userId as unknown as { name?: string })?.name || "Unknown",
    score: attempt.score ?? 0,
    total: quiz.questions.length,
    submittedAt: attempt.submittedAt,
    timeTakenSeconds:
      attempt.startedAt && attempt.submittedAt
        ? Math.max(
            0,
            Math.round(
              (attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000,
            ),
          )
        : null,
  }));
}

export async function publishQuizResults(adminId: string, id: string) {
  const quiz = await Quiz.findById(id);
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
  if (quiz.status !== "closed")
    return fail(409, "QUIZ_NOT_ENDED", "End the quiz before publishing its results");
  const pending = await QuizAttempt.countDocuments({
    quizId: id,
    submittedAt: { $exists: false },
  });
  if (pending > 0)
    return fail(
      409,
      "EVALUATIONS_PENDING",
      `${pending} started attempt${pending === 1 ? "" : "s"} still need to be submitted or evaluated`,
    );
  await finalizeQuizAttempts(quiz);
  // Atomic guard so concurrent/repeated publishes cannot double-publish.
  const published = await Quiz.findOneAndUpdate(
    { _id: id, status: "closed", resultsPublishedAt: { $exists: false } },
    { $set: { resultsPublishedAt: new Date() } },
    { new: true },
  );
  if (!published) {
    const current = await Quiz.findById(id).select("resultsPublishedAt").lean();
    if (current?.resultsPublishedAt)
      return { alreadyPublished: true, resultsPublishedAt: current.resultsPublishedAt };
    return fail(
      409,
      "QUIZ_NOT_ENDED",
      "The quiz must be ended before publishing results",
    );
  }
  await recordAudit(adminId, "quiz.results.published", "quiz", id, {
    announced: false,
  });
  return { alreadyPublished: false, resultsPublishedAt: published.resultsPublishedAt };
}

export async function announceQuizResults(adminId: string, id: string) {
  const quiz = await Quiz.findById(id);
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
  if (!quiz.resultsPublishedAt)
    return fail(
      409,
      "RESULTS_NOT_PUBLISHED",
      "Publish the results before announcing them",
    );
  if (quiz.resultsAnnouncedAt) return { delivered: 0, alreadyAnnounced: true };
  const recipients = await Registration.find({
    eventId: quiz.eventId,
    status: "confirmed",
  })
    .select("userId")
    .lean();
  const userIds = [...new Set(recipients.map((row) => String(row.userId)))];
  const publishedAt = quiz.resultsPublishedAt;
  const notifications = await Notification.insertMany(
    userIds.map((userId) => ({
      userId,
      type: "result",
      title: `Results are out: ${quiz.title}`,
      message: `Quiz results were published on ${publishedAt.toLocaleString()}. Open your result and the leaderboard to see where you placed.`,
    })),
  );
  // Stamp the announcement atomically; a lost race means another request
  // already announced, so nothing is emitted twice.
  const stamped = await Quiz.findOneAndUpdate(
    {
      _id: id,
      resultsPublishedAt: { $exists: true },
      resultsAnnouncedAt: { $exists: false },
    },
    { $set: { resultsAnnouncedAt: new Date() } },
    { new: true },
  );
  if (!stamped) {
    await Notification.deleteMany({
      _id: { $in: notifications.map((row) => row._id) },
    });
    return { delivered: 0, alreadyAnnounced: true };
  }
  notifications.forEach((notification) =>
    emitUserNotification(String(notification.userId), notification.toObject()),
  );
  await recordAudit(adminId, "quiz.results.announced", "quiz", id, {
    delivered: userIds.length,
  });
  return { delivered: userIds.length, alreadyAnnounced: false };
}

export async function getMyQuizResult(userId: string, quizId: string) {
  const quiz = await Quiz.findById(quizId)
    .select("title status endsAt resultsPublishedAt questions eventId")
    .lean();
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
  if (!quiz.resultsPublishedAt)
    return fail(
      403,
      "RESULTS_NOT_PUBLISHED",
      "Results have not been published for this quiz yet",
    );
  await requireQuizEventRegistration(quiz.eventId ? String(quiz.eventId) : "", userId);
  const attempt = await QuizAttempt.findOne({
    quizId,
    userId,
    submittedAt: { $exists: true },
  }).lean();
  if (!attempt)
    return fail(404, "ATTEMPT_NOT_FOUND", "No submitted attempt found for this quiz");
  const ranked = await QuizAttempt.countDocuments({
    quizId,
    submittedAt: { $exists: true },
    score: { $gt: attempt.score ?? 0 },
  });
  return {
    quizId,
    title: quiz.title,
    score: attempt.score ?? 0,
    total: quiz.questions.length,
    rank: ranked + 1,
    submittedAt: attempt.submittedAt,
    completedAt: attempt.submittedAt,
    timeTakenSeconds: attempt.startedAt
      ? Math.max(
          0,
          Math.round(
            (attempt.submittedAt!.getTime() - attempt.startedAt.getTime()) / 1000,
          ),
        )
      : null,
    resultsPublishedAt: quiz.resultsPublishedAt,
  };
}
