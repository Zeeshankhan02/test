import { z } from "zod";

export const quizAnswersSchema = z.object({
  // null marks a skipped/unanswered question (Feature 5/6 finalization);
  // a number records the selected option index.
  answers: z.array(z.union([z.number().int().min(0).max(7), z.null()])).max(100),
});
