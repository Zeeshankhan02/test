import mongoose, { Schema } from "mongoose";
const quizSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    title: { type: String, required: true, trim: true },
    durationSeconds: { type: Number, required: true, min: 10, max: 7200 },
    status: { type: String, enum: ["draft", "published", "closed"], default: "draft" },
    endsAt: { type: Date },
    terminatedAt: { type: Date },
    terminatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resultsPublishedAt: { type: Date },
    resultsAnnouncedAt: { type: Date },
    qualificationCandidates: { type: [Schema.Types.Mixed], default: [] },
    qualifiedParticipants: { type: [Schema.Types.Mixed], default: [] },
    qualificationPublishedAt: Date,
    round2Rankings: { type: [Schema.Types.Mixed], default: [] },
    round2PublishedAt: Date,
    round3AdvancementLimit: { type: Number, default: 3, min: 1, max: 10 },
    round3Rankings: { type: [Schema.Types.Mixed], default: [] },
    round3PublishedAt: Date,
    winnerUserId: { type: Schema.Types.ObjectId, ref: "User" },
    winnerConfirmedAt: Date,
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
    // Overall window issued by the server when the attempt starts (Feature 5).
    overallDeadline: { type: Date },
    // Per-question authoritative timing: each question gets its own
    // server-issued deadline. -1 in `answers` marks a question that has not
    // been answered yet; null in `finalizedAt` marks one still editable.
    // Stored as plain Mixed arrays so nullable date slots keep their exact
    // runtime shape (mongoose 8 otherwise types singleNested paths oddly).
    questionDeadlines: { type: Schema.Types.Mixed, default: [] },
    // Terminal state per question: null = not finalized, Date = the moment
    // the answer for that question became immutable.
    finalizedAt: { type: Schema.Types.Mixed, default: [] },
    endedByAdminAt: Date,
    endedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
attemptSchema.index({ quizId: 1, userId: 1 }, { unique: true });

export const Quiz = mongoose.model("Quiz", quizSchema);
export const QuizAttempt = mongoose.model("QuizAttempt", attemptSchema);
