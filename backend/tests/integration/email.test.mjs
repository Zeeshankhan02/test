import assert from "node:assert/strict";

let message = "";
const originalFetch = globalThis.fetch;

try {
  Object.assign(process.env, {
    NODE_ENV: "test",
    MONGODB_URI: "mongodb://127.0.0.1:27017/festiqo",
    FRONTEND_URL: "http://localhost:5173",
    JWT_ACCESS_SECRET: "test-access-secret-that-is-long-enough-123",
    JWT_REFRESH_SECRET: "test-refresh-secret-that-is-long-enough-456",
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    GOOGLE_REFRESH_TOKEN: "test-refresh-token",
    EMAIL_FROM: "noreply@example.test",
  });
  globalThis.fetch = async (url, options) => {
    if (url === "https://oauth2.googleapis.com/token")
      return Response.json({ access_token: "test-access-token" });
    if (url === "https://gmail.googleapis.com/gmail/v1/users/me/messages/send") {
      assert.equal(options.headers.authorization, "Bearer test-access-token");
      message = Buffer.from(JSON.parse(options.body).raw, "base64url").toString("utf8");
      return Response.json({ id: "test-message-id" });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

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
  console.log("Gmail API integration passed: OAuth-authenticated reset email was sent.");
} finally {
  globalThis.fetch = originalFetch;
}
