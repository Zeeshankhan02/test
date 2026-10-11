import { Router } from "express";
import multer from "multer";
import { allow } from "../../middleware/authorize.middleware.js";
import {
  archiveEvent,
  cancelEvent,
  createEvent,
  deleteEventImageByPublicId,
  getEvent,
  getEventRegistrations,
  listEvents,
  publishEvent,
  removeEvent,
  updateEvent,
  uploadEventImageFile,
} from "./events.controller.js";

export const eventsRoutes = Router();

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

eventsRoutes.get("/", listEvents);
eventsRoutes.post(
  "/images",
  allow("admin"),
  imageUpload.single("image"),
  uploadEventImageFile,
);
eventsRoutes.delete("/images/:publicId(*)", allow("admin"), deleteEventImageByPublicId);
eventsRoutes.post("/", allow("admin"), createEvent);
eventsRoutes.get("/:eventId", getEvent);
eventsRoutes.patch("/:eventId", allow("admin"), updateEvent);
eventsRoutes.delete("/:eventId", allow("admin"), removeEvent);
eventsRoutes.post("/:eventId/publish", allow("admin"), publishEvent);
eventsRoutes.post("/:eventId/cancel", allow("admin"), cancelEvent);
eventsRoutes.post("/:eventId/archive", allow("admin"), archiveEvent);
eventsRoutes.get("/:eventId/registrations", allow("admin"), getEventRegistrations);
