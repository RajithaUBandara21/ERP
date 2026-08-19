# infrastructure/docker

`docker-compose.yml` for local development: Postgres (control plane + all locally-created tenant databases — Postgres host port **5433**, mapped this way to avoid colliding with other local Postgres instances), Redis, and MinIO (S3-compatible storage). See [DEPLOYMENT.md](../../DEPLOYMENT.md) §2.

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
cp .env.example .env   # already points at localhost:5433
pnpm --filter @erp/database db:migrate
pnpm --filter @erp/web dev
```
