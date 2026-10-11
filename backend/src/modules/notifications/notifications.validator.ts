import { z } from "zod";

export const notificationBroadcastSchema = z.object({
  title: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(2000),
  audience: z.enum(["students", "volunteers", "all"]),
});
