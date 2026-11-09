import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email(),
  password: z.string().min(12).max(128),
});

export const otpVerificationSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  otp: z.string().regex(/^\d{6}$/, "Enter the six-digit code"),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});

export const passwordResetRequestSchema = z.object({ email: z.email() });

export const passwordResetSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  otp: z.string().regex(/^\d{6}$/, "Enter the six-digit code"),
  password: z.string().min(12).max(128),
});
