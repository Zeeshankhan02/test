import express from "express";
import { corsMiddleware } from "./config/cors.js";
import { databaseReady } from "./config/database.js";
import { securityMiddleware } from "./config/security.js";
import { success } from "./common/responses/success.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { authenticate } from "./middleware/authenticate.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { errorHandlerMiddleware } from "./middleware/error-handler.middleware.js";
import { cookieCsrfMiddleware } from "./middleware/cookie-csrf.middleware.js";
import { publicAuthRoutes } from "./modules/auth/auth.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { eventsRoutes } from "./modules/events/events.routes.js";
import { registrationsRoutes } from "./modules/registrations/registrations.routes.js";
import { ticketsRoutes } from "./modules/tickets/tickets.routes.js";
import { scansRoutes } from "./modules/scans/scans.routes.js";
import { quizzesRoutes } from "./modules/quizzes/quizzes.routes.js";
import { quizAttemptRoutes } from "./modules/quiz-attempts/quiz-attempts.routes.js";
import { leaderboardsRoutes } from "./modules/leaderboards/leaderboards.routes.js";
import { notificationsRoutes } from "./modules/notifications/notifications.routes.js";
import { volunteersRoutes } from "./modules/volunteers/volunteers.routes.js";
import { certificatesRoutes } from "./modules/certificates/certificates.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { auditLogsRoutes } from "./modules/audit-logs/audit-logs.routes.js";

const app = express();
app.disable("x-powered-by");
app.use(corsMiddleware);
app.use(securityMiddleware);
app.use(requestIdMiddleware);
app.get("/health/live", (_req, res) => success(res, { status: "live" }));
app.get("/health/ready", (_req, res) => {
  const ready = databaseReady();
  return res.status(ready ? 200 : 503).json({
    success: ready,
    data: { status: ready ? "ready" : "not_ready", database: ready },
  });
});

const api = express.Router();
api.use("/auth", publicAuthRoutes);
api.use("/auth", usersRoutes);
api.use((req, res, next) => {
  const publicRead =
    req.method === "GET" &&
    (/^\/events(?:\/[a-f\d]{24})?$/i.test(req.path) ||
      /^\/certificates\/verify\/[A-Z0-9-]+$/i.test(req.path));
  return publicRead && !req.headers.authorization
    ? next()
    : authenticate(req, res, next);
});
api.use("/events", eventsRoutes);
api.use(registrationsRoutes);
api.use(ticketsRoutes);
api.use(scansRoutes);
api.use("/quizzes", quizzesRoutes);
api.use(quizAttemptRoutes);
api.use(leaderboardsRoutes);
api.use(notificationsRoutes);
api.use(volunteersRoutes);
api.use(certificatesRoutes);
api.use(dashboardRoutes);
api.use(auditLogsRoutes);
app.use("/api/v1", cookieCsrfMiddleware);
app.use("/api/v1", api);
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

export default app;
