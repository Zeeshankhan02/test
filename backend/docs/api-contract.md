# API contract

Base URL: `/api/v1`. Successful responses use `{ success: true, data }`; errors use `{ success: false, message, error: { code }, requestId }`. Protected routes accept `Authorization: Bearer <accessToken>`. Refresh/logout use the HTTP-only `refreshToken` cookie and browser credentials. Student signup cannot choose a role; admin bootstrap uses the CLI.

| Method     | Path                                                                                         | Access                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| GET        | `/health/live`, `/health/ready`                                                              | Public                                                                                          |
| POST       | `/auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout`                               | Public/session                                                                                  |
| POST       | `/auth/password/forgot`, `/auth/password/reset`                                              | Public                                                                                          |
| GET        | `/auth/me`                                                                                   | Authenticated                                                                                   |
| PATCH      | `/auth/password`                                                                             | Authenticated                                                                                   |
| GET        | `/events`, `/events/:eventId`                                                                | Published public; admin sees drafts/cancelled                                                   |
| POST       | `/events`, `/events/:eventId/publish`, `/events/:eventId/cancel`, `/events/:eventId/archive` | Admin                                                                                           |
| PATCH      | `/events/:eventId`                                                                           | Admin, capacity/lifecycle validated                                                             |
| GET        | `/events/:eventId/registrations`, `/registrations`                                           | Admin, paginated                                                                                |
| POST       | `/events/:eventId/register`                                                                  | Student                                                                                         |
| GET        | `/registrations/me`, `/registrations/:registrationId`                                        | Authenticated owner/admin                                                                       |
| POST       | `/registrations/:registrationId/cancel`                                                      | Student owner/admin                                                                             |
| GET        | `/tickets/me`, `/tickets/:ticketId`                                                          | Authenticated owner/admin                                                                       |
| POST       | `/scans/verify`                                                                              | Volunteer/admin                                                                                 |
| GET        | `/volunteers/me/scans`, `/volunteers/me/summary`                                             | Volunteer/admin                                                                                 |
| GET        | `/quizzes`                                                                                   | Student: published quizzes for registered events; admin: published quizzes; answer keys removed |
| POST/PATCH | `/quizzes`, `/quizzes/:quizId`                                                               | Admin; draft editing only                                                                       |
| POST       | `/quizzes/:quizId/publish`, `/quizzes/:quizId/close`                                         | Admin                                                                                           |
| POST       | `/quizzes/:quizId/start`                                                                     | Student registered for the quiz's event                                                         |
| POST       | `/quiz-attempts/:attemptId/submit`                                                           | Attempt owner                                                                                   |
| GET        | `/quizzes/:quizId/leaderboard`                                                               | Student registered for the quiz's event; admin                                                  |
| GET        | `/notifications`                                                                             | Authenticated owner                                                                             |
| POST       | `/notifications`                                                                             | Admin broadcast                                                                                 |
| PATCH      | `/notifications/:notificationId/read`                                                        | Authenticated owner                                                                             |
| GET/POST   | `/volunteers`                                                                                | Admin                                                                                           |
| PATCH      | `/volunteers/:userId/status`                                                                 | Admin                                                                                           |
| GET/POST   | `/certificates/templates`                                                                    | Admin                                                                                           |
| PATCH      | `/certificates/templates/:templateId`                                                        | Admin, draft only                                                                               |
| POST       | `/certificates/publish`                                                                      | Admin                                                                                           |
| GET        | `/certificates/me`                                                                           | Authenticated owner                                                                             |
| POST       | `/certificates/:certificateId/revoke`                                                        | Admin                                                                                           |
| GET        | `/certificates/verify/:certificateId`                                                        | Public                                                                                          |
| GET        | `/admin/dashboard`, `/admin/audit-logs`                                                      | Admin                                                                                           |

Paginated APIs return `{ success, data, pagination: { page, limit, total, totalPages } }`. Registration returns persisted registration plus signed QR credential once; ticket owner reads reconstruct credentials from encrypted-at-rest IDs. Scan verification accepts `{ credential }`; the server checks signature, digest, ticket status, registration, and event before check-in. Socket.IO authenticates via `auth.token` (the access JWT) and emits `notification:new` only to that user's private room.

Mutating requests carrying the refresh cookie must include an `Origin` in the configured allowlist. Browser callers should use `credentials: "include"` for login/refresh/logout. Event registration/ticket issuance and cancellation and certificate publishing require MongoDB transactions.
