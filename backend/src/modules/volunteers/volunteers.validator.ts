import { z } from "zod";

export const volunteerCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email(),
});

export const volunteerStatusSchema = z.object({ active: z.boolean() });
