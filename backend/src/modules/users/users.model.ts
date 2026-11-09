import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { randomInt } from "node:crypto";
export const newAvatarUrl = () =>
  `https://cataas.com/avatar/cat${randomInt(1_000_000, 2_147_483_647)}`;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    avatar: { type: String, default: newAvatarUrl },
    passwordHash: { type: String, required: true, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    role: { type: String, enum: ["student", "volunteer", "admin"], required: true },
    active: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0, select: false },
  },
  { timestamps: true },
);
userSchema.index({ passwordResetTokenHash: 1 }, { unique: true, sparse: true });
userSchema.index({ avatar: 1 }, { unique: true, sparse: true });

const authOtpSchema = new Schema(
  {
    _id: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    purpose: { type: String, enum: ["signup", "password_reset"], required: true },
    codeHash: { type: String, required: true },
    name: { type: String, trim: true, maxlength: 100 },
    passwordHash: { type: String, select: false },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    sentAt: { type: Date, required: true },
  },
  { timestamps: true },
);

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: Date,
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
export const AuthOtp = mongoose.model("AuthOtp", authOtpSchema);
export const Session = mongoose.model("Session", sessionSchema);
export type UserRecord = InferSchemaType<typeof userSchema>;
