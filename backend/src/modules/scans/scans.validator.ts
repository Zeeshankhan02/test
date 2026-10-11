import { z } from "zod";

export const scanInput = z.object({ credential: z.string().min(32).max(128) });
