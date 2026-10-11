import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { fail } from "../../common/errors/app-error.js";
import { Session, User } from "../models.js";
import type { Principal } from "../../middleware/authenticate.middleware.js";
import { emailConfigured, sendPasswordReset } from "../../integrations/email/email.js";
import { disconnectUserSockets } from "../../sockets/socket-server.js";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

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

export async function createStudent(input: {
  name: string;
  email: string;
  password: string;
}) {
  if (await User.exists({ email: input.email.toLowerCase() })) {
    return fail(409, "EMAIL_EXISTS", "An account already exists for this email");
  }
  const user = await User.create({
    ...input,
    email: input.email.toLowerCase(),
    role: "student",
    passwordHash: await bcrypt.hash(input.password, 12),
  });
  return {
    id: String(user._id),
    role: "student" as const,
    name: user.name,
    email: user.email,
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
  const user = await User.findById(session.userId).select("+tokenVersion");
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
  const user = await User.findOne({ email: email.toLowerCase(), active: true });
  if (!user) return;
  const token = randomBytes(32).toString("base64url");
  user.passwordResetTokenHash = digest(token);
  user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();
  try {
    await sendPasswordReset({ name: user.name, email: user.email }, token);
  } catch (error) {
    await User.updateOne(
      { _id: user._id },
      { $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } },
    );
    throw error;
  }
}

export async function completePasswordReset(token: string, password: string) {
  const user = await User.findOneAndUpdate(
    {
      passwordResetTokenHash: digest(token),
      passwordResetExpiresAt: { $gt: new Date() },
      active: true,
    },
    {
      $set: { passwordHash: await bcrypt.hash(password, 12) },
      $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
    },
    { new: true },
  );
  if (!user)
    return fail(
      400,
      "INVALID_RESET_TOKEN",
      "Password reset link is invalid or expired",
    );
  await Session.updateMany(
    { userId: user._id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
  disconnectUserSockets(String(user._id));
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
