# Testing

From `backend/`:

- `npm test` builds strict TypeScript, runs QR credential signature/encryption assertions, exercises HTTP liveness/readiness, validation, CSRF, auth guards, reset-request behavior, and confirms repeated requests are not rate limited, then delivers a password reset email through a local authenticated SMTP server.
- `npm run test:email` runs the authenticated local SMTP integration test independently. It verifies recipient and reset URL content without sending mail to an external address.
- `npm run lint` checks backend source, tests, and scripts. `npm run format:check` checks Prettier formatting.
- `npm run test:e2e` runs Mongo-backed workflows. Set `TEST_MONGODB_URI` to a disposable replica-set or sharded-cluster URI first. The runner rewrites the URI database path to a random `festiqo_e2e_*` name and drops only that isolated database during cleanup.
- `npm run test:browser` starts an isolated API and Vite server, then uses Chromium to check delayed session restoration, student signup/sign-in, event discovery, registration, persisted ticket/QR rendering, and volunteer sign-in/summary through the existing UI. It also requires `TEST_MONGODB_URI`; Windows uses system Chrome, while other platforms can set `CHROME_PATH`.

The Mongo E2E suite checks refresh-token replay revocation, admin/student access, concurrent event capacity, event cancellation after check-in, concurrent duplicate scans, scan summaries, volunteer create/deactivate behavior, dashboard counts, quiz event-registration access, concurrent quiz attempts/scoring/leaderboards, certificate issue/revoke, persisted notifications, admin audit reads, and private Socket.IO notifications. Transactions require a replica set or sharded cluster.

From `frontend/`:

- `npm run lint` checks frontend source.
- `npm run build` runs TypeScript project checks and the optimized Vite production build.
- `npm run test:scanner` checks valid, random, duplicate, and normalized ticket IDs.

`npm audit` currently reports zero vulnerabilities in both frontend and backend. The local SMTP test verifies the application send path; provider-specific delivery and inbox placement still need real SMTP credentials. Browser E2E covers the student journey and volunteer summary, not every admin page.
