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
  // Only confirmed registrations should have active participant tickets.
  const registrations = await Registration.find({
    userId,
    status: "confirmed",
  })
    .select("_id")
    .lean();

  const registrationIds = registrations.map((registration) => registration._id);

  // Repair registrations created before ticket creation was working, or records
  // left without a ticket by an earlier incomplete deployment.
  const existingRegistrationIds = await Ticket.distinct("registrationId", {
    registrationId: { $in: registrationIds },
  });
  const existingIds = new Set(existingRegistrationIds.map((id) => String(id)));
  const registrationsMissingTickets = registrations.filter(
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
      ...safeTicket
    } = row;

    return {
      ...safeTicket,
      credential: makeCredential(credentialId, env.JWT_REFRESH_SECRET),
    };
  });
}

export async function getTicket(ticketId: string, userId: string, isAdmin: boolean) {
  const ticket = await Ticket.findById(ticketId).select(credentialSelection);
  if (!ticket) return fail(404, "NOT_FOUND", "Ticket not found");
  if (!isAdmin) {
    const registration = await Registration.findById(ticket.registrationId)
      .select("userId")
      .lean();
    if (String(registration?.userId) !== userId)
      fail(404, "NOT_FOUND", "Ticket not found");
  }
  return withCredential(ticket.toObject() as TicketCredentialRecord);
}
