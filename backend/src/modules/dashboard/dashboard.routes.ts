import { Router } from "express";
import { getDashboard } from "./dashboard.controller.js";
import { allow } from "../../middleware/authorize.middleware.js";

export const dashboardRoutes = Router();

dashboardRoutes.get("/admin/dashboard", allow("admin"), getDashboard);
