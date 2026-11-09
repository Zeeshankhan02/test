import { fail } from "../../common/errors/app-error.js";
import { recordAudit } from "../../common/utils/audit.js";
import { emitUserNotification } from "../../sockets/socket-server.js";
import { sendAnnouncementEmails } from "../../integrations/email/email.js";
import { Notification, Registration, User } from "../models.js";

export async function getUserNotifications(userId: string) {
  return Notification.find({ userId }).sort({ createdAt: -1 }).limit(100).lean();
}

export async function announceEventToRegistrants(
  eventId: string,
  title: string,
  message: string,
  notify = true,
) {
  const userIds = await Registration.distinct("userId", {
    eventId,
    status: "confirmed",
  });
  const recipients = await User.find({ _id: { $in: userIds }, active: true })
    .select("_id name email")
    .lean();
  if (recipients.length > 25000)
    fail(503, "AUDIENCE_TOO_LARGE", "Audience is too large for synchronous delivery");

  if (notify) {
    const notifications = await Notification.insertMany(
      recipients.map(({ _id }) => ({ userId: _id, title, message, type: "result" })),
    );
    notifications.forEach((notification) =>
      emitUserNotification(String(notification.userId), notification.toObject()),
    );
  }

  let email = { sent: 0, failed: 0 };
  try {
    email = await sendAnnouncementEmails(recipients, title, message);
  } catch {
    email.failed = recipients.length;
  }
  return { delivered: notify ? recipients.length : 0, email };
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
    .select("_id name email")
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
  notifications.forEach((notification) =>
    emitUserNotification(String(notification.userId), notification.toObject()),
  );
  let email = { sent: 0, failed: 0 };
  try {
    email = await sendAnnouncementEmails(recipients, input.title, input.message);
  } catch {
    email.failed = recipients.length;
  }
  await recordAudit(adminId, "notification.broadcast", "notification", "broadcast", {
    audience: input.audience,
    delivered: recipients.length,
    sent: email.sent,
    failed: email.failed,
  });
  return { delivered: recipients.length, email };
}

export async function setNotificationRead(notificationId: string, userId: string) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { isRead: true } },
    { new: true },
  );
}
