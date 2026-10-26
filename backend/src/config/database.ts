import mongoose from "mongoose";
import { env } from "./env.js";

/**
 * Fail fast when MongoDB is unreachable instead of hanging for the driver's
 * default 30s server-selection window. Without this, `await connect()` in
 * server.ts blocks startup for ~30s while mongoose's 10s operation-buffering
 * timeout has already started rejecting incoming queries with MongooseError
 * ("buffering timed out"), so every request (e.g. GET /fest/dates) spends up
 * to 40s in a half-dead state before anything surfaces. A short selection
 * timeout makes connection failures deterministic and quick; the driver keeps
 * its normal background reconnect behavior afterwards.
 */
const SERVER_SELECTION_TIMEOUT_MS = 5000;

export async function connectDatabase() {
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
  });
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

export const databaseReady = () => mongoose.connection.readyState === 1;
