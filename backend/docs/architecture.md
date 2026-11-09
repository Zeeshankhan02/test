# Architecture

## Repository

The project is a React/Vite/TypeScript client under `frontend/` and an Express 5/Mongoose API under `backend/`. The frontend keeps route composition in `src/App.tsx`, feature pages under `src/features/`, shared UI in `src/shared/`, and domain API clients under `src/api/services/`. `src/api.ts` is the compatibility facade; `src/api/client.ts` owns access-token handling and refresh-cookie rotation, while `src/api/types.ts` contains API DTOs. Global styles stay in `src/styles/` and load in the order declared by `src/main.tsx` so the existing cascade and theme overrides remain intact.

## Frontend boundaries

- `src/features/<domain>/`: page-level UI grouped by product feature, including auth, events, registrations, tickets, quizzes, leaderboards, volunteers, certificates, notifications, fest configuration, and admin tools.
- `src/api/services/`: endpoint calls grouped by domain; existing callers keep using the `api` facade and endpoint contracts.
- `src/shared/`: UI primitives shared across feature pages.
- `src/styles/`: ordered global base, notification, refinement, and dark-theme styles. The existing CSS cascade is retained rather than split into per-component stylesheets.

## Backend boundaries

- `src/config/`: validated environment, database, CORS, security headers, logging.
- `src/common/`: standardized errors/responses, ObjectId/body validation, audit and async helpers.
- `src/middleware/`: authentication, role authorization, request IDs, CSRF origin checks, not-found and error responses.
- `src/modules/<domain>/`: thin route declarations, HTTP controllers, Zod validators, domain services, and domain Mongoose models. `src/modules/models.ts` re-exports models as a compatibility barrel. Services own workflow and Mongoose queries.
- `src/integrations/email/`: optional SMTP reset email.
- `src/sockets/`: authenticated, user-private notification delivery.
- `tests/`, `scripts/`, and `docs/`: security/health checks, admin/credential migration/health utilities, contracts, deployment and operation records.

Routes only declare paths, access middleware, and controller handlers. Controllers parse boundary input and format responses; validators define request schemas; services perform business workflows and database operations. Domain model files own their persistence schemas and indexes, while services use Mongoose directly, so a separate repository abstraction is intentionally not added.

## Data and security decisions

MongoDB stores accounts, refresh sessions, events, registrations, tickets, scan logs, quizzes/attempts, notifications, certificate templates/issuances, and audit logs. Unique indexes protect account email, per-user event registration, per-registration ticket, per-user quiz attempt, certificate id, and template/registration issuance. Check-in uses an atomic active-ticket transition plus a unique partial index on successful scans. Registration, ticket issuance/cancellation and certificate publishing use transactions and require a replica set or sharded cluster.

Access JWTs include issuer/audience and a token version checked against the active account. Refresh tokens are random, stored hashed, rotated once, and replay revokes sessions. Passwords use bcrypt; QR credentials are encrypted at rest and looked up by digest. Mutating cookie-auth routes require an allowed Origin, and Socket.IO accepts only current access tokens and joins the authenticated user's room.

## Integrations and constraints

SMTP is optional and reset email is unavailable until configured; the authenticated SMTP send path is integration-tested against a local SMTP server. No media upload or queued workload exists in current product flows, so Cloudinary and Redis/BullMQ are intentionally omitted. Local MongoDB replica-set setup is in `docker-compose.yml`. No default admin is created; use the explicit CLI bootstrap. Verification and known limitations are tracked in `implementation-plan.md` and `testing.md`.
