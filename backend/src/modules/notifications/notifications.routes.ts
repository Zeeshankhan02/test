import { Router } from "express";
import { allow } from "../../middleware/authorize.middleware.js";
import {
  broadcastNotification,
  listNotifications,
  markNotificationRead,
} from "./notifications.controller.js";

export const notificationsRoutes = Router();

notificationsRoutes.get("/notifications", listNotifications);
notificationsRoutes.post("/notifications", allow("admin"), broadcastNotification);
notificationsRoutes.patch("/notifications/:notificationId/read", markNotificationRead);
