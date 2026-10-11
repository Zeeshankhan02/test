import { asyncRoute } from "../../common/utils/async-route.js";
import { fail } from "../../common/errors/app-error.js";
import { success } from "../../common/responses/success.js";
import { objectId, parseBody } from "../../common/validators/object-id.js";
import {
  createBroadcast,
  getUserNotifications,
  setNotificationRead,
} from "./notifications.service.js";
import { notificationBroadcastSchema } from "./notifications.validator.js";

export const listNotifications = asyncRoute(async (req, res) =>
  success(res, await getUserNotifications(req.principal!.id)),
);

export const broadcastNotification = asyncRoute(async (req, res) => {
  const input = parseBody(notificationBroadcastSchema, req.body);
  return success(res, await createBroadcast(req.principal!.id, input), 201);
});

export const markNotificationRead = asyncRoute(async (req, res) => {
  const row = await setNotificationRead(
    parseBody(objectId, req.params.notificationId),
    req.principal!.id,
  );
  if (!row) fail(404, "NOT_FOUND", "Notification not found");
  return success(res, row);
});
