import { fail } from "../../common/errors/app-error.js";
import { Quiz, QuizAttempt } from "../models.js";
import { requireQuizEventRegistration } from "../quizzes/quizzes.service.js";

export async function beginAttempt(quizId: string, userId: string) {
  const quiz = await Quiz.findOne({ _id: quizId, status: "published" }).lean();
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
  await requireQuizEventRegistration(quiz.eventId ? String(quiz.eventId) : "", userId);
  const attempt = await QuizAttempt.findOneAndUpdate(
    { quizId, userId },
    { $setOnInsert: { quizId, userId, startedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  if (attempt.submittedAt)
    fail(409, "ALREADY_SUBMITTED", "This quiz attempt was already submitted");
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
  };
}

export async function scoreAttempt(
  attemptId: string,
  userId: string,
  answers: number[],
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
      answers.some((answer, index) => answer >= quiz.questions[index]!.options.length))
  )
    fail(400, "INVALID_ANSWERS", "Provide one valid answer for every question");
  const score = timedOut
    ? 0
    : answers.reduce(
        (total, answer, index) =>
          total + Number(answer === quiz.questions[index]!.correctAnswer),
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
  };
}
