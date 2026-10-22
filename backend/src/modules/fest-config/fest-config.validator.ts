import { z } from "zod";

export const festDatesSchema = z
  .object({
    title: z.string().trim().min(1).max(140).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    timezone: z.string().trim().min(1).max(64).optional(),
    venue: z.string().trim().min(1).max(140).optional(),
  })
  .refine((value) => value.endsAt >= value.startsAt, {
    message: "The fest end date cannot be earlier than the start date",
    path: ["endsAt"],
  });

export type FestDatesInput = z.infer<typeof festDatesSchema>;
