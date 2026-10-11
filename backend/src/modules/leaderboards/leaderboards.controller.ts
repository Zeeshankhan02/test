import { asyncRoute } from "../../common/utils/async-route.js";
import { success } from "../../common/responses/success.js";
import { objectId, parseBody } from "../../common/validators/object-id.js";
import { listLeaderboard } from "./leaderboards.service.js";

export const getLeaderboard = asyncRoute(async (req, res) =>
  success(
    res,
    await listLeaderboard(
      parseBody(objectId, req.params.quizId),
      req.principal!.id,
      req.principal!.role as "student" | "admin",
    ),
  ),
);
