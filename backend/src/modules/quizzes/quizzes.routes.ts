import { Router } from "express";
import { allow } from "../../middleware/authorize.middleware.js";
import {
  adminQuizList,
  competitionState,
  correctRound2,
  correctRound3,
  qualificationCorrect,
  confirmWinner,
  announceResults,
  closeQuiz,
  createQuiz,
  endQuizEarly,
  listPublishedQuizzes,
  myQuizResult,
  publishQuiz,
  publishResults,
  publishRound2,
  publishRound3,
  qualificationPreview,
  qualificationPublish,
  retryFinalization,
  resultsRows,
  resultsSummary,
  saveRound2,
  saveRound3,
  updateQuiz,
} from "./quizzes.controller.js";

export const quizzesRoutes = Router();
quizzesRoutes.get("/", allow("student", "admin"), listPublishedQuizzes);
// Student's own result — the service enforces publication state and ownership.
quizzesRoutes.get("/:quizId/my-result", allow("student", "admin"), myQuizResult);
quizzesRoutes.get("/:quizId/competition", allow("student", "admin"), competitionState);
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
quizzesRoutes.post("/:quizId/competition/qualification/prepare", allow("admin"), qualificationPreview);
quizzesRoutes.post("/:quizId/competition/qualification/publish", allow("admin"), qualificationPublish);
quizzesRoutes.post("/:quizId/competition/qualification/correct", allow("admin"), qualificationCorrect);
quizzesRoutes.put("/:quizId/competition/round-2", allow("admin"), saveRound2);
quizzesRoutes.post("/:quizId/competition/round-2/publish", allow("admin"), publishRound2);
quizzesRoutes.post("/:quizId/competition/round-2/correct", allow("admin"), correctRound2);
quizzesRoutes.put("/:quizId/competition/round-3", allow("admin"), saveRound3);
quizzesRoutes.post("/:quizId/competition/round-3/publish", allow("admin"), publishRound3);
quizzesRoutes.post("/:quizId/competition/round-3/correct", allow("admin"), correctRound3);
quizzesRoutes.post("/:quizId/competition/winner/confirm", allow("admin"), confirmWinner);
