import mongoose from "mongoose";
import { env } from "./env.js";

// Mongoose buffers (queues) operations for up to `bufferTimeoutMS` (10s by
// default) while no connection is open, then rejects them with
// "Operation `users.findOne()` buffering timed out after 10000ms". On
// serverless platforms (e.g. Vercel) every invocation starts a brand-new
// process and the cold start may not have completed `connectDatabase()` yet,
// so requests that arrive before the socket is established hit this timeout.
// Disabling buffering makes those queries fail fast (~2s, bounded by
// serverSelectionTimeoutMS) with a clear server-selection error instead of
// hanging for 10 seconds; the error handler already maps them to 503.
mongoose.set("bufferCommands", false);

mongoose.connection.on("connected", () => {
  console.info("MongoDB connected");
});

mongoose.connection.on("disconnected", () => {
  console.error("MongoDB disconnected");
});

mongoose.connection.on("error", (error) => {
  console.error("MongoDB connection error", {
    name: error.name,
    message: error.message,
  });
});

export async function connectDatabase() {
  try {
    if (mongoose.connection.readyState !== 0) return mongoose.connection;
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.info("MongoDB initialization successful", {
      readyState: mongoose.connection.readyState,
      database: mongoose.connection.name,
    });

    return mongoose.connection;
  } catch (error) {
    console.error("MongoDB initialization failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

export const databaseReady = () => mongoose.connection.readyState === 1;
