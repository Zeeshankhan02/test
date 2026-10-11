import { fail } from "../../common/errors/app-error.js";
import { env } from "../../config/env.js";
import { Registration, Ticket } from "../models.js";
import { decryptCredentialId, makeCredential } from "./ticket-credential.js";

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
  const registrations = await Registration.find({ userId }).select("_id").lean();
  const tickets = await Ticket.find({
    registrationId: { $in: registrations.map((registration) => registration._id) },
  })
    .select(credentialSelection)
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
    if (!credentialId)
      return fail(
        503,
        "TICKET_MIGRATION_REQUIRED",
        "Ticket credentials need migration",
      );
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
