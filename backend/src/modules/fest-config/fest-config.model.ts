import mongoose, { Schema } from "mongoose";
const festConfigSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "current" },
    title: { type: String, trim: true, maxlength: 140 },
    startsAt: { type: Date },
    endsAt: { type: Date },
    timezone: { type: String, trim: true, maxlength: 64 },
    venue: { type: String, trim: true, maxlength: 140 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const FestConfig = mongoose.model("FestConfig", festConfigSchema);
