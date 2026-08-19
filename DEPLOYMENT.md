# Deployment

Status: Phase 1 (architecture only). Real infrastructure config is added starting Phase 2 (`infrastructure/docker`) and Phase 19 (`infrastructure/aws`).

## 1. Environments

| Environment | Stack | Purpose |
|---|---|---|
| Development | Docker Compose (Postgres, Redis, S3-compatible storage) + local Next.js dev server | Local iteration |
| Demo | Vercel + managed Postgres (Neon) + managed object storage | Cheap, low-traffic showcase/sales demo environment |
| Production | AWS (or customer infrastructure) | Full target scale |

The demo environment intentionally does **not** provision for the 1,000-tenant / 2,000-user target scale — it proves the architecture with a handful of seeded tenants, kept inexpensive (CLAUDE.md §2). Production is where real capacity planning happens, informed by actual measured usage, not speculative provisioning (CLAUDE.md §56).

## 2. Development (Docker Compose)

`infrastructure/docker/docker-compose.yml` (added Phase 2) provisions:

- Postgres (hosts both the control-plane database and all locally-created tenant databases, per [DATABASE.md](./DATABASE.md) §3)
- Redis (cache, added when a cache-worthy use case exists — not wired to every request by default)
- An S3-compatible store (e.g. MinIO) for file/object storage

`pnpm dev` runs `apps/web` (and later `apps/pos`) against this stack.

## 3. Demo (Vercel)

- `apps/web` deploys to Vercel.
- Postgres: managed provider with serverless-friendly pooling (e.g. Neon), hosting the control plane plus a small number of demo tenant databases on one shared instance (see [DATABASE.md](./DATABASE.md) §3–4 for the connection-pooling approach required under Vercel's function concurrency model).
- Object storage: managed S3-compatible provider.
- Secrets: Vercel environment variables (never committed; `.env.example` documents required keys, real values live only in Vercel's project settings).

## 4. Production (AWS / customer infrastructure)

Deferred to Phase 19; not designed in detail yet. Expected shape, consistent with "containerizable, not locked to Vercel" (CLAUDE.md §4):

- The Next.js application built as a container image, deployable to AWS (e.g. ECS/Fargate) or customer-managed infrastructure.
- Tenant databases distributed across managed Postgres instances (e.g. RDS) as load and per-tenant SLAs require, driven purely by `tenant_database_registry` data — no code change to move a tenant.
- Secrets via a managed secrets service (e.g. AWS Secrets Manager).
- Background job execution and the outbox publisher run as long-lived worker processes rather than serverless functions, once that becomes the better fit for sustained throughput (revisited with evidence, per CLAUDE.md §56 — not assumed upfront).

## 5. Containerization requirement

The application must remain containerizable at all times, even though the demo environment targets Vercel — this preserves the ability to deploy to AWS/customer infrastructure without an architecture change, only a deployment-target change (CLAUDE.md §4).

## 6. CI/CD

See `.github/workflows/ci.yml` for the current skeleton (install → typecheck → lint → test → build) and [TESTING.md](./TESTING.md) §7 for what is added at each phase. Per CLAUDE.md §43–44: every pull request runs install/typecheck/lint/unit/integration/build/security-checks/migration-validation; the main branch additionally runs E2E, performance smoke tests, and a container build. No code that fails a required check is deployed.
