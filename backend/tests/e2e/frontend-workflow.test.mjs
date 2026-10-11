import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { chromium } from "playwright-core";

const source = process.env.TEST_MONGODB_URI;
assert.ok(source, "Set TEST_MONGODB_URI to a disposable MongoDB replica-set URI");
const databaseUri = new URL(source);
assert.ok(
  databaseUri.searchParams.has("replicaSet") || databaseUri.protocol === "mongodb+srv:",
  "TEST_MONGODB_URI must target a replica set or sharded cluster",
);
databaseUri.pathname = `/festiqo_e2e_${randomUUID().replaceAll("-", "").slice(0, 26)}`;

const frontendDirectory = resolve(import.meta.dirname, "../../..", "frontend");
const frontendOrigin = `http://127.0.0.1:${await freePort()}`;
const apiPort = await freePort();
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const apiBase = `${apiOrigin}/api/v1`;
const password = "Browser-e2e-password-2026!";
const eventTitle = `Browser E2E ${randomUUID().slice(0, 8)}`;
const browserErrors = [];
let httpServer;
let browser;
let viteProcess;

Object.assign(process.env, {
  NODE_ENV: "test",
  MONGODB_URI: databaseUri.toString(),
  FRONTEND_URL: frontendOrigin,
  CORS_ORIGINS: "",
  JWT_ACCESS_SECRET: "browser-test-access-secret-is-long-enough-123",
  JWT_REFRESH_SECRET: "browser-test-refresh-secret-is-long-enough-456",
  SMTP_HOST: "",
  SMTP_PORT: "",
  SMTP_USER: "",
  SMTP_PASSWORD: "",
  EMAIL_FROM: "",
});

async function freePort() {
  const server = createNetServer();
  await new Promise((resolve, reject) =>
    server.once("error", reject).listen(0, "127.0.0.1", resolve),
  );
  const port = server.address().port;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function waitForServer(child, url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(`Vite exited early (${child.exitCode})`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Vite did not start within 30 seconds");
}

await mongoose.connect(databaseUri.toString());
const { Event, Registration, Ticket, User } =
  await import("../../dist/modules/models.js");
const { default: app } = await import("../../dist/app.js");
const { attachSocketServer, closeSocketServer } =
  await import("../../dist/sockets/socket-server.js");

try {
  await mongoose.connection.dropDatabase();
  const volunteerEmail = `volunteer.${randomUUID().slice(0, 8)}@example.test`;
  await User.create({
    name: "Browser Volunteer",
    email: volunteerEmail,
    passwordHash: await bcrypt.hash(password, 12),
    role: "volunteer",
  });
  await Event.create({
    title: eventTitle,
    description: "Frontend registration and digital ticket workflow.",
    category: "Technical",
    venue: "Browser test hall",
    startsAt: new Date(Date.now() + 86_400_000),
    endsAt: new Date(Date.now() + 172_800_000),
    capacity: 4,
    teamMin: 1,
    teamMax: 1,
    status: "published",
  });

  httpServer = createServer(app);
  attachSocketServer(httpServer);
  await new Promise((resolve, reject) =>
    httpServer.once("error", reject).listen(apiPort, "127.0.0.1", resolve),
  );

  const viteCli = resolve(frontendDirectory, "node_modules/vite/bin/vite.js");
  viteProcess = spawn(
    process.execPath,
    [
      viteCli,
      "--host",
      "127.0.0.1",
      "--port",
      new URL(frontendOrigin).port,
      "--strictPort",
    ],
    {
      cwd: frontendDirectory,
      env: { ...process.env, VITE_API_URL: apiBase },
      stdio: "inherit",
    },
  );
  await waitForServer(viteProcess, `${frontendOrigin}/signup`);

  const executablePath =
    process.env.CHROME_PATH ||
    (process.platform === "win32"
      ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
      : undefined);
  browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("response", (response) => {
    if (
      response.url().startsWith(apiBase) &&
      response.status() >= 400 &&
      !response.url().endsWith("/auth/refresh")
    ) {
      browserErrors.push(`API ${response.status()} ${response.url()}`);
    }
  });

  let resumeInitialRefresh;
  const initialRefreshBlocked = new Promise((resolve) => {
    resumeInitialRefresh = resolve;
  });
  await page.route(`${apiBase}/auth/refresh`, async (route) => {
    await initialRefreshBlocked;
    await route.continue();
  });
  await page.goto(`${frontendOrigin}/signup`);
  await page.getByText("Restoring your session…").waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Create student account" }).count(),
    0,
  );
  const refreshResponse = page.waitForResponse(
    (response) => response.url() === `${apiBase}/auth/refresh`,
  );
  resumeInitialRefresh();
  await refreshResponse;
  await page.unroute(`${apiBase}/auth/refresh`);
  const testEmail = `browser.${randomUUID().slice(0, 8)}@example.test`;
  await page.getByLabel("Email").fill(testEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.locator('input[placeholder="Enter your password again"]').fill(password);
  await page.getByRole("button", { name: "Create student account" }).click();
  await page.getByRole("link", { name: "Explore events" }).first().waitFor();
  const registeredUser = await User.findOne({ email: testEmail })
    .select("email")
    .lean();
  assert.ok(
    registeredUser,
    `signup must persist the account; UI: ${await page.locator("body").innerText()}`,
  );
  await page.getByRole("link", { name: "Explore events" }).first().click();
  await page.getByRole("heading", { name: eventTitle }).waitFor();
  await page.getByRole("link", { name: "View event" }).click();
  await page.getByRole("button", { name: "Register for free" }).click();
  await page.getByRole("button", { name: "Registration confirmed" }).waitFor();
  await page.getByRole("link", { name: "My tickets" }).first().click();
  await page.getByRole("heading", { name: eventTitle }).waitFor();
  await page.locator(".ticket-stub svg").waitFor();

  assert.equal(await Registration.countDocuments({ userId: registeredUser._id }), 1);
  assert.equal(await Ticket.countDocuments(), 1);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: /Continue as student/i }).waitFor();
  await page.getByLabel("Email").fill(testEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Continue as student/i }).click();
  await page.getByRole("link", { name: "Explore events" }).first().waitFor();
  await page.getByRole("link", { name: "Explore events" }).first().click();
  await page.getByRole("heading", { name: eventTitle }).waitFor();
  await page.getByRole("link", { name: "View event" }).click();
  const alreadyRegistered = page.getByRole("button", {
    name: "Already registered",
  });
  await alreadyRegistered.waitFor();
  assert.equal(await alreadyRegistered.isDisabled(), true);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Volunteer" }).click();
  await page.getByLabel("Email").fill(volunteerEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Continue as volunteer/i }).click();
  await page.getByText("Successful scans today").waitFor();

  assert.deepEqual(browserErrors, []);
  console.log(
    "Browser E2E passed: delayed session restoration, student signup/sign-in, event registration/ticket QR, and volunteer sign-in/summary.",
  );
} finally {
  await browser?.close();
  if (viteProcess && viteProcess.exitCode === null) viteProcess.kill();
  if (httpServer?.listening) await closeSocketServer();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
