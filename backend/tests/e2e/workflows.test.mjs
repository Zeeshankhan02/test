import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const source = process.env.TEST_MONGODB_URI;
assert.ok(
  source,
  "Set TEST_MONGODB_URI to a MongoDB replica-set URI before running E2E tests",
);
const databaseUri = new URL(source);
assert.ok(
  databaseUri.searchParams.has("replicaSet") || databaseUri.protocol === "mongodb+srv:",
  "TEST_MONGODB_URI must target a replica set or sharded cluster",
);
databaseUri.pathname = `/festiqo_e2e_${randomUUID().replaceAll("-", "").slice(0, 26)}`;

Object.assign(process.env, {
  NODE_ENV: "test",
  MONGODB_URI: databaseUri.toString(),
  FRONTEND_URL: "http://localhost:5173",
  CORS_ORIGINS: "",
  JWT_ACCESS_SECRET: "test-access-secret-that-is-long-enough-123",
  JWT_REFRESH_SECRET: "test-refresh-secret-that-is-long-enough-456",
  SMTP_HOST: "",
  SMTP_PORT: "",
  SMTP_USER: "",
  SMTP_PASSWORD: "",
  EMAIL_FROM: "",
});

await mongoose.connect(databaseUri.toString());
const { User } = await import("../../dist/modules/models.js");
const { default: app } = await import("../../dist/app.js");
const { attachSocketServer, closeSocketServer } =
  await import("../../dist/sockets/socket-server.js");
const { io } = await import("socket.io-client");
const httpServer = createServer(app);
attachSocketServer(httpServer);

const address = await new Promise((resolve) =>
  httpServer.listen(0, "127.0.0.1", () => resolve(httpServer.address())),
);
const origin = `http://127.0.0.1:${address.port}`;
const api = `${origin}/api/v1`;
const password = "E2e-workflow-password-2026!";
const accounts = {};
let studentSocket;

async function call(path, { method = "GET", actor, body, cookie } = {}) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(actor ? { authorization: `Bearer ${actor.accessToken}` } : {}),
      ...(cookie ? { cookie, origin: "http://localhost:5173" } : {}),
      ...(!cookie && method !== "GET" ? { origin: "http://localhost:5173" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  return { response, result };
}

async function login(email) {
  const { response, result } = await call("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(response.status, 200, JSON.stringify(result));
  const setCookies = response.headers.getSetCookie();
  const refreshCookie = setCookies.find((value) => value.startsWith("refreshToken="));
  assert.ok(refreshCookie, "login must set a refresh cookie");
  return {
    accessToken: result.data.accessToken,
    refreshCookie: refreshCookie.split(";", 1)[0],
  };
}

try {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.syncIndexes();
  const passwordHash = await bcrypt.hash(password, 12);
  for (const [role, email] of [
    ["admin", "admin@e2e.test"],
    ["student", "student@e2e.test"],
    ["student", "second@e2e.test"],
    ["volunteer", "volunteer@e2e.test"],
  ]) {
    await User.create({ name: role, email, passwordHash, role });
  }
  accounts.admin = await login("admin@e2e.test");
  accounts.student = await login("student@e2e.test");
  accounts.second = await login("second@e2e.test");
  accounts.volunteer = await login("volunteer@e2e.test");

  const rotated = await call("/auth/refresh", {
    method: "POST",
    cookie: accounts.student.refreshCookie,
  });
  assert.equal(rotated.response.status, 200);
  assert.notEqual(rotated.result.data.accessToken, accounts.student.accessToken);
  const rotatedCookie = rotated.response.headers
    .getSetCookie()
    .find((value) => value.startsWith("refreshToken="));
  assert.ok(rotatedCookie);
  const firstRotatedRefreshToken = rotatedCookie.split(";", 1)[0];
  assert.notEqual(firstRotatedRefreshToken, accounts.student.refreshCookie);
  const rotatedAgain = await call("/auth/refresh", {
    method: "POST",
    cookie: firstRotatedRefreshToken,
  });
  assert.equal(rotatedAgain.response.status, 200);
  assert.notEqual(
    rotatedAgain.result.data.accessToken,
    rotated.result.data.accessToken,
  );
  const secondRotatedRefreshToken = rotatedAgain.response.headers
    .getSetCookie()
    .find((value) => value.startsWith("refreshToken="))
    ?.split(";", 1)[0];
  assert.ok(secondRotatedRefreshToken);
  assert.notEqual(secondRotatedRefreshToken, firstRotatedRefreshToken);
  const replay = await call("/auth/refresh", {
    method: "POST",
    cookie: accounts.student.refreshCookie,
  });
  assert.equal(replay.response.status, 401, "refresh replay must be rejected");
  assert.equal(
    (await call("/auth/me", { actor: accounts.student })).response.status,
    401,
    "refresh replay must revoke access tokens",
  );
  accounts.student = await login("student@e2e.test");

  const eventResponse = await call("/events", {
    method: "POST",
    actor: accounts.admin,
    body: {
      title: "E2E event",
      description: "Capacity and check-in workflow",
      category: "Technical",
      venue: "Test hall",
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      endsAt: new Date(Date.now() + 172_800_000).toISOString(),
      capacity: 1,
      teamMin: 1,
      teamMax: 1,
    },
  });
  assert.equal(
    eventResponse.response.status,
    201,
    JSON.stringify(eventResponse.result),
  );
  const eventId = eventResponse.result.data._id;
  assert.equal(
    (
      await call(`/events/${eventId}/publish`, {
        method: "POST",
        actor: accounts.admin,
      })
    ).response.status,
    200,
  );
  assert.equal(
    (
      await call(`/events/${eventId}`, {
        method: "PATCH",
        actor: accounts.student,
        body: { title: "forbidden" },
      })
    ).response.status,
    403,
  );

  const registrations = await Promise.all([
    call(`/events/${eventId}/register`, {
      method: "POST",
      actor: accounts.student,
      body: { members: ["student"] },
    }),
    call(`/events/${eventId}/register`, {
      method: "POST",
      actor: accounts.second,
      body: { members: ["second"] },
    }),
  ]);
  assert.equal(
    registrations.filter((item) => item.response.status === 201).length,
    1,
    "capacity must admit exactly one concurrent registration",
  );
  assert.equal(registrations.filter((item) => item.response.status === 409).length, 1);
  const winnerIndex = registrations.findIndex((item) => item.response.status === 201);
  const winner = registrations[winnerIndex].result.data;
  const winnerActor = winnerIndex === 0 ? accounts.student : accounts.second;
  assert.equal(
    (await call(`/events/${eventId}/registrations`, { actor: accounts.student }))
      .response.status,
    403,
  );
  assert.equal(
    (await call("/admin/dashboard", { actor: accounts.student })).response.status,
    403,
  );
  const socketToken = winnerActor.accessToken;
  studentSocket = io(origin, {
    auth: { token: socketToken },
    extraHeaders: { origin: "http://localhost:5173" },
    reconnection: false,
  });
  await new Promise((resolve, reject) => {
    studentSocket.once("connect", resolve);
    studentSocket.once("connect_error", reject);
  });

  const scans = await Promise.all([
    call("/scans/verify", {
      method: "POST",
      actor: accounts.volunteer,
      body: { credential: winner.ticket.credential },
    }),
    call("/scans/verify", {
      method: "POST",
      actor: accounts.volunteer,
      body: { credential: winner.ticket.credential },
    }),
  ]);
  assert.deepEqual(scans.map((item) => item.result.data.status).sort(), [
    "duplicate",
    "valid_entry",
  ]);
  assert.equal(
    (await call("/volunteers/me/summary", { actor: accounts.volunteer })).result.data
      .totalCheckIns,
    1,
  );
  const cancelledEvent = await call(`/events/${eventId}/cancel`, {
    method: "POST",
    actor: accounts.admin,
  });
  assert.equal(cancelledEvent.result.data.status, "cancelled");
  assert.equal(
    (await call("/registrations/me", { actor: winnerActor })).result.data[0].status,
    "confirmed",
  );
  assert.equal(
    (await call("/tickets/me", { actor: winnerActor })).result.data[0].status,
    "checked_in",
  );
  const dashboard = await call("/admin/dashboard", { actor: accounts.admin });
  assert.equal(dashboard.result.data.checkIns, 1);
  assert.equal(dashboard.result.data.registrations, 1);

  const newVolunteer = await call("/volunteers", {
    method: "POST",
    actor: accounts.admin,
    body: {
      name: "Temporary Volunteer",
      email: "temporary@e2e.test",
      password: "E2e-temporary-volunteer-2026!",
    },
  });
  assert.equal(newVolunteer.response.status, 201);
  assert.equal("passwordHash" in newVolunteer.result.data, false);
  assert.equal(
    (
      await call(`/volunteers/${newVolunteer.result.data.id}/status`, {
        method: "PATCH",
        actor: accounts.admin,
        body: { active: false },
      })
    ).result.data.active,
    false,
  );
  assert.equal(
    (
      await call("/auth/login", {
        method: "POST",
        body: {
          email: "temporary@e2e.test",
          password: "E2e-temporary-volunteer-2026!",
        },
      })
    ).response.status,
    401,
  );

  const quiz = await call("/quizzes", {
    method: "POST",
    actor: accounts.admin,
    body: {
      title: "E2E quiz",
      eventId,
      durationSeconds: 300,
      status: "draft",
      questions: [{ text: "Correct?", options: ["yes", "no"], correctAnswer: 0 }],
    },
  });
  assert.equal(quiz.response.status, 201);
  const quizId = quiz.result.data._id;
  await call(`/quizzes/${quizId}/publish`, { method: "POST", actor: accounts.admin });
  const publicQuiz = await call("/quizzes", { actor: winnerActor });
  assert.equal(
    "correctAnswer" in
      publicQuiz.result.data.find((row) => row._id === quizId).questions[0],
    false,
  );
  const nonParticipant = winnerIndex === 0 ? accounts.second : accounts.student;
  assert.deepEqual((await call("/quizzes", { actor: nonParticipant })).result.data, []);
  assert.equal(
    (
      await call(`/quizzes/${quizId}/start`, {
        method: "POST",
        actor: nonParticipant,
      })
    ).response.status,
    403,
  );
  const attempt = await call(`/quizzes/${quizId}/start`, {
    method: "POST",
    actor: winnerActor,
  });
  const submissions = await Promise.all([
    call(`/quiz-attempts/${attempt.result.data.attemptId}/submit`, {
      method: "POST",
      actor: winnerActor,
      body: { answers: [0] },
    }),
    call(`/quiz-attempts/${attempt.result.data.attemptId}/submit`, {
      method: "POST",
      actor: winnerActor,
      body: { answers: [0] },
    }),
  ]);
  assert.deepEqual(submissions.map((item) => item.response.status).sort(), [200, 409]);
  assert.equal(
    submissions.find((item) => item.response.status === 200).result.data.score,
    1,
  );
  // Leaderboards stay hidden until the admin publishes results.
  assert.equal(
    (await call(`/quizzes/${quizId}/leaderboard`, { actor: winnerActor })).response
      .status,
    403,
  );
  await call(`/quizzes/${quizId}/results/publish`, {
    method: "POST",
    actor: accounts.admin,
  });
  assert.equal(
    (await call(`/quizzes/${quizId}/leaderboard`, { actor: winnerActor })).result
      .data[0].score,
    1,
  );
  assert.equal(
    (await call(`/quizzes/${quizId}/close`, { method: "POST", actor: accounts.admin }))
      .result.data.status,
    "closed",
  );

  // --- Autosave lifecycle: start -> answers -> state resume -> finalize ---
  const autosaveQuiz = await call("/quizzes", {
    method: "POST",
    actor: accounts.admin,
    body: {
      title: "E2E autosave quiz",
      eventId,
      durationSeconds: 600,
      status: "draft",
      questions: [
        { text: "Q one?", options: ["a", "b"], correctAnswer: 0 },
        { text: "Q two?", options: ["c", "d"], correctAnswer: 1 },
      ],
    },
  });
  assert.equal(autosaveQuiz.response.status, 201);
  const autosaveQuizId = autosaveQuiz.result.data._id;
  await call(`/quizzes/${autosaveQuizId}/publish`, {
    method: "POST",
    actor: accounts.admin,
  });
  const secondAttempt = await call(`/quizzes/${autosaveQuizId}/start`, {
    method: "POST",
    actor: winnerActor,
  });
  assert.equal(secondAttempt.response.status, 201);
  // The autosave attempt row is the same one created by the legacy submit
  // (unique quiz/user index), so its answers are already persisted. Re-entering
  // returns that snapshot; finalize then submits it with the correct answer
  // kept and question two skipped.
  const attemptId = secondAttempt.result.data.attemptId;
  // Re-entering an in-flight attempt returns the same attempt snapshot
  // (same attemptId, persisted answers) instead of starting over.
  const resumed = await call(`/quizzes/${autosaveQuizId}/start`, {
    method: "POST",
    actor: winnerActor,
  });
  assert.equal(resumed.response.status, 201);
  assert.equal(resumed.result.data.attemptId, attemptId);
  assert.equal(resumed.result.data.answers[0], 0);
  // Autosave is idempotent: re-saving the locked question never overwrites.
  const savedAnswer = await call(`/quiz-attempts/${attemptId}/answers`, {
    method: "POST",
    actor: winnerActor,
    body: { index: 0, answer: 0 },
  });
  assert.equal(savedAnswer.response.status, 200);
  assert.equal(savedAnswer.result.data.locked, true);
  assert.equal(savedAnswer.result.data.status, "answered");
  const attemptState = await call(`/quiz-attempts/${attemptId}/state`, {
    actor: winnerActor,
  });
  assert.equal(attemptState.result.data.answers[0], 0);
  assert.equal(attemptState.result.data.status, "in_progress");
  const finalized = await call(`/quiz-attempts/${attemptId}/finalize`, {
    method: "POST",
    actor: winnerActor,
    body: {},
  });
  assert.equal(finalized.response.status, 200);
  assert.equal(finalized.result.data.completed, true);
  assert.equal(finalized.result.data.alreadyCompleted, false);
  assert.equal(finalized.result.data.scoreRevealed, false);
  // Scores stay private before publication, even from the participant themself.
  assert.equal(
    (await call(`/quizzes/${autosaveQuizId}/leaderboard`, { actor: winnerActor })).response
      .status,
    403,
  );
  // Publishing requires every started attempt to be submitted first.
  assert.equal(
    (
      await call(`/quizzes/${autosaveQuizId}/results/publish`, {
        method: "POST",
        actor: accounts.admin,
      })
    ).response.status,
    409,
  );
  // Ending the quiz early finalizes any still-open attempts from their latest
  // persisted answers (admin termination path).
  const endedEarly = await call(`/quizzes/${autosaveQuizId}/end-early`, {
    method: "POST",
    actor: accounts.admin,
  });
  assert.equal(endedEarly.response.status, 200);
  assert.ok(endedEarly.result.data.finalizedAttempts >= 1);
  await call(`/quizzes/${autosaveQuizId}/results/publish`, {
    method: "POST",
    actor: accounts.admin,
  });
  const publishedLeaderboard = await call(`/quizzes/${autosaveQuizId}/leaderboard`, {
    actor: winnerActor,
  });
  assert.equal(publishedLeaderboard.response.status, 200);
  assert.equal(publishedLeaderboard.result.data[0].score, 1);
  const myResult = await call(`/quizzes/${autosaveQuizId}/my-result`, {
    actor: winnerActor,
  });
  assert.equal(myResult.result.data.score, 1);
  assert.equal(myResult.result.data.total, 2);
  assert.equal(myResult.result.data.rank, 1);

  // --- Fest configuration endpoint ---
  assert.equal((await call("/fest/dates")).result.data.startsAt, null);
  assert.equal(
    (
      await call("/fest/dates", {
        method: "PUT",
        actor: accounts.admin,
        body: { title: "E2E Fest" },
      })
    ).response.status,
    400,
  );
  await call("/fest/dates", {
    method: "PUT",
    actor: accounts.admin,
    body: {
      title: "E2E Fest",
      startsAt: "2026-10-15T09:00:00.000Z",
      endsAt: "2026-10-17T18:00:00.000Z",
    },
  });
  const festDates = await call("/fest/dates");
  assert.equal(festDates.result.data.title, "E2E Fest");
  assert.ok(festDates.result.data.startsAt);

  const template = await call("/certificates/templates", {
    method: "POST",
    actor: accounts.admin,
    body: {
      title: "E2E completion",
      description: "Completed E2E event",
      eventId,
      signatureName: "Admin",
      signatureRole: "Organizer",
    },
  });
  assert.equal(template.response.status, 201);
  const updatedTemplate = await call(
    `/certificates/templates/${template.result.data._id}`,
    {
      method: "PATCH",
      actor: accounts.admin,
      body: { description: "Verified event completion" },
    },
  );
  assert.equal(updatedTemplate.result.data.description, "Verified event completion");
  const published = await call("/certificates/publish", {
    method: "POST",
    actor: accounts.admin,
    body: { templateId: template.result.data._id },
  });
  assert.equal(published.result.data.published, 1);
  const certificates = await call("/certificates/me", { actor: winnerActor });
  assert.equal(certificates.result.data.length, 1);
  const certificateId = certificates.result.data[0].certificateId;
  assert.equal(
    (await call(`/certificates/verify/${certificateId}`)).response.status,
    200,
  );
  assert.equal(
    (
      await call(`/certificates/${certificateId}/revoke`, {
        method: "POST",
        actor: accounts.admin,
      })
    ).response.status,
    200,
  );
  assert.equal(
    (await call(`/certificates/verify/${certificateId}`)).response.status,
    410,
  );
  assert.equal(
    (await call("/certificates/me", { actor: winnerActor })).result.data.length,
    0,
  );

  let notification;
  const notificationReceived = new Promise((resolve) =>
    studentSocket.once("notification:new", (row) => {
      notification = row;
      resolve();
    }),
  );
  const announcement = await call("/notifications", {
    method: "POST",
    actor: accounts.admin,
    body: {
      title: "E2E announcement",
      message: "socket delivery",
      audience: "students",
    },
  });
  assert.equal(announcement.response.status, 201);
  await Promise.race([
    notificationReceived,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Socket notification not received")), 5000),
    ),
  ]);
  assert.equal(notification.title, "E2E announcement");
  const notices = await call("/notifications", { actor: winnerActor });
  const notice = notices.result.data.find((row) => row.title === "E2E announcement");
  assert.ok(notice, "broadcast notification must persist");
  assert.equal(
    (
      await call(`/notifications/${notice._id}/read`, {
        method: "PATCH",
        actor: winnerActor,
      })
    ).result.data.isRead,
    true,
  );
  assert.ok(
    (await call("/admin/audit-logs", { actor: accounts.admin })).result.data.length > 0,
  );
  console.log(
    "MongoDB E2E workflows passed: sessions, RBAC, capacity, scans, event lifecycle, volunteers, dashboard, quiz concurrency/scoring, certificates, notifications, audit logs, and Socket.IO.",
  );
} finally {
  studentSocket?.disconnect();
  await closeSocketServer();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
