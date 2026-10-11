import assert from "node:assert/strict";

Object.assign(process.env, {
  NODE_ENV: "test",
  MONGODB_URI: "mongodb://127.0.0.1:27017/festiqo",
  FRONTEND_URL: "http://localhost:5173",
  JWT_ACCESS_SECRET: "test-access-secret-that-is-long-enough-123",
  JWT_REFRESH_SECRET: "test-refresh-secret-that-is-long-enough-456",
  SMTP_HOST: "",
  SMTP_PORT: "",
  SMTP_USER: "",
  SMTP_PASSWORD: "",
  EMAIL_FROM: "",
});
const { default: app } = await import("../../dist/app.js");
const server = app.listen(0);
try {
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;
  assert.equal((await fetch(`${origin}/health/live`)).status, 200);
  const corsAllowed = await fetch(`${origin}/health/live`, {
    headers: { origin: "http://localhost:5173" },
  });
  assert.equal(corsAllowed.status, 200);
  assert.equal(
    corsAllowed.headers.get("access-control-allow-origin"),
    "http://localhost:5173",
  );
  assert.equal(
    (await fetch(`${origin}/health/live`, { headers: { origin: "https://evil.test" } }))
      .status,
    403,
  );
  assert.equal((await fetch(`${origin}/health/ready`)).status, 503);
  const authResponse = await fetch(`${origin}/api/v1/auth/me`);
  assert.equal(authResponse.status, 401);
  assert.equal((await fetch(`${origin}/api/v1/quizzes`)).status, 401);
  assert.ok(authResponse.headers.get("x-request-id"));
  assert.equal(authResponse.headers.get("ratelimit-limit"), null);
  const validationResponse = await fetch(`${origin}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(validationResponse.status, 400);
  assert.equal((await validationResponse.json()).error.code, "VALIDATION_ERROR");
  const csrfResponse = await fetch(`${origin}/api/v1/auth/logout`, {
    method: "POST",
    headers: { cookie: "refreshToken=present" },
  });
  assert.equal(csrfResponse.status, 403);
  const resetResponse = await fetch(`${origin}/api/v1/auth/password/forgot`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "nobody@example.com" }),
  });
  assert.equal(resetResponse.status, 200);
  assert.match(
    (await resetResponse.json()).data.message,
    /email delivery is configured/,
  );
  for (let request = 0; request < 12; request += 1) {
    assert.equal(
      (
        await fetch(`${origin}/api/v1/auth/signup`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        })
      ).status,
      400,
    );
  }
  const additionalResponse = await fetch(`${origin}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(additionalResponse.status, 400);
  console.log("Health endpoint checks passed.");
} finally {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
