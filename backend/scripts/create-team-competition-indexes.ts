import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { Certificate, Registration } from "../src/modules/models.js";

try {
  await mongoose.connect(env.MONGODB_URI);
  await Promise.all([Registration.createIndexes(), Certificate.createIndexes()]);
  console.info("Team and competition indexes are ready.");
} finally {
  await mongoose.disconnect();
}
