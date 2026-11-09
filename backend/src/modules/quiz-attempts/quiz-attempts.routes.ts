import { Router } from "express";
import { allow } from "../../middleware/authorize.middleware.js";
import {
  attemptState,
  finishAttempt,
  myQuizAttempt,
  saveAnswer,
  startQuizAttempt,
  submitQuizAttempt,
} from "./quiz-attempts.controller.js";

export const quizAttemptRoutes = Router();

quizAttemptRoutes.post("/quizzes/:quizId/start", allow("student"), startQuizAttempt);
quizAttemptRoutes.get("/quizzes/:quizId/my-attempt", allow("student"), myQuizAttempt);
// Refresh/reconnect snapshot — deadlines come from the server, not the browser.
quizAttemptRoutes.get(
  "/quiz-attempts/:attemptId/state",
  allow("student"),
  attemptState,
);
// Per-question autosave + timeout finalization (idempotent, deadline-checked).
quizAttemptRoutes.post(
  "/quiz-attempts/:attemptId/answers",
  allow("student"),
  saveAnswer,
);
// Terminal finalize built from the latest persisted answers.
quizAttemptRoutes.post(
  "/quiz-attempts/:attemptId/finalize",
  allow("student"),
  finishAttempt,
);
quizAttemptRoutes.post(
  "/quiz-attempts/:attemptId/submit",
  allow("student"),
  submitQuizAttempt,
);
