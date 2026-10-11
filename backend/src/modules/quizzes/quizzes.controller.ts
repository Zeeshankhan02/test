import { asyncRoute } from "../../common/utils/async-route.js";
import { success } from "../../common/responses/success.js";
import { objectId, parseBody } from "../../common/validators/object-id.js";
import {
  addQuiz,
  changeQuizStatus,
  editQuiz,
  getPublishedQuizzes,
} from "./quizzes.service.js";
import { quizInput, quizUpdateInput } from "./quizzes.validator.js";

export const listPublishedQuizzes = asyncRoute(async (req, res) =>
  success(
    res,
    await getPublishedQuizzes(
      req.principal!.id,
      req.principal!.role as "student" | "admin",
    ),
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
