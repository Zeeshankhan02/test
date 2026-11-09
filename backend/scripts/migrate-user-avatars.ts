import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { newAvatarUrl, User } from "../src/modules/models.js";

try {
  await mongoose.connect(env.MONGODB_URI);
  await User.collection.createIndex({ avatar: 1 }, { unique: true, sparse: true });
  const users = await User.collection.find({ avatar: { $exists: false } }).project({ _id: 1 }).toArray();
  let saved = 0;
  for (const user of users) {
    let assigned = false;
    while (!assigned) {
      try {
        saved += (await User.collection.updateOne(
          { _id: user._id, avatar: { $exists: false } },
          { $set: { avatar: newAvatarUrl() } },
        )).modifiedCount;
        assigned = true;
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
      }
    }
  }
  console.info(`Saved unique default avatars for ${saved} existing users.`);
} finally {
  await mongoose.disconnect();
}
