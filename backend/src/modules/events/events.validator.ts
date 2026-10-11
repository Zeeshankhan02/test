import { z } from "zod";

const eventFields = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().max(5000),
  category: z.string().trim().min(1),
  venue: z.string().trim().min(1),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  registrationDeadline: z.iso.datetime().optional(),
  capacity: z.number().int().min(1),
  teamMin: z.number().int().min(1).default(1),
  teamMax: z.number().int().min(1).default(1),
  image: z.url().optional(),
});

export const eventInput = eventFields.refine(
  (event) =>
    Date.parse(event.endsAt) > Date.parse(event.startsAt) &&
    event.teamMax >= event.teamMin,
  "Invalid event dates or team size",
);

export const eventUpdateInput = eventFields.partial();
export const eventQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  q: z.string().max(100).optional(),
});
