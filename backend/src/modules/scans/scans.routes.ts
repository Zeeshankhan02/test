import { Router } from "express";
import { allow } from "../../middleware/authorize.middleware.js";
import {
  getVolunteerScanSummary,
  getVolunteerScanHistory,
  verifyScan,
} from "./scans.controller.js";

export const scansRoutes = Router();
scansRoutes.post("/scans/verify", allow("volunteer", "admin"), verifyScan);
scansRoutes.get(
  "/volunteers/me/summary",
  allow("volunteer", "admin"),
  getVolunteerScanSummary,
);
scansRoutes.get(
  "/volunteers/me/scans",
  allow("volunteer", "admin"),
  getVolunteerScanHistory,
);
