import { Router } from "express";
import { allow } from "../../middleware/authorize.middleware.js";
import { readFestDates, saveFestDates } from "./fest-config.controller.js";

export const festConfigRoutes = Router();

// Public read: the landing page shows the configured dates without a session.
festConfigRoutes.get("/fest/dates", readFestDates);
// Admin-only write.
festConfigRoutes.put("/fest/dates", allow("admin"), saveFestDates);
