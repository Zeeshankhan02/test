import { randomBytes } from "node:crypto";
import type { ClientSession } from "mongoose";
import { fail } from "../../common/errors/app-error.js";
import { env } from "../../config/env.js";
import { hash } from "../../common/utils/hash.js";
import { recordAudit } from "../../common/utils/audit.js";
import { emitUserNotification } from "../../sockets/socket-server.js";
import {
  decryptCredentialId,
  encryptCredentialId,
  makeCredential,
} from "../tickets/ticket-credential.js";
import { Event, Notification, Registration, Ticket, User } from "../models.js";
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

type TicketCredentialRecord = {
  _id?: unknown;
  registrationId?: unknown;
  status?: string;
  credentialId?: string;
  credentialCiphertext?: string;
  credentialIv?: string;
  credentialTag?: string;
  [key: string]: unknown;
};

/**
 * Returns the existing ticket for a registration, or creates one if an older
 * registration has no ticket. The unique registrationId index prevents more
 * than one ticket from being created for the same registration.
 */
async function ensureTicketForRegistration(
  registrationId: unknown,
  session?: ClientSession,
) {
  let query = Ticket.findOne({ registrationId }).select(
    "+credentialId +credentialCiphertext +credentialIv +credentialTag",
  );
  if (session) query = query.session(session);

  const existing = (await query.lean()) as TicketCredentialRecord | null;

  if (existing) {
    const credentialId = existing.credentialCiphertext
      ? decryptCredentialId(
          existing as {
            credentialCiphertext: string;
            credentialIv: string;
            credentialTag: string;
          },
          env.JWT_REFRESH_SECRET,
        )
      : existing.credentialId;

    if (!credentialId) {
      return fail(
        503,
        "TICKET_MIGRATION_REQUIRED",
        "An existing ticket has no recoverable credential. Run the ticket credential migration.",
      );
    }

    return { credential: makeCredential(credentialId, env.JWT_REFRESH_SECRET) };
  }

  const credentialId = randomBytes(32).toString("base64url");
  await Ticket.create(
    [
      {
        registrationId,
        credentialHash: hash(credentialId),
        ...encryptCredentialId(credentialId, env.JWT_REFRESH_SECRET),
      },
    ],
    session ? { session } : {},
  );

  return { credential: makeCredential(credentialId, env.JWT_REFRESH_SECRET) };
}

export async function registerParticipant(
  eventId: string,
  user: { id: string; name: string; email: string },
  input: z.infer<typeof registrationInput>,
) {
  // Repair older registrations first. Earlier versions/data imports may have
  // created a registration without its corresponding ticket.
  const existingRegistration = await Registration.findOne({ eventId, userId: user.id });

  if (existingRegistration) {
    if (existingRegistration.status !== "confirmed") {
      return fail(
        409,
        "REGISTRATION_NOT_ACTIVE",
        "This registration is not active. Contact an event administrator.",
      );
    }

    const ticket = await ensureTicketForRegistration(existingRegistration._id);
    return {
      registration: existingRegistration.toObject() as Record<string, unknown>,
      ticket,
    };
  }

  const event = await Event.findOne({ _id: eventId, status: "published" });
  if (
    !event ||
    event.startsAt <= new Date() ||
    (event.registrationDeadline && event.registrationDeadline <= new Date())
  ) {
    return fail(409, "REGISTRATION_CLOSED", "Registration is closed");
  }
  const mode = event.participationType ?? "individual";
  if (
    (input.participationType === "team" && mode === "individual") ||
    (input.participationType === "individual" && mode === "team")
  )
    return fail(400, "PARTICIPATION_TYPE_NOT_ALLOWED", "This event does not allow that registration type");
  const team = input.participationType === "team";
  if (team && !input.teamName?.trim())
    return fail(400, "TEAM_NAME_REQUIRED", "Enter a team name");
  const emails = team ? [...input.memberEmails] : [user.email];
  if (new Set(emails).size !== emails.length)
    return fail(400, "DUPLICATE_TEAM_MEMBER", "A participant can only appear once in a team");
  const leaderWasProvided = emails.includes(user.email);
  if (team && !event.teamLeaderIncluded && leaderWasProvided)
    return fail(400, "TEAM_LEADER_EXCLUDED", "Do not include yourself in the counted team members");
  if (team && event.teamLeaderIncluded && !leaderWasProvided) emails.push(user.email);
  if (team && !emails.includes(user.email)) emails.push(user.email);
  const memberUsers = await User.find({ email: { $in: emails }, role: "student", active: true })
    .select("_id name email")
    .lean();
  if (memberUsers.length !== emails.length)
    return fail(400, "INVALID_TEAM_MEMBER", "Every team member must use an active student account email");
  const memberIds = memberUsers.map((member) => String(member._id));
  if (new Set(memberIds).size !== memberIds.length)
    return fail(400, "DUPLICATE_TEAM_MEMBER", "A participant can only appear once in a team");
  const configuredSize = team
    ? memberIds.length - Number(!event.teamLeaderIncluded)
    : 1;
  if (team && (configuredSize < event.teamMin || configuredSize > event.teamMax))
    return fail(400, "INVALID_TEAM_SIZE", "Team size is outside event limits");
  const alreadyRegistered = await Registration.findOne({
    eventId,
    status: "confirmed",
    memberIds: { $in: memberIds },
  }).select("_id").lean();
  if (alreadyRegistered)
    return fail(409, "MEMBER_ALREADY_REGISTERED", "A team member is already registered for this event");
  const session = await Event.db.startSession();
  let result:
    | {
        registration: Record<string, unknown>;
        ticket: { credential: string };
      }
    | undefined;
  let notificationId: string | undefined;
  try {
    await session.withTransaction(async () => {
      const currentEvent = await Event.findOne({ _id: eventId, status: "published" }).session(session);
      if (!currentEvent || currentEvent.startsAt <= new Date() || (currentEvent.registrationDeadline && currentEvent.registrationDeadline <= new Date()))
        return fail(409, "REGISTRATION_CLOSED", "Registration is closed");
      if ((currentEvent.participationType ?? "individual") !== mode || currentEvent.teamMin !== event.teamMin || currentEvent.teamMax !== event.teamMax || (currentEvent.teamLeaderIncluded ?? true) !== (event.teamLeaderIncluded ?? true))
        return fail(409, "EVENT_CONFIGURATION_CHANGED", "Event participation rules changed. Reload and try again.");
      if (await Registration.exists({ eventId, userId: user.id }).session(session))
        return fail(409, "ALREADY_REGISTERED", "Already registered for this event");
      if (await Registration.exists({ eventId, status: "confirmed", memberIds: { $in: memberIds } }).session(session))
        return fail(409, "MEMBER_ALREADY_REGISTERED", "A team member is already registered for this event");
      const members = memberUsers.map((member) => member.name);
      const reserved = await Event.updateOne(
        {
          _id: eventId,
          status: "published",
          registeredCount: { $lte: currentEvent.capacity - memberIds.length },
        },
        { $inc: { registeredCount: memberIds.length } },
        { session },
      );
      if (!reserved.modifiedCount) return fail(409, "EVENT_FULL", "Event is full");
      const [registration] = await Registration.create(
        [{ eventId, userId: user.id, teamName: team ? input.teamName : undefined, members, memberIds }],
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
      const capacityCount = registration.members.length;
      const capacity = await Event.updateOne(
        {
          _id: registration.eventId,
          registeredCount: { $gte: capacityCount },
        },
        { $inc: { registeredCount: -capacityCount } },
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
  return Registration.find({ $or: [{ userId }, { memberIds: userId }] })
    .populate("userId", "name email")
    .lean();
}

export async function getParticipantRegistration(
  registrationId: string,
  userId: string,
  isAdmin: boolean,
) {
  const row = await Registration.findOne({
    _id: registrationId,
    ...(isAdmin ? {} : { $or: [{ userId }, { memberIds: userId }] }),
  }).populate("userId", "name email").lean();
  if (!row) return fail(404, "NOT_FOUND", "Registration not found");
  return row;
}
