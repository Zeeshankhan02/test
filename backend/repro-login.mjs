import assert from "node:assert/strict";

Object.assign(process.env, {
  NODE_ENV: "test",
  MONGODB_URI: "mongodb://127.0.0.1:27017/festiqo", // nothing listening -> mongoose never connects
  FRONTEND_URL: "http://localhost:5173",
  JWT_ACCESS_SECRET: "test-access-secret-that-is-long-enough-123",
  JWT_REFRESH_SECRET: "test-refresh-secret-that-is-long-enough-456",
  SMTP_HOST: "", SMTP_PORT: "", SMTP_USER: "", SMTP_PASSWORD: "", EMAIL_FROM: "",
});

const { default: app } = await import("./dist/app.js");
const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const port = server.address().port;

// Give mongoose a moment to attempt (and fail) buffering commands
await new Promise((r) => setTimeout(r, 12000));

const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: "http://localhost:5173" },
  body: JSON.stringify({ email: "student@example.com", password: "whatever-123" }),
});
console.log("STATUS:", res.status);
console.log("BODY:", JSON.stringify(await res.json()));
server.close();
process.exit(0);
