import mongoose, { Schema } from "mongoose";
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

export const Ticket = mongoose.model("Ticket", ticketSchema);
export const ScanLog = mongoose.model("ScanLog", scanSchema);
