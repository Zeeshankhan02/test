import { asyncRoute } from "../../common/utils/async-route.js";
import { success } from "../../common/responses/success.js";
import { objectId, parseBody } from "../../common/validators/object-id.js";
import { quizInput, quizUpdateInput } from "./quizzes.validator.js";
import {
  addQuiz,
  announceQuizResults,
  changeQuizStatus,
  editQuiz,
  getMyQuizResult,
  getPublishedQuizzes,
  getQuizResultsSummary,
  listQuizResultRows,
  listQuizzesForAdmin,
  publishQuizResults,
} from "./quizzes.service.js";
import {
  resumeFinalization,
  terminateQuiz,
} from "../quiz-attempts/quiz-attempts.service.js";

export const listPublishedQuizzes = asyncRoute(async (req, res) =>
  success(
    res,
    await getPublishedQuizzes(
      req.principal!.id,
      req.principal!.role as "student" | "admin",
    ),
  ),
);

export const adminQuizList = asyncRoute(async (req, res) =>
  success(res, await listQuizzesForAdmin(req.principal!.id)),
);

export const resultsSummary = asyncRoute(async (req, res) =>
  success(
    res,
    await getQuizResultsSummary(
      req.principal!.id,
      parseBody(objectId, req.params.quizId),
    ),
  ),
);

export const resultsRows = asyncRoute(async (req, res) =>
  success(
    res,
    await listQuizResultRows(req.principal!.id, parseBody(objectId, req.params.quizId)),
  ),
);

export const publishResults = asyncRoute(async (req, res) =>
  success(
    res,
    await publishQuizResults(req.principal!.id, parseBody(objectId, req.params.quizId)),
  ),
);

export const announceResults = asyncRoute(async (req, res) =>
  success(
    res,
    await announceQuizResults(
      req.principal!.id,
      parseBody(objectId, req.params.quizId),
    ),
  ),
);

export const myQuizResult = asyncRoute(async (req, res) =>
  success(
    res,
    await getMyQuizResult(req.principal!.id, parseBody(objectId, req.params.quizId)),
  ),
);

export const endQuizEarly = asyncRoute(async (req, res) =>
  success(
    res,
    await terminateQuiz(req.principal!.id, parseBody(objectId, req.params.quizId)),
  ),
);

export const createQuiz = asyncRoute(async (req, res) => {
  const input = parseBody(quizInput, req.body);
  return success(res, await addQuiz(req.principal!.id, input), 201);
});

export const updateQuiz = asyncRoute(async (req, res) => {
  const id = parseBody(objectId, req.params.quizId);
  const input = parseBody(quizUpdateInput, req.body);
  return success(res, await editQuiz(req.principal!.id, id, input));
});

export const publishQuiz = asyncRoute(async (req, res) =>
  success(
    res,
    await changeQuizStatus(
      req.principal!.id,
      parseBody(objectId, req.params.quizId),
      "draft",
      "published",
    ),
  ),
);

export const closeQuiz = asyncRoute(async (req, res) =>
  success(
    res,
    await changeQuizStatus(
      req.principal!.id,
      parseBody(objectId, req.params.quizId),
      "published",
      "closed",
    ),
  ),
);

/** Idempotent retry of attempt finalization after a partial failure. */
export const retryFinalization = asyncRoute(async (req, res) =>
  success(
    res,
    await resumeFinalization(req.principal!.id, parseBody(objectId, req.params.quizId)),
  ),
);
