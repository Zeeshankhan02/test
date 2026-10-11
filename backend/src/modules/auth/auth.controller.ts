import { env } from "../../config/env.js";
import { asyncRoute } from "../../common/utils/async-route.js";
import { parseBody } from "../../common/validators/object-id.js";
import { success } from "../../common/responses/success.js";
import {
  completePasswordReset,
  createStudent,
  issueSession,
  login,
  requestPasswordReset,
  revokeSession,
  rotateSession,
} from "./auth.service.js";
import {
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  signupSchema,
} from "./auth.validator.js";

const refreshCookie = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAME_SITE as "strict" | "lax" | "none",
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  path: "/api/v1/auth",
  maxAge: env.JWT_REFRESH_TTL_SECONDS * 1000,
};

export const signup = asyncRoute(async (req, res) => {
  const user = await createStudent(parseBody(signupSchema, req.body));
  const session = await issueSession(user);
  res.cookie("refreshToken", session.refreshToken, refreshCookie);
  return success(res, { accessToken: session.accessToken, user: session.user }, 201);
});

export const signIn = asyncRoute(async (req, res) => {
  const session = await login(parseBody(loginSchema, req.body));
  res.cookie("refreshToken", session.refreshToken, refreshCookie);
  return success(res, { accessToken: session.accessToken, user: session.user });
});

export const refresh = asyncRoute(async (req, res) => {
  const session = await rotateSession(req.cookies.refreshToken ?? "");
  res.cookie("refreshToken", session.refreshToken, refreshCookie);
  return success(res, { accessToken: session.accessToken, user: session.user });
});

export const logout = asyncRoute(async (req, res) => {
  await revokeSession(req.cookies.refreshToken);
  res.clearCookie("refreshToken", { ...refreshCookie, maxAge: undefined });
  return success(res, { loggedOut: true });
});

export const forgotPassword = asyncRoute(async (req, res) => {
  const { email } = parseBody(passwordResetRequestSchema, req.body);
  await requestPasswordReset(email.toLowerCase());
  return success(res, {
    message:
      "If an active account exists and email delivery is configured, password reset instructions have been sent.",
  });
});

export const resetPassword = asyncRoute(async (req, res) => {
  const { token, password } = parseBody(passwordResetSchema, req.body);
  await completePasswordReset(token, password);
  return success(res, { changed: true });
});
