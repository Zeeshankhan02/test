# Security

- Public signup always assigns `student`; admin provisioning is a manual CLI command and volunteers are admin-created.
- Passwords use bcrypt cost 12. Access JWTs default to 15 minutes and validate issuer, audience, signature and current account token version. Refresh tokens are random opaque values; only SHA-256 digests are stored. Rotation is single-use; replay revokes active sessions. Cookies are HTTP-only. Password reset tokens are one-use, time-limited and stored hashed.
- Ticket QR payloads combine a 256-bit random identifier with an HMAC signature. MongoDB stores its digest and AES-GCM encrypted identifier; only the owner/admin ticket endpoint returns a reconstructable QR payload. Scanning verifies canonical signature encoding and digest and atomically changes ticket state.
- Zod validates request bodies and queries; Mongoose indexes enforce uniqueness. Helmet, exact-origin credentialed CORS, body limits, and request IDs are enabled. Request rate limiting is disabled. Configure proxy trust only for the actual hosting proxy so client IP limits cannot be spoofed.
- Quizzes reference an event. Student quiz listings, attempt starts/submissions, and leaderboards require a confirmed registration for that event; quiz reads require authentication.
- Production errors omit internals. Logs contain request ID, method/path, and error type only.
- Unsafe requests with a refresh cookie require an allowlisted `Origin`, in addition to credentialed exact-origin CORS. Production must use HTTPS and a narrow origin. The refresh cookie is SameSite Lax by default; cross-site deployment requires SameSite None and Secure.

Keep `JWT_REFRESH_SECRET` stable while encrypted ticket credentials exist; rotate it only with a planned re-encryption/migration because it also signs QR credentials. Socket connections verify the JWT token version and active account and cannot select another user's room.
