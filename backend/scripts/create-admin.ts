import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { User } from "../src/modules/models.js";

const input = z
  .object({
    ADMIN_EMAIL: z.email(),
    ADMIN_PASSWORD: z.string().min(16).max(128),
    ADMIN_NAME: z.string().min(1).max(100).default("Fest Administrator"),
  })
  .parse(process.env);
await connectDatabase();
await User.create({
  email: input.ADMIN_EMAIL.toLowerCase(),
  name: input.ADMIN_NAME,
  passwordHash: await bcrypt.hash(input.ADMIN_PASSWORD, 12),
  role: "admin",
});
console.log(`Administrator provisioned for ${input.ADMIN_EMAIL.toLowerCase()}`);
await disconnectDatabase();
