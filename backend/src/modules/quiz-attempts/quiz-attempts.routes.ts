import { Router } from "express";
import { allow } from "../../middleware/authorize.middleware.js";
import { startQuizAttempt, submitQuizAttempt } from "./quiz-attempts.controller.js";

export const quizAttemptRoutes = Router();

quizAttemptRoutes.post("/quizzes/:quizId/start", allow("student"), startQuizAttempt);
quizAttemptRoutes.post(
  "/quiz-attempts/:attemptId/submit",
  allow("student"),
  submitQuizAttempt,
);
