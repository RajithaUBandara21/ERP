# packages/configuration

`loadConfig()` — parses and validates `process.env` against a Zod schema (see `.env.example` for the full contract), memoized per process. Throws a descriptive error listing invalid/missing keys (never their values) on failure.

Only `CONTROL_PLANE_DATABASE_URL` and `TENANT_DATABASE_ADMIN_URL` are required as of Phase 2 — auth/storage/cache vars become required once the features that consume them land.
