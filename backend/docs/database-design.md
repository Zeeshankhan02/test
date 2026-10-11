# Database design

MongoDB/Mongoose collections: `users`, `sessions`, `events`, `registrations`, `tickets`, `scanlogs`, `quizzes`, `quizattempts`, `notifications`, `certificatetemplates`, `certificates`, and `auditlogs`.

- Users have normalized unique email, a controlled role, password hash, and active flag. Password/session secrets are excluded from ordinary reads.
- Sessions store only a SHA-256 refresh-token hash, expiry, revocation state, and user reference. Replaced tokens are revoked during rotation.
- Events store lifecycle status, capacity, registration window, team limits, and event details. Public reads are indexed by status/date/category.
- Registrations reference user and event; a unique `(eventId,userId)` index prevents duplicate entries. Tickets store a credential digest plus an AES-GCM encrypted random identifier used to reconstruct a signed QR only for an authorized owner. Legacy plaintext IDs are hidden from ordinary reads and can be migrated with `npm run tickets:migrate-credentials`.
- Registration and ticket writes are transactional. Deployment requires a replica set or sharded cluster.
- Scan logs are append-only application records; a unique successful-scan ticket index prevents repeat check-in.
- Each quiz references its event; students can read/start quizzes and view leaderboards only while their event registration is confirmed. Quiz attempts are unique per quiz/user and store server-calculated score and answers. Quiz correct answers are never sent in student quiz reads.
- Notifications are owned by a user and indexed by user. Certificate templates reference events; issued certificates are unique by registration/template and globally by public certificate ID.
- Audit logs record admin actions with actor, action, resource and safe metadata; the API exposes paginated read-only access to admins.

All schemas use timestamps. Request handlers enforce ownership, transitions, deadlines, capacity, and eligibility in addition to schema constraints.
