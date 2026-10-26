import { MongoMemoryReplSet } from "mongodb-memory-server";
const rs = await MongoMemoryReplSet.create({ replSet: { count: 1, dbName: "test" } });
process.env.TEST_MONGODB_URI = rs.getUri();
await import("./tests/e2e/workflows.test.mjs");
console.log("E2E PASSED");
await rs.stop();
process.exit(0);
