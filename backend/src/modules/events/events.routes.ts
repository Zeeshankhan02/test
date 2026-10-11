import { Router } from "express";
import { allow } from "../../middleware/authorize.middleware.js";
import {
  archiveEvent,
  cancelEvent,
  createEvent,
  getEvent,
  getEventRegistrations,
  listEvents,
  publishEvent,
  updateEvent,
} from "./events.controller.js";

export const eventsRoutes = Router();
eventsRoutes.get("/", listEvents);
eventsRoutes.get("/:eventId", getEvent);
eventsRoutes.post("/", allow("admin"), createEvent);
eventsRoutes.patch("/:eventId", allow("admin"), updateEvent);
eventsRoutes.post("/:eventId/publish", allow("admin"), publishEvent);
eventsRoutes.post("/:eventId/cancel", allow("admin"), cancelEvent);
eventsRoutes.post("/:eventId/archive", allow("admin"), archiveEvent);
eventsRoutes.get("/:eventId/registrations", allow("admin"), getEventRegistrations);
