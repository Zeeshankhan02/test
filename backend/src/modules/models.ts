import mongoose, { Schema, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
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

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: Date,
  },
  { timestamps: true },
);

const eventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, required: true, maxlength: 5000 },
    category: { type: String, required: true, trim: true },
    venue: { type: String, required: true, trim: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    registrationDeadline: Date,
    capacity: { type: Number, required: true, min: 1 },
    registeredCount: { type: Number, default: 0, min: 0 },
    teamMin: { type: Number, default: 1, min: 1 },
    teamMax: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: ["draft", "published", "cancelled", "archived"],
      default: "draft",
      index: true,
    },
    image: String,
    imagePublicId: String,
  },
  { timestamps: true },
);
eventSchema.index({ status: 1, startsAt: 1, category: 1 });

const registrationSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    teamName: { type: String, trim: true, maxlength: 100 },
    members: [{ type: String, trim: true, maxlength: 100 }],
    status: { type: String, enum: ["confirmed", "cancelled"], default: "confirmed" },
  },
  { timestamps: true },
);
registrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });

const ticketSchema = new Schema(
  {
    registrationId: {
      type: Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
      unique: true,
    },
    credentialId: { type: String, select: false },
    credentialHash: { type: String, required: true, unique: true, select: false },
    credentialCiphertext: { type: String, select: false },
    credentialIv: { type: String, select: false },
    credentialTag: { type: String, select: false },
    status: {
      type: String,
      enum: ["active", "checked_in", "cancelled", "revoked"],
      default: "active",
    },
  },
  { timestamps: true },
);
ticketSchema.index({ credentialId: 1 }, { unique: true, sparse: true });

const scanSchema = new Schema(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket" },
    volunteerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    participantName: { type: String, maxlength: 140 },
    teamName: { type: String, maxlength: 100 },
    eventName: { type: String, maxlength: 140 },
    scannedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: [
        "valid_entry",
        "already_scanned",
        "invalid_ticket",
        "cancelled_ticket",
        "wrong_event",
      ],
      required: true,
    },
  },
  { timestamps: true },
);
scanSchema.index(
  { ticketId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "valid_entry" } },
);

const quizSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    title: { type: String, required: true, trim: true },
    durationSeconds: { type: Number, required: true, min: 10, max: 7200 },
    status: { type: String, enum: ["draft", "published", "closed"], default: "draft" },
    questions: [
      {
        text: { type: String, required: true },
        options: [{ type: String, required: true }],
        correctAnswer: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true },
);
const attemptSchema = new Schema(
  {
    quizId: { type: Schema.Types.ObjectId, ref: "Quiz", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startedAt: { type: Date, default: Date.now },
    submittedAt: Date,
    answers: [Number],
    score: Number,
  },
  { timestamps: true },
);
attemptSchema.index({ quizId: 1, userId: 1 }, { unique: true });

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["result", "event", "registration", "announcement", "system"],
      default: "announcement",
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);
const certificateTemplateSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    signatureName: { type: String, required: true },
    signatureRole: { type: String, required: true },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
  },
  { timestamps: true },
);
const certificateSchema = new Schema(
  {
    templateId: {
      type: Schema.Types.ObjectId,
      ref: "CertificateTemplate",
      required: true,
    },
    registrationId: {
      type: Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipientName: { type: String, required: true, maxlength: 140 },
    certificateId: { type: String, required: true, unique: true },
    issuedAt: { type: Date, default: Date.now },
    revokedAt: Date,
  },
  { timestamps: true },
);
certificateSchema.index({ templateId: 1, registrationId: 1 }, { unique: true });

const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true, maxlength: 100 },
    resourceType: { type: String, required: true, maxlength: 100 },
    resourceId: { type: String, required: true, maxlength: 100 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, strict: "throw" },
);
auditLogSchema.index({ createdAt: -1, action: 1 });

export const User = mongoose.model("User", userSchema);
export const Session = mongoose.model("Session", sessionSchema);
export const Event = mongoose.model("Event", eventSchema);
export const Registration = mongoose.model("Registration", registrationSchema);
export const Ticket = mongoose.model("Ticket", ticketSchema);
export const ScanLog = mongoose.model("ScanLog", scanSchema);
export const Quiz = mongoose.model("Quiz", quizSchema);
export const QuizAttempt = mongoose.model("QuizAttempt", attemptSchema);
export const Notification = mongoose.model("Notification", notificationSchema);
export const CertificateTemplate = mongoose.model(
  "CertificateTemplate",
  certificateTemplateSchema,
);
export const Certificate = mongoose.model("Certificate", certificateSchema);
export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
export type UserRecord = InferSchemaType<typeof userSchema>;
