import { Router } from "express";
import { allow } from "../../middleware/authorize.middleware.js";
import {
  closeQuiz,
  createQuiz,
  listPublishedQuizzes,
  publishQuiz,
  updateQuiz,
} from "./quizzes.controller.js";

export const quizzesRoutes = Router();
quizzesRoutes.get("/", allow("student", "admin"), listPublishedQuizzes);
quizzesRoutes.post("/", allow("admin"), createQuiz);
quizzesRoutes.patch("/:quizId", allow("admin"), updateQuiz);
quizzesRoutes.post("/:quizId/publish", allow("admin"), publishQuiz);
quizzesRoutes.post("/:quizId/close", allow("admin"), closeQuiz);
