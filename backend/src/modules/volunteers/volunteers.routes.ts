import { Router } from "express";
import { allow } from "../../middleware/authorize.middleware.js";
import {
  createVolunteer,
  listVolunteers,
  updateVolunteerStatus,
} from "./volunteers.controller.js";

export const volunteersRoutes = Router();

volunteersRoutes.get("/volunteers", allow("admin"), listVolunteers);
volunteersRoutes.post("/volunteers", allow("admin"), createVolunteer);
volunteersRoutes.patch(
  "/volunteers/:userId/status",
  allow("admin"),
  updateVolunteerStatus,
);
