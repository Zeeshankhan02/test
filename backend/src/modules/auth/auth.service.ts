import { createHmac, randomBytes, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { fail } from "../../common/errors/app-error.js";
import { AuthOtp, Session, User } from "../models.js";
import type { Principal } from "../../middleware/authenticate.middleware.js";
import { emailConfigured, sendAuthOtp } from "../../integrations/email/email.js";
import { disconnectUserSockets } from "../../sockets/socket-server.js";

const digest = (value: string) => createHmac("sha256", env.JWT_ACCESS_SECRET).update(value).digest("hex");
const otpDigest = (email: string, purpose: string, code: string) =>
  digest(`${email}:${purpose}:${code}`);
const otpChallengeId = (email: string, purpose: string) => digest(`challenge:${purpose}:${email}`);
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_WAIT_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

async function revokeUserSessions(userId: string) {
  await Promise.all([
    Session.updateMany(
      { userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    ),
    User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } }),
  ]);
  disconnectUserSockets(userId);
}

export async function issueSession(user: Principal) {
  const accessToken = jwt.sign(
    {
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      ver: user.tokenVersion || 0,
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_TTL_SECONDS,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      jwtid: randomBytes(16).toString("base64url"),
    },
  );
  const refreshToken = randomBytes(48).toString("base64url");
  await Session.create({
    userId: user.id,
    tokenHash: digest(refreshToken),
    expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000),
  });
  const { tokenVersion: _tokenVersion, ...safeUser } = user;
  return { accessToken, refreshToken, user: safeUser };
}

async function sendOtp(input: {
  email: string;
  name: string;
  purpose: "signup" | "password_reset";
  passwordHash?: string;
  userId?: string;
}) {
  if (!emailConfigured)
    return fail(503, "EMAIL_UNAVAILABLE", "Email verification is not configured");
  const now = new Date();
  const _id = otpChallengeId(input.email, input.purpose);
  const current = await AuthOtp.findById(_id);
  if (current && now.getTime() - current.sentAt.getTime() < OTP_RESEND_WAIT_MS) {
    if (input.purpose === "password_reset") return;
    return fail(429, "OTP_RESEND_WAIT", "Wait a minute before requesting another code");
  }
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const codeHash = otpDigest(input.email, input.purpose, code);
  await AuthOtp.findOneAndUpdate(
    { _id },
    {
      $set: {
        codeHash,
        attempts: 0,
        sentAt: now,
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        ...(input.name ? { name: input.name } : {}),
        ...(input.passwordHash ? { passwordHash: input.passwordHash } : {}),
        ...(input.userId ? { userId: input.userId } : {}),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  try {
    await sendAuthOtp({ name: input.name, email: input.email }, code, input.purpose);
  } catch (error) {
    await AuthOtp.deleteOne({ _id, codeHash });
    if (input.purpose === "password_reset") return;
    throw error;
  }
}

async function consumeOtp(email: string, purpose: "signup" | "password_reset", code: string) {
  const challenge = await AuthOtp.findOneAndDelete({
    _id: otpChallengeId(email, purpose),
    codeHash: otpDigest(email, purpose, code),
    expiresAt: { $gt: new Date() },
    attempts: { $lt: OTP_MAX_ATTEMPTS },
  }).select("+passwordHash");
  if (challenge) return challenge;
  await AuthOtp.updateOne(
    { email, purpose, expiresAt: { $gt: new Date() }, attempts: { $lt: OTP_MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
  );
  return fail(400, "INVALID_OTP", "The code is invalid or expired");
}

export async function requestStudentSignupOtp(input: {
  name: string;
  email: string;
  password: string;
}) {
  const email = input.email.toLowerCase();
  if (await User.exists({ email })) {
    return fail(409, "EMAIL_EXISTS", "An account already exists for this email");
  }
  await sendOtp({
    email,
    name: input.name,
    purpose: "signup",
    passwordHash: await bcrypt.hash(input.password, 12),
  });
}

export async function verifyStudentSignupOtp(emailInput: string, code: string) {
  const email = emailInput.toLowerCase();
  const challenge = await consumeOtp(email, "signup", code);
  if (!challenge.name || !challenge.passwordHash)
    return fail(400, "INVALID_OTP", "The code is invalid or expired");
  let user;
  try {
    user = await User.create({
      name: challenge.name,
      email,
      role: "student",
      passwordHash: challenge.passwordHash,
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000)
      return fail(409, "EMAIL_EXISTS", "An account already exists for this email");
    throw error;
  }
  return {
    id: String(user._id),
    role: "student" as const,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    tokenVersion: user.tokenVersion || 0,
  };
}

export async function login(input: { email: string; password: string }) {
  const user = await User.findOne({ email: input.email.toLowerCase() }).select(
    "+passwordHash +tokenVersion",
  );
  if (
    !user ||
    !user.active ||
    !(await bcrypt.compare(input.password, user.passwordHash))
  ) {
    return fail(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }
  return issueSession({
    id: String(user._id),
    role: user.role as Principal["role"],
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    tokenVersion: user.tokenVersion || 0,
  });
}

export async function rotateSession(token: string) {
  const hash = digest(token);
  const existing = await Session.findOne({ tokenHash: hash });
  if (!existing || existing.expiresAt <= new Date()) {
    return fail(401, "INVALID_SESSION", "Refresh session is invalid or expired");
  }
  if (existing.revokedAt) {
    await revokeUserSessions(String(existing.userId));
    return fail(401, "SESSION_REUSE", "Refresh token reuse detected; sign in again");
  }
  const session = await Session.findOneAndUpdate(
    { _id: existing._id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
    { new: true },
  );
  if (!session) {
    await revokeUserSessions(String(existing.userId));
    return fail(401, "SESSION_REUSE", "Refresh token reuse detected; sign in again");
  }
  const user = await User.findById(session.userId).select(
    "_id role name email active avatar +tokenVersion",
  );
  if (!user?.active) {
    session.revokedAt = new Date();
    await session.save();
    return fail(401, "INVALID_SESSION", "Refresh session is invalid or expired");
  }
  return issueSession({
    id: String(user._id),
    role: user.role as Principal["role"],
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    tokenVersion: user.tokenVersion || 0,
  });
}

export async function revokeSession(token?: string) {
  if (token) {
    const session = await Session.findOne({ tokenHash: digest(token) });
    if (session) await revokeUserSessions(String(session.userId));
  }
}

export async function requestPasswordReset(email: string) {
  if (!emailConfigured) return;
  const user = await User.findOne({
    email: email.toLowerCase(),
    active: true,
    role: { $in: ["student", "admin"] },
  });
  if (!user) return;
  await sendOtp({
    email: user.email,
    name: user.name,
    purpose: "password_reset",
    userId: String(user._id),
  });
}

export async function completePasswordReset(emailInput: string, code: string, password: string) {
  const email = emailInput.toLowerCase();
  const challenge = await consumeOtp(email, "password_reset", code);
  const user = await User.findOneAndUpdate(
    { _id: challenge.userId, email, active: true, role: { $in: ["student", "admin"] } },
    {
      $set: { passwordHash: await bcrypt.hash(password, 12) },
      $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
    },
    { new: true },
  );
  if (!user) return fail(400, "INVALID_OTP", "The code is invalid or expired");
  await revokeUserSessions(String(user._id));
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await User.findById(userId).select("+passwordHash +tokenVersion");
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return fail(400, "INVALID_PASSWORD", "Current password is incorrect");
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  await Session.updateMany(
    { userId: user._id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
  disconnectUserSockets(String(user._id));
}
