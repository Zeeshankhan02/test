import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDatabase() {
  await mongoose.connect(env.MONGODB_URI);
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

export const databaseReady = () => mongoose.connection.readyState === 1;
