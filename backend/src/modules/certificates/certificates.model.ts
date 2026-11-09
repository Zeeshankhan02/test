import mongoose, { Schema } from "mongoose";
const certificateTemplateSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    certificateType: {
      type: String,
      enum: ["participation", "winner"],
      default: "participation",
    },
    signatureName: { type: String, required: true },
    signatureRole: { type: String, required: true },
    logoUrl: { type: String, trim: true, maxlength: 2048 },
    signatureImageUrl: { type: String, trim: true, maxlength: 2048 },
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
    eventId: { type: Schema.Types.ObjectId, ref: "Event" },
    recipientName: { type: String, required: true, maxlength: 140 },
    certificateId: { type: String, required: true, unique: true },
    awardType: {
      type: String,
      enum: ["participation", "winner"],
      default: "participation",
    },
    competitionId: { type: Schema.Types.ObjectId, ref: "Quiz" },
    rank: { type: Number, min: 1, max: 3 },
    issuedAt: { type: Date, default: Date.now },
    publishedAt: Date,
    staleAt: Date,
    revokedAt: Date,
  },
  { timestamps: true },
);
certificateSchema.index(
  { eventId: 1, registrationId: 1, awardType: 1, competitionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      eventId: { $exists: true },
      staleAt: null,
      revokedAt: null,
    },
  },
);
certificateSchema.index({ competitionId: 1, registrationId: 1, rank: 1 });

export const CertificateTemplate = mongoose.model(
  "CertificateTemplate",
  certificateTemplateSchema,
);
export const Certificate = mongoose.model("Certificate", certificateSchema);
