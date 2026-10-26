import mongoose from "mongoose";
import { env } from "./env.js";

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

export const databaseReady = () =>
  mongoose.connection.readyState === 1;
