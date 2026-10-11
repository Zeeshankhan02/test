import { Router } from "express";
import { allow } from "../../middleware/authorize.middleware.js";
import {
  cancelRegistration,
  getMyRegistration,
  getRegistration,
  listRegistrations,
  registerForEvent,
} from "./registrations.controller.js";

export const registrationsRoutes = Router();
registrationsRoutes.get("/registrations", allow("admin"), listRegistrations);
registrationsRoutes.post(
  "/events/:eventId/register",
  allow("student"),
  registerForEvent,
);
registrationsRoutes.post(
  "/registrations/:registrationId/cancel",
  allow("student", "admin"),
  cancelRegistration,
);
registrationsRoutes.get("/registrations/me", getMyRegistration);
registrationsRoutes.get("/registrations/:registrationId", getRegistration);
