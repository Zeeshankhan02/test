# Deployment

Deploy this directory as a Node 22+ service. Set variables from `.env.example` in the hosting platform, use separate 32+ character JWT secrets, set `NODE_ENV=production`, and allow only the deployed frontend origin. Use HTTPS and secure cross-site cookies when origins differ.

MongoDB must be a replica set or sharded cluster. Transactions are required for registration plus ticket creation/cancellation, event cancellation and certificate issuance. Do not deploy against standalone MongoDB. Mongoose creates schema indexes at startup; wait for index initialization on a fresh database. The checked-in single-node Compose replica set is for local development only (`docker compose up -d mongo` from `backend/`).

## MongoDB Atlas

Atlas clusters are replica sets and support these transactions. Create a dedicated database user with access only to the FestiQO database, add the backend host to Atlas Network Access, and use Atlas's SRV connection string as `MONGODB_URI` in the backend environment. URL-encode special characters in the database username/password. Keep the URI server-side; never put it in `frontend/.env` or commit it. Local development can use Docker MongoDB while production points at Atlas. `GET /health/ready` confirms the process connected, but only a workflow test confirms transaction permissions.

The E2E suite accepts `TEST_MONGODB_URI` separately, rewrites its database path to a unique `festiqo_e2e_*` database, and drops that database after execution. Prefer the local Compose replica set for destructive test runs. If using Atlas, provide a disposable test cluster and a test database user explicitly authorized to create/drop only disposable databases; never use production credentials or a production cluster for E2E tests.

Probe `/health/live` for liveness and `/health/ready` for MongoDB readiness. Shutdown handles SIGINT/SIGTERM. Configure all SMTP variables to enable reset emails. Socket.IO runs in the API process; multi-instance deployments need a shared Socket.IO adapter before broadcasts can reach users connected to other instances. Cloudinary and Redis are not required by current workflows.

Before upgrading an existing database with plaintext QR IDs, take a backup and run `npm run tickets:migrate-credentials` once before rotating the refresh secret. No deployment was performed or verified as part of this work.
