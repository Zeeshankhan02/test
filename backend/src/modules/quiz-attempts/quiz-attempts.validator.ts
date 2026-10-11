import { z } from "zod";

export const quizAnswersSchema = z.object({
  answers: z.array(z.number().int().min(0).max(7)).max(100),
});
