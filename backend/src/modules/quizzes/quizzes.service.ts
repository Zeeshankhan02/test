import { fail } from "../../common/errors/app-error.js";
import { recordAudit } from "../../common/utils/audit.js";
import { Event, Quiz, QuizAttempt, Registration } from "../models.js";
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
  const quiz = await Quiz.findOneAndUpdate(
    { _id: id, status: from },
    { $set: { status: to } },
    { new: true },
  );
  if (!quiz)
    return fail(
      404,
      "NOT_FOUND",
      from === "draft" ? "Draft quiz not found" : "Published quiz not found",
    );
  await recordAudit(adminId, `quiz.${to}`, "quiz", String(quiz._id));
  return to === "closed" ? { id: String(quiz._id), status: quiz.status } : quiz;
}
