import { Router } from "express";
import { allow } from "../../middleware/authorize.middleware.js";
import { getLeaderboard } from "./leaderboards.controller.js";

export const leaderboardsRoutes = Router();

leaderboardsRoutes.get(
  "/quizzes/:quizId/leaderboard",
  allow("student", "admin"),
  getLeaderboard,
);
