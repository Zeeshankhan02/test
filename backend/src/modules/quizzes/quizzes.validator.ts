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

export const qualificationPublishInput = z.object({
  userIds: z.array(objectId).min(1).max(20),
  reason: z.string().trim().max(500).optional(),
});
export const qualificationCorrectionInput = z.object({
  userIds: z.array(objectId).min(1).max(20),
  reason: z.string().trim().min(1).max(500),
});
const rankingEntry = z.object({
  userId: objectId,
  rank: z.number().int().min(1).max(10),
  score: z.number().finite().min(0).optional(),
  notes: z.string().trim().max(500).optional(),
});
export const round2DraftInput = z.object({
  rankings: z.array(rankingEntry).min(1).max(10),
  advancementLimit: z.number().int().min(1).max(10).default(3),
});
export const round3DraftInput = z.object({ rankings: z.array(rankingEntry).min(1).max(10) });
export const rankingCorrectionInput = z.object({
  rankings: z.array(rankingEntry).min(1).max(10),
  reason: z.string().trim().min(1).max(500),
});
