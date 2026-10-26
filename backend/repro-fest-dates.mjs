// Repro for: GET /api/v1/fest/dates -> warn-level MongooseError "Database unavailable while handling request"
// Two root causes verified here:
//  1. connectDatabase() used the driver's default 30s serverSelectionTimeoutMS, so a DB outage kept the
//     process in a half-dead state for ~40s per request (10s mongoose buffering timeout on top of a
//     30s blocking startup). Fix: fail fast with serverSelectionTimeoutMS=5000.
//  2. Connectivity-class MongooseErrors (buffering timed out / server selection) must map to a clean
//     503 DATABASE_UNAVAILABLE even if the connection flaps back to readyState=1 before the error
//     handler runs. Fix: explicit isConnectivity classification in the error handler.
import assert from "node:assert/strict";

Object.assign(process.env, {
  NODE_ENV: "test",
  MONGODB_URI: "mongodb://127.0.0.1:27017/festiqo", // nothing listening -> mongoose never connects
  FRONTEND_URL: "http://localhost:5173",
  JWT_ACCESS_SECRET: "test-access-secret-that-is-long-enough-123",
  JWT_REFRESH_SECRET: "test-refresh-secret-that-is-long-enough-456",
  SMTP_HOST: "", SMTP_PORT: "", SMTP_USER: "", SMTP_PASSWORD: "", EMAIL_FROM: "",
});

const t0 = Date.now();
const { connectDatabase } = await import("./dist/config/database.js");
let connectFailedAt = null;
try {
  await connectDatabase();
} catch {
  connectFailedAt = Date.now() - t0;
}
assert.ok(connectFailedAt !== null, "connectDatabase should reject when MongoDB is down");
assert.ok(connectFailedAt < 10000, `fail-fast expected, took ${connectFailedAt}ms`);
console.log(`PASS: connectDatabase() failed fast after ${connectFailedAt}ms`);

const mongoose = (await import("mongoose")).default;
const { default: app } = await import("./dist/app.js");
const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const port = server.address().port;

// Simulate the exact production race: query fails with a buffering-timeout
// MongooseError while the connection has already re-established (readyState 1).
const { FestConfig } = await import("./dist/modules/models.js");
const makeBufferingError = () => {
  const err = new mongoose.MongooseError(
    "FestConfig.find() buffering timed out after 10000ms",
  );
  Object.defineProperty(err, "name", { value: "MongooseError" });
  return err;
};
// The service calls FestConfig.findOne({...}).lean(); emulate a query object
// whose execution rejects with the buffering MongooseError.
FestConfig.findOne = () => {
  const promise = Promise.reject(makeBufferingError());
  const query = { lean: () => promise };
  promise.then = promise.then.bind(promise); // awaitable directly as well
  return query;
};
mongoose.connection.readyState = 1; // flap: DB "back up" but the operation had already died

const res = await fetch(`http://127.0.0.1:${port}/api/v1/fest/dates`, {
  headers: { origin: "http://localhost:5173" },
});
const body = await res.json();
assert.equal(res.status, 503);
assert.equal(body.error.code, "DATABASE_UNAVAILABLE");
console.log("PASS: connectivity MongooseError -> 503 DATABASE_UNAVAILABLE (not 502/500)");

mongoose.connection.readyState = 0;
server.close();
process.exit(0);
