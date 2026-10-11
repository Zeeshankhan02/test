import { asyncRoute } from "../../common/utils/async-route.js";
import { success } from "../../common/responses/success.js";
import { objectId, parseBody } from "../../common/validators/object-id.js";
import { beginAttempt, scoreAttempt } from "./quiz-attempts.service.js";
import { quizAnswersSchema } from "./quiz-attempts.validator.js";

export const startQuizAttempt = asyncRoute(async (req, res) =>
  success(
    res,
    await beginAttempt(parseBody(objectId, req.params.quizId), req.principal!.id),
    201,
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
