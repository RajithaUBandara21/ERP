# packages/database

Drizzle ORM setup: control-plane schema, tenant connection registry, tenant provisioning, migrations.

- `src/control-plane/schema.ts` — the 10 control-plane tables (see [DATABASE.md](../../DATABASE.md) §2).
- `src/control-plane/client.ts` — memoized control-plane Drizzle client (`getControlPlaneDb()`).
- `src/tenant/connection-registry.ts` — generic, driver-agnostic LRU tenant connection registry (see [MULTI-TENANCY.md](../../MULTI-TENANCY.md) §3).
- `src/tenant/registry.ts` — the concrete Postgres-backed registry (`getTenantDb(tenantId)`).
- `src/tenant/provisioning.ts` — idempotent tenant database creation/registration (`provisionTenant`).
- `src/cli/provision-tenant.ts` — CLI entry point, run via `pnpm provision:tenant -- --slug=<slug> [--name=<name>]`.

```bash
# Generate/apply control-plane migrations (requires CONTROL_PLANE_DATABASE_URL)
pnpm db:generate
pnpm db:migrate

# Provision a tenant database (requires CONTROL_PLANE_DATABASE_URL + TENANT_DATABASE_ADMIN_URL)
pnpm provision:tenant -- --slug=acme --name="Acme Retail"
```

No tenant-side business schema exists yet — each module contributes its own once implemented (Phase 3+). See [ADR-0008](../../docs/adr/0008-orm-selection-drizzle.md) (ORM choice) and [ADR-0009](../../docs/adr/0009-tenant-db-placement.md) (tenant DB placement/pooling).
