import bcrypt from "bcryptjs";
import { fail } from "../../common/errors/app-error.js";
import { recordAudit } from "../../common/utils/audit.js";
import { disconnectUserSockets } from "../../sockets/socket-server.js";
import { Session, User } from "../models.js";

export async function getVolunteers() {
  return User.find({ role: "volunteer" }).select("name email active createdAt").lean();
}

export async function addVolunteer(
  adminId: string,
  input: { name: string; email: string; password: string },
) {
  const user = await User.create({
    ...input,
    email: input.email.toLowerCase(),
    passwordHash: await bcrypt.hash(input.password, 12),
    role: "volunteer",
  });
  await recordAudit(adminId, "volunteer.created", "user", String(user._id));
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    active: user.active,
  };
}

export async function setVolunteerStatus(
  adminId: string,
  userId: string,
  active: boolean,
) {
  const user = await User.findOneAndUpdate(
    { _id: userId, role: "volunteer" },
    { $set: { active }, ...(!active ? { $inc: { tokenVersion: 1 } } : {}) },
    { new: true },
  ).select("name email active");
  if (!user) return fail(404, "NOT_FOUND", "Volunteer not found");
  if (!active) {
    await Session.updateMany(
      { userId: user._id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
    disconnectUserSockets(String(user._id));
  }
  await recordAudit(adminId, "volunteer.status_changed", "user", String(user._id), {
    active,
  });
  return user;
}
