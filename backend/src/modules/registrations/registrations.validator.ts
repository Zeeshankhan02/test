import { z } from "zod";
import { objectId } from "../../common/validators/object-id.js";

export const registrationsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(["confirmed", "cancelled"]).optional(),
  eventId: objectId.optional(),
});

export const registrationInput = z.object({
  teamName: z.string().trim().max(100).optional(),
  members: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
});
