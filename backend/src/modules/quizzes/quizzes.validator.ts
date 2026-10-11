import { z } from "zod";
import { objectId } from "../../common/validators/object-id.js";

export const quizInput = z.object({
  eventId: objectId,
  title: z.string().trim().min(1).max(160),
  durationSeconds: z.number().int().min(10).max(7200),
  status: z.enum(["draft", "published"]).default("draft"),
  questions: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(1000),
        options: z.array(z.string().trim().min(1).max(300)).min(2).max(8),
        correctAnswer: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(100),
});

export const quizUpdateInput = quizInput.partial().omit({ status: true });
