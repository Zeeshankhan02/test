# Architecture

## Repository

The project is a React/Vite/TypeScript client under `frontend/` and an Express 5/Mongoose API under `backend/`. `frontend/src/api.ts` centralizes API calls, access-token handling, refresh-cookie rotation, and Socket.IO notifications. Existing UI markup and styling have been retained while fixture-backed data flows were connected to the API.

## Backend boundaries

- `src/config/`: validated environment, database, CORS, security headers, logging.
- `src/common/`: standardized errors/responses, ObjectId/body validation, audit and async helpers.
- `src/middleware/`: authentication, role authorization, request IDs, CSRF origin checks, not-found and error responses.
- `src/modules/<domain>/`: thin route declarations, HTTP controllers, Zod validators, and domain services. Services own workflow and Mongoose queries; shared Mongoose schemas and indexes are centralized in `src/modules/models.ts`.
- `src/integrations/email/`: optional SMTP reset email.
- `src/sockets/`: authenticated, user-private notification delivery.
- `tests/`, `scripts/`, and `docs/`: security/health checks, admin/credential migration/health utilities, contracts, deployment and operation records.

Routes only declare paths, access middleware, and controller handlers. Controllers parse boundary input and format responses; validators define request schemas; services perform business workflows and database operations. `models.ts` is the persistence schema/index boundary, while services use Mongoose directly, so a separate repository abstraction is intentionally not added.

## Data and security decisions

MongoDB stores accounts, refresh sessions, events, registrations, tickets, scan logs, quizzes/attempts, notifications, certificate templates/issuances, and audit logs. Unique indexes protect account email, per-user event registration, per-registration ticket, per-user quiz attempt, certificate id, and template/registration issuance. Check-in uses an atomic active-ticket transition plus a unique partial index on successful scans. Registration, ticket issuance/cancellation and certificate publishing use transactions and require a replica set or sharded cluster.

Access JWTs include issuer/audience and a token version checked against the active account. Refresh tokens are random, stored hashed, rotated once, and replay revokes sessions. Passwords use bcrypt; QR credentials are encrypted at rest and looked up by digest. Mutating cookie-auth routes require an allowed Origin, and Socket.IO accepts only current access tokens and joins the authenticated user's room.

## Integrations and constraints

SMTP is optional and reset email is unavailable until configured; the authenticated SMTP send path is integration-tested against a local SMTP server. No media upload or queued workload exists in current product flows, so Cloudinary and Redis/BullMQ are intentionally omitted. Local MongoDB replica-set setup is in `docker-compose.yml`. No default admin is created; use the explicit CLI bootstrap. Verification and known limitations are tracked in `implementation-plan.md` and `testing.md`.
