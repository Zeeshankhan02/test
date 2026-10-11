import { env } from "../../config/env.js";
import { hash } from "../../common/utils/hash.js";
import { Event, Registration, ScanLog, Ticket, User } from "../models.js";
import { verifyCredential } from "../tickets/ticket-credential.js";

export async function checkInTicket(volunteerId: string, credential: string) {
  const credentialId = verifyCredential(credential, env.JWT_REFRESH_SECRET);
  if (!credentialId) {
    await ScanLog.create({ volunteerId, status: "invalid_ticket" });
    return { status: "invalid" };
  }
  const ticket = await Ticket.findOne({ credentialHash: hash(credentialId) });
  if (!ticket) {
    await ScanLog.create({ volunteerId, status: "invalid_ticket" });
    return { status: "invalid" };
  }
  const session = await Ticket.db.startSession();
  let response: {
    status: string;
    ticketId?: string;
    participant?: { name: string; teamName: string | null; eventName: string };
  } = { status: "invalid" };
  try {
    await session.withTransaction(async () => {
      const updated = await Ticket.findOneAndUpdate(
        { _id: ticket._id, status: "active" },
        { $set: { status: "checked_in" } },
        { new: true, session },
      );
      if (!updated) {
        const current = await Ticket.findById(ticket._id)
          .select("status")
          .session(session)
          .lean();
        const status =
          current?.status === "cancelled" || current?.status === "revoked"
            ? "cancelled_ticket"
            : "already_scanned";
        await ScanLog.create([{ ticketId: ticket._id, volunteerId, status }], {
          session,
        });
        response = { status: status === "already_scanned" ? "duplicate" : "invalid" };
        return;
      }
      const registration = await Registration.findById(ticket.registrationId)
        .session(session)
        .lean();
      if (!registration || registration.status !== "confirmed") {
        await Ticket.updateOne(
          { _id: ticket._id },
          { $set: { status: "cancelled" } },
          { session },
        );
        await ScanLog.create(
          [{ ticketId: ticket._id, volunteerId, status: "cancelled_ticket" }],
          { session },
        );
        response = { status: "invalid" };
        return;
      }
      const [participant, event] = await Promise.all([
        User.findById(registration.userId).select("name").session(session).lean(),
        Event.findById(registration.eventId)
          .select("title status")
          .session(session)
          .lean(),
      ]);
      if (!event || event.status === "cancelled") {
        await Ticket.updateOne(
          { _id: ticket._id },
          { $set: { status: "cancelled" } },
          { session },
        );
        await ScanLog.create(
          [{ ticketId: ticket._id, volunteerId, status: "cancelled_ticket" }],
          { session },
        );
        response = { status: "invalid" };
        return;
      }
      await ScanLog.create(
        [
          {
            ticketId: ticket._id,
            volunteerId,
            status: "valid_entry",
            participantName: participant?.name || "Participant",
            teamName: registration.teamName || "Individual registration",
            eventName: event.title,
          },
        ],
        { session },
      );
      response = {
        status: "valid_entry",
        ticketId: String(ticket._id),
        participant: {
          name: participant?.name || "Participant",
          teamName: registration.teamName || null,
          eventName: event.title,
        },
      };
    });
  } finally {
    await session.endSession();
  }
  return response;
}

export async function getScanSummary(volunteerId: string) {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [todayCheckIns, todayScans, totalCheckIns, logs] = await Promise.all([
    ScanLog.countDocuments({
      volunteerId,
      status: "valid_entry",
      scannedAt: { $gte: startOfDay },
    }),
    ScanLog.countDocuments({ volunteerId, scannedAt: { $gte: startOfDay } }),
    ScanLog.countDocuments({ volunteerId, status: "valid_entry" }),
    ScanLog.find({ volunteerId, status: "valid_entry" })
      .sort({ scannedAt: -1 })
      .limit(5)
      .select("ticketId scannedAt status")
      .lean(),
  ]);
  const tickets = await Ticket.find({
    _id: { $in: logs.flatMap((log) => (log.ticketId ? [log.ticketId] : [])) },
  })
    .select("registrationId")
    .lean();
  const registrations = await Registration.find({
    _id: { $in: tickets.map((ticket) => ticket.registrationId) },
  })
    .select("userId teamName eventId")
    .lean();
  const [users, events] = await Promise.all([
    User.find({ _id: { $in: registrations.map((row) => row.userId) } })
      .select("name")
      .lean(),
    Event.find({ _id: { $in: registrations.map((row) => row.eventId) } })
      .select("title")
      .lean(),
  ]);
  const ticketRegistration = new Map(
    tickets.map((ticket) => [String(ticket._id), String(ticket.registrationId)]),
  );
  const registrationById = new Map(
    registrations.map((registration) => [String(registration._id), registration]),
  );
  const userById = new Map(users.map((user) => [String(user._id), user.name]));
  const eventById = new Map(events.map((event) => [String(event._id), event.title]));
  return {
    todayCheckIns,
    todayScans,
    totalCheckIns,
    recent: logs.map((log) => {
      const registration = log.ticketId
        ? registrationById.get(ticketRegistration.get(String(log.ticketId)) || "")
        : undefined;
      return {
        id: String(log._id),
        scannedAt: log.scannedAt,
        status: log.status,
        participantName: registration
          ? userById.get(String(registration.userId)) || "Participant"
          : "Unknown ticket",
        teamName: registration?.teamName || "Individual registration",
        eventName: registration
          ? eventById.get(String(registration.eventId)) || "Event"
          : "",
      };
    }),
  };
}

export async function listVolunteerScans(volunteerId: string) {
  return ScanLog.find({ volunteerId })
    .sort({ scannedAt: -1 })
    .limit(100)
    .select("ticketId volunteerId scannedAt status participantName teamName eventName")
    .lean();
}
