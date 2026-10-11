import { asyncRoute } from "../../common/utils/async-route.js";
import { success } from "../../common/responses/success.js";
import { getDashboardData } from "./dashboard.service.js";

export const getDashboard = asyncRoute(async (_req, res) =>
  success(res, await getDashboardData()),
);
