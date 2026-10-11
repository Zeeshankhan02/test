import { fail } from "../../common/errors/app-error.js";
import { Quiz, QuizAttempt } from "../models.js";
import { requireQuizEventRegistration } from "../quizzes/quizzes.service.js";

export async function listLeaderboard(
  quizId: string,
  userId: string,
  role: "student" | "admin",
) {
  const quiz = await Quiz.findById(quizId).select("eventId").lean();
  if (!quiz) return fail(404, "NOT_FOUND", "Quiz not found");
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
    .populate("userId", "name")
    .lean();
  return rows.map((row, index) => ({
    rank: index + 1,
    userName: (row.userId as unknown as { name: string }).name,
    score: row.score,
    submittedAt: row.submittedAt,
  }));
}
