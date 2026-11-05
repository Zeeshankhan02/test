import { z } from "zod";
import { objectId } from "../../common/validators/object-id.js";

export const registrationsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(["confirmed", "cancelled"]).optional(),
  eventId: objectId.optional(),
});

export const registrationInput = z.object({
  participationType: z.enum(["individual", "team"]).default("individual"),
  teamName: z.string().trim().min(2).max(100).regex(/^[\p{L}\p{N} _.-]+$/u).optional(),
  memberEmails: z.array(z.email().trim().toLowerCase()).max(20).default([]),
});
