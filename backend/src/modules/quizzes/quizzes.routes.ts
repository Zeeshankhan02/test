import { Router } from "express";
import { allow } from "../../middleware/authorize.middleware.js";
import {
  adminQuizList,
  announceResults,
  closeQuiz,
  createQuiz,
  endQuizEarly,
  listPublishedQuizzes,
  myQuizResult,
  publishQuiz,
  publishResults,
  retryFinalization,
  resultsRows,
  resultsSummary,
  updateQuiz,
} from "./quizzes.controller.js";

export const quizzesRoutes = Router();
quizzesRoutes.get("/", allow("student", "admin"), listPublishedQuizzes);
// Student's own result — the service enforces publication state and ownership.
quizzesRoutes.get("/:quizId/my-result", allow("student", "admin"), myQuizResult);
quizzesRoutes.post("/", allow("admin"), createQuiz);
quizzesRoutes.patch("/:quizId", allow("admin"), updateQuiz);
quizzesRoutes.post("/:quizId/publish", allow("admin"), publishQuiz);
quizzesRoutes.post("/:quizId/close", allow("admin"), closeQuiz);
// Admin quiz management: lifecycle + result publication.
quizzesRoutes.get("/admin/list", allow("admin"), adminQuizList);
quizzesRoutes.post("/:quizId/end-early", allow("admin"), endQuizEarly);
quizzesRoutes.get("/:quizId/results/summary", allow("admin"), resultsSummary);
quizzesRoutes.get("/:quizId/results/rows", allow("admin"), resultsRows);
quizzesRoutes.post("/:quizId/results/publish", allow("admin"), publishResults);
quizzesRoutes.post("/:quizId/results/announce", allow("admin"), announceResults);
// Idempotent retry of attempt finalization after a partial failure.
quizzesRoutes.post("/:quizId/finalize/retry", allow("admin"), retryFinalization);
