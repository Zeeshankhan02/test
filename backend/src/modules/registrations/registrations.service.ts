import { randomBytes } from "node:crypto";
import { fail } from "../../common/errors/app-error.js";
import { env } from "../../config/env.js";
import { hash } from "../../common/utils/hash.js";
import { recordAudit } from "../../common/utils/audit.js";
import { emitUserNotification } from "../../sockets/socket-server.js";
import { encryptCredentialId, makeCredential } from "../tickets/ticket-credential.js";
import { Event, Notification, Registration, Ticket } from "../models.js";
import type { registrationInput } from "./registrations.validator.js";
import type { z } from "zod";

export async function listRegistrations(
  page: number,
  limit: number,
  status?: "confirmed" | "cancelled",
  eventId?: string,
) {
  const filter = { ...(status ? { status } : {}), ...(eventId ? { eventId } : {}) };
  const [data, total] = await Promise.all([
    Registration.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("userId", "name email")
      .lean(),
    Registration.countDocuments(filter),
  ]);
  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function registerParticipant(
  eventId: string,
  user: { id: string; name: string },
  input: z.infer<typeof registrationInput>,
) {
  const event = await Event.findOne({ _id: eventId, status: "published" });
  if (
    !event ||
    event.startsAt <= new Date() ||
    (event.registrationDeadline && event.registrationDeadline <= new Date())
  )
    return fail(409, "REGISTRATION_CLOSED", "Registration is closed");
  const session = await Event.db.startSession();
  let result: unknown;
  let notificationId: string | undefined;
  try {
    await session.withTransaction(async () => {
      if (await Registration.exists({ eventId, userId: user.id }).session(session))
        return fail(409, "ALREADY_REGISTERED", "Already registered for this event");
      const members = input.members.length ? input.members : [user.name];
      if (members.length < event.teamMin || members.length > event.teamMax)
        return fail(400, "INVALID_TEAM_SIZE", "Team size is outside event limits");
      const reserved = await Event.updateOne(
        {
          _id: eventId,
          status: "published",
          registeredCount: { $lte: event.capacity - members.length },
        },
        { $inc: { registeredCount: members.length } },
        { session },
      );
      if (!reserved.modifiedCount) return fail(409, "EVENT_FULL", "Event is full");
      const [registration] = await Registration.create(
        [{ eventId, userId: user.id, teamName: input.teamName, members }],
        { session },
      );
      const [notification] = await Notification.create(
        [
          {
            userId: user.id,
            title: "Registration confirmed",
            message: `Your registration for ${event.title} is confirmed.`,
            type: "registration",
          },
        ],
        { session },
      );
      notificationId = String(notification!._id);
      const credentialId = randomBytes(32).toString("base64url");
      await Ticket.create(
        [
          {
            registrationId: registration!._id,
            credentialHash: hash(credentialId),
            ...encryptCredentialId(credentialId, env.JWT_REFRESH_SECRET),
          },
        ],
        { session },
      );
      result = {
        registration: registration!.toObject(),
        ticket: { credential: makeCredential(credentialId, env.JWT_REFRESH_SECRET) },
      };
    });
  } finally {
    await session.endSession();
  }
  if (notificationId) {
    const notification = await Notification.findById(notificationId).lean();
    if (notification) emitUserNotification(String(notification.userId), notification);
  }
  return result;
}

export async function cancelParticipantRegistration(
  registrationId: string,
  principal: { id: string; role: "student" | "admin" },
) {
  let notificationId: string | undefined;
  const session = await Registration.db.startSession();
  try {
    await session.withTransaction(async () => {
      const registration = await Registration.findOne({
        _id: registrationId,
        status: "confirmed",
        ...(principal.role === "admin" ? {} : { userId: principal.id }),
      }).session(session);
      if (!registration)
        return fail(404, "NOT_FOUND", "Registration not found or already cancelled");
      const event = await Event.findById(registration.eventId).session(session);
      if (!event || (principal.role !== "admin" && event.startsAt <= new Date()))
        return fail(409, "CANCELLATION_CLOSED", "Registration cancellation is closed");
      const ticket = await Ticket.findOneAndUpdate(
        { registrationId, status: "active" },
        { $set: { status: "cancelled" } },
        { session, new: true },
      );
      if (!ticket)
        return fail(
          409,
          "TICKET_NOT_ACTIVE",
          "This registration has already checked in or is closed",
        );
      registration.status = "cancelled";
      await registration.save({ session });
      const [notification] = await Notification.create(
        [
          {
            userId: registration.userId,
            type: "registration",
            title: "Registration cancelled",
            message: `Your registration for ${event.title} was cancelled.`,
          },
        ],
        { session },
      );
      notificationId = String(notification!._id);
      const capacity = await Event.updateOne(
        {
          _id: registration.eventId,
          registeredCount: { $gte: registration.members.length },
        },
        { $inc: { registeredCount: -registration.members.length } },
        { session },
      );
      if (!capacity.modifiedCount)
        return fail(
          409,
          "CAPACITY_MISMATCH",
          "Event registration count is inconsistent",
        );
    });
  } finally {
    await session.endSession();
  }
  if (notificationId) {
    const notification = await Notification.findById(notificationId).lean();
    if (notification) emitUserNotification(String(notification.userId), notification);
  }
  await recordAudit(
    principal.id,
    "registration.cancelled",
    "registration",
    registrationId,
  );
}

export async function getParticipantRegistrations(userId: string) {
  return Registration.find({ userId }).lean();
}

export async function getParticipantRegistration(
  registrationId: string,
  userId: string,
  isAdmin: boolean,
) {
  const row = await Registration.findOne({
    _id: registrationId,
    ...(isAdmin ? {} : { userId }),
  }).lean();
  if (!row) return fail(404, "NOT_FOUND", "Registration not found");
  return row;
}
