import { fail } from "../../common/errors/app-error.js";
import { recordAudit } from "../../common/utils/audit.js";
import { emitUserNotification } from "../../sockets/socket-server.js";
import { Notification, User } from "../models.js";

export async function getUserNotifications(userId: string) {
  return Notification.find({ userId }).sort({ createdAt: -1 }).limit(100).lean();
}

export async function createBroadcast(
  adminId: string,
  input: {
    title: string;
    message: string;
    audience: "students" | "volunteers" | "all";
  },
) {
  const roles =
    input.audience === "all"
      ? ["student", "volunteer"]
      : input.audience === "students"
        ? ["student"]
        : ["volunteer"];
  const recipients = await User.find({ role: { $in: roles }, active: true })
    .select("_id")
    .lean();
  if (recipients.length > 25000)
    fail(503, "AUDIENCE_TOO_LARGE", "Audience is too large for synchronous delivery");
  const notifications = await Notification.insertMany(
    recipients.map(({ _id }) => ({
      userId: _id,
      title: input.title,
      message: input.message,
      type: "announcement",
    })),
  );
  await recordAudit(adminId, "notification.broadcast", "notification", "broadcast", {
    audience: input.audience,
    delivered: recipients.length,
  });
  notifications.forEach((notification) =>
    emitUserNotification(String(notification.userId), notification.toObject()),
  );
  return { delivered: recipients.length };
}

export async function setNotificationRead(notificationId: string, userId: string) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { isRead: true } },
    { new: true },
  );
}
