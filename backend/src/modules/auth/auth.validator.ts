import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email(),
  password: z.string().min(12).max(128),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});

export const passwordResetRequestSchema = z.object({ email: z.email() });

export const passwordResetSchema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(12).max(128),
});
