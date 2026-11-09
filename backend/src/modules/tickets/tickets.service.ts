import { fail } from "../../common/errors/app-error.js";
import { env } from "../../config/env.js";
import { hash } from "../../common/utils/hash.js";
import { randomBytes } from "node:crypto";
import { Registration, Ticket } from "../models.js";
import {
  decryptCredentialId,
  encryptCredentialId,
  makeCredential,
} from "./ticket-credential.js";

const credentialSelection =
  "+credentialId +credentialCiphertext +credentialIv +credentialTag";

type TicketCredentialRecord = Record<string, unknown> & {
  credentialId?: string;
  credentialCiphertext?: string;
  credentialIv?: string;
  credentialTag?: string;
};

function withCredential(row: TicketCredentialRecord) {
  const credentialId = row.credentialCiphertext
    ? decryptCredentialId(
        row as {
          credentialCiphertext: string;
          credentialIv: string;
          credentialTag: string;
        },
        env.JWT_REFRESH_SECRET,
      )
    : row.credentialId;
  if (!credentialId)
    return fail(503, "TICKET_MIGRATION_REQUIRED", "Ticket credentials need migration");
  const {
    credentialId: _legacy,
    credentialCiphertext: _ciphertext,
    credentialIv: _iv,
    credentialTag: _tag,
    ...safeTicket
  } = row;
  return {
    ...safeTicket,
    credential: makeCredential(credentialId, env.JWT_REFRESH_SECRET),
  };
}

export async function listTicketsForUser(userId: string) {
  // Keep cancelled registrations visible so students retain ticket history.
  const registrations = await Registration.find({
    $or: [{ userId }, { memberIds: userId }],
  })
    .select("_id status")
    .lean();

  const registrationIds = registrations.map((registration) => registration._id);
  const activeRegistrations = registrations.filter(
    (registration) => registration.status === "confirmed",
  );

  // Repair registrations created before ticket creation was working, or records
  // left without a ticket by an earlier incomplete deployment.
  const existingRegistrationIds = await Ticket.distinct("registrationId", {
    registrationId: { $in: activeRegistrations.map((row) => row._id) },
  });
  const existingIds = new Set(existingRegistrationIds.map((id) => String(id)));
  const registrationsMissingTickets = activeRegistrations.filter(
    (registration) => !existingIds.has(String(registration._id)),
  );

  await Promise.all(
    registrationsMissingTickets.map(async (registration) => {
      const credentialId = randomBytes(32).toString("base64url");

      try {
        await Ticket.create({
          registrationId: registration._id,
          credentialHash: hash(credentialId),
          ...encryptCredentialId(credentialId, env.JWT_REFRESH_SECRET),
        });
      } catch (error) {
        // Two simultaneous /tickets/me requests may try to repair the same
        // registration. The unique registrationId index makes this safe.
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? (error as { code?: unknown }).code
            : undefined;

        if (code !== 11000) throw error;
      }
    }),
  );

  const tickets = await Ticket.find({
    registrationId: { $in: registrationIds },
  })
    .select(credentialSelection)
    .populate({
      path: "registrationId",
      select: "eventId status userId teamName members createdAt",
      populate: [
        {
          path: "eventId",
          select:
            "title description category venue startsAt endsAt status capacity registeredCount image imagePublicId participationType teamMin teamMax teamLeaderIncluded",
        },
        { path: "userId", select: "name email" },
      ],
    })
    .sort({ createdAt: -1 })
    .lean();

  return tickets.map((ticket) => {
    const row = ticket as TicketCredentialRecord;
    const credentialId = row.credentialCiphertext
      ? decryptCredentialId(
          row as {
            credentialCiphertext: string;
            credentialIv: string;
            credentialTag: string;
          },
          env.JWT_REFRESH_SECRET,
        )
      : row.credentialId;

    if (!credentialId) {
      return fail(
        503,
        "TICKET_MIGRATION_REQUIRED",
        "Ticket credentials need migration",
      );
    }

    const {
      credentialId: _legacy,
      credentialCiphertext: _ciphertext,
      credentialIv: _iv,
      credentialTag: _tag,
      registrationId: rawRegistration,
      ...safeTicket
    } = row;
    const registration =
      rawRegistration && typeof rawRegistration === "object"
        ? (rawRegistration as Record<string, unknown>)
        : null;
    const event =
      registration?.eventId && typeof registration.eventId === "object"
        ? (registration.eventId as Record<string, unknown>)
        : null;
    const participant =
      registration?.userId && typeof registration.userId === "object"
        ? (registration.userId as Record<string, unknown>)
        : registration?.userId;

    return {
      ...safeTicket,
      registrationId: registration ? String(registration._id) : String(rawRegistration),
      registration: registration
        ? {
            _id: String(registration._id),
            eventId: event ? String(event._id) : "",
            userId:
              participant && typeof participant === "object"
                ? {
                    name: String((participant as Record<string, unknown>).name || "Participant"),
                    email: String((participant as Record<string, unknown>).email || ""),
                  }
                : String(participant || ""),
            teamName: registration.teamName ? String(registration.teamName) : undefined,
            members: Array.isArray(registration.members) ? registration.members : [],
            createdAt: registration.createdAt,
            status: String(registration.status || "cancelled"),
          }
        : null,
      event: event
        ? {
            _id: String(event._id),
            title: String(event.title || "Event"),
            description: String(event.description || ""),
            category: String(event.category || ""),
            venue: String(event.venue || ""),
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            status: String(event.status || "archived"),
            capacity: event.capacity,
            registeredCount: event.registeredCount,
            image: event.image,
            imagePublicId: event.imagePublicId,
            participationType: event.participationType,
            teamMin: event.teamMin,
            teamMax: event.teamMax,
            teamLeaderIncluded: event.teamLeaderIncluded,
          }
        : null,
      credential: makeCredential(credentialId, env.JWT_REFRESH_SECRET),
    };
  });
}

export async function getTicket(ticketId: string, userId: string, isAdmin: boolean) {
  const ticket = await Ticket.findById(ticketId).select(credentialSelection);
  if (!ticket) return fail(404, "NOT_FOUND", "Ticket not found");
  if (!isAdmin) {
    const registration = await Registration.findById(ticket.registrationId)
      .select("userId memberIds")
      .lean();
    if (String(registration?.userId) !== userId && !registration?.memberIds?.some((id) => String(id) === userId))
      fail(404, "NOT_FOUND", "Ticket not found");
  }
  return withCredential(ticket.toObject() as TicketCredentialRecord);
}
