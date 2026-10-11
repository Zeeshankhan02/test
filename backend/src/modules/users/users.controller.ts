import type { RequestHandler } from "express";
import { asyncRoute } from "../../common/utils/async-route.js";
import { success } from "../../common/responses/success.js";
import { parseBody } from "../../common/validators/object-id.js";
import { changePassword } from "../auth/auth.service.js";
import { passwordChangeSchema } from "./users.validator.js";

export const getCurrentUser: RequestHandler = (req, res) => {
  const { id, role, name, email } = req.principal!;
  return success(res, { id, role, name, email });
};

export const updatePassword = asyncRoute(async (req, res) => {
  const data = parseBody(passwordChangeSchema, req.body);
  await changePassword(req.principal!.id, data.currentPassword, data.newPassword);
  return success(res, { changed: true });
});
