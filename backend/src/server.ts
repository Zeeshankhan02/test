import { createServer } from "node:http";
import app from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { attachSocketServer, closeSocketServer } from "./sockets/socket-server.js";


console.error("FESTIQO_STARTUP_DIAGNOSTIC");

try {
  logger.info("Starting MongoDB connection");
  await connectDatabase();
  logger.info("MongoDB startup connection succeeded");
} catch (error) {
  logger.error({ err: error }, "MongoDB startup connection failed");
  throw error;
}
const server = createServer(app);
attachSocketServer(server);
server.listen(env.PORT, () => logger.info({ port: env.PORT }, "FestiQO API listening"));
const shutdown = async () => {
  await closeSocketServer();
  await disconnectDatabase();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
