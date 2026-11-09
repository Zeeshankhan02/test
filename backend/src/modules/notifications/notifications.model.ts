import mongoose, { Schema } from "mongoose";
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
export const Notification = mongoose.model("Notification", notificationSchema);
