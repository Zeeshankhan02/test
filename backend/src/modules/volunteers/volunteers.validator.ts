import { z } from "zod";

export const volunteerCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email(),
  password: z.string().min(16).max(128),
});

export const volunteerStatusSchema = z.object({ active: z.boolean() });
