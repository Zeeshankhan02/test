import mongoose from "mongoose";
import { env } from "./env.js";

// Mongoose buffers (queues) operations for up to `bufferTimeoutMS` (10s by
// default) while no connection is open, then rejects them with
// "Operation `users.findOne()` buffering timed out after 10000ms" — which is
// exactly what shows up in the logs when the app never reached readyState 1.
// Keep buffering ON (the default): on a long-running server this lets queries
// issued during a brief reconnect wait briefly instead of failing outright.
// The real fix is ensuring the process actually connects at startup (see
// server.ts, which fails fast via serverSelectionTimeoutMS below).
mongoose.set("bufferCommands", true);

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
      // Fail fast (instead of hanging) if the deployment can't reach the
      // database — e.g. an IP allowlist blocking this server, a wrong/absent
      // MONGODB_URI, or a DB that is down. The resulting
      // MongoServerSelectionError message includes the full "connection
      // attempt ended" list, which tells you exactly which host/port was
      // unreachable and why (timeout = firewall/allowlist, ENOTFOUND = bad
      // URI/DNS, auth error = wrong credentials).
      serverSelectionTimeoutMS: 5000,
      // Keep the driver's background reconnect alive during brief network
      // blips so in-flight queries buffer (see bufferCommands above) instead
      // of permanently dropping the pool.
      maxPoolSize: 10,
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
