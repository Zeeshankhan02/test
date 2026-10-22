import { asyncRoute } from "../../common/utils/async-route.js";
import { success } from "../../common/responses/success.js";
import { objectId, parseBody } from "../../common/validators/object-id.js";
import { z } from "zod";
import {
  beginAttempt,
  finalizeAttempt,
  getAttemptState,
  saveQuestionAnswer,
  scoreAttempt,
} from "./quiz-attempts.service.js";
import { quizAnswersSchema } from "./quiz-attempts.validator.js";

const questionAnswerSchema = z.object({
  index: z.number().int().min(0).max(99),
  // null finalizes the question as skipped; a number records the choice.
  answer: z.number().int().min(0).max(7).nullable(),
});

export const startQuizAttempt = asyncRoute(async (req, res) =>
  success(
    res,
    await beginAttempt(parseBody(objectId, req.params.quizId), req.principal!.id),
    201,
  ),
);

/** Snapshot for refresh / reconnect: authoritative deadlines, never client clocks. */
export const attemptState = asyncRoute(async (req, res) =>
  success(
    res,
    await getAttemptState(parseBody(objectId, req.params.attemptId), req.principal!.id),
  ),
);

/** Idempotent per-question persistence with server-side deadline enforcement. */
export const saveAnswer = asyncRoute(async (req, res) => {
  const input = parseBody(questionAnswerSchema, req.body);
  return success(
    res,
    await saveQuestionAnswer(
      parseBody(objectId, req.params.attemptId),
      req.principal!.id,
      input.index,
      input.answer,
    ),
  );
});

/** Terminal transition built from the latest persisted answers (never dropped). */
export const finishAttempt = asyncRoute(async (req, res) =>
  success(
    res,
    await finalizeAttempt(parseBody(objectId, req.params.attemptId), req.principal!.id),
  ),
);

export const submitQuizAttempt = asyncRoute(async (req, res) => {
  const answers = parseBody(quizAnswersSchema, req.body).answers;
  const result = await scoreAttempt(
    parseBody(objectId, req.params.attemptId),
    req.principal!.id,
    answers,
  );
  return success(res, result);
});
