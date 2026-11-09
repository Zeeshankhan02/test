import mongoose, { Schema } from "mongoose";
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
    participationType: {
      type: String,
      enum: ["individual", "team", "both"],
      default: "individual",
    },
    teamLeaderIncluded: { type: Boolean, default: true },
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
    memberIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    status: { type: String, enum: ["confirmed", "cancelled"], default: "confirmed" },
  },
  { timestamps: true },
);
registrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });
registrationSchema.index(
  { eventId: 1, memberIds: 1 },
  { unique: true, partialFilterExpression: { memberIds: { $exists: true } } },
);

export const Event = mongoose.model("Event", eventSchema);
export const Registration = mongoose.model("Registration", registrationSchema);
