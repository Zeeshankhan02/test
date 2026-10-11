import assert from "node:assert/strict";
import { SMTPServer } from "smtp-server";

let message = "";
const server = new SMTPServer({
  authMethods: ["PLAIN", "LOGIN"],
  disabledCommands: ["STARTTLS"],
  onAuth(auth, _session, callback) {
    if (auth.username !== "test-user" || auth.password !== "test-password") {
      return callback(new Error("Invalid test credentials"));
    }
    return callback(null, { user: auth.username });
  },
  onData(stream, _session, callback) {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => {
      message = Buffer.concat(chunks).toString("utf8");
      callback(null, "Message accepted");
    });
  },
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

try {
  const address = server.server.address();
  assert.ok(address && typeof address === "object");
  Object.assign(process.env, {
    NODE_ENV: "test",
    MONGODB_URI: "mongodb://127.0.0.1:27017/festiqo",
    FRONTEND_URL: "http://localhost:5173",
    JWT_ACCESS_SECRET: "test-access-secret-that-is-long-enough-123",
    JWT_REFRESH_SECRET: "test-refresh-secret-that-is-long-enough-456",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(address.port),
    SMTP_USER: "test-user",
    SMTP_PASSWORD: "test-password",
    EMAIL_FROM: "noreply@example.test",
  });

  const { emailConfigured, sendPasswordReset } =
    await import("../../dist/integrations/email/email.js");
  assert.equal(emailConfigured, true);
  await sendPasswordReset(
    { name: "Test Student", email: "student@example.test" },
    "single-use-test-token",
  );
  assert.match(message, /To: student@example\.test/i);
  assert.match(message, /single-use-test-token/);
  assert.match(message, /http:\/\/localhost:5173\/login\?reset=/);
  console.log("SMTP integration passed: authenticated reset email was delivered.");
} finally {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
