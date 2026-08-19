# Database Architecture

Status: Phase 1 (architecture only). Must stay consistent with [MULTI-TENANCY.md](./MULTI-TENANCY.md) and [ADR-0009](./docs/adr/0009-tenant-db-placement.md) — same mechanism, described here from the data/schema angle.

## 1. Two-plane model

```text
Control Plane Database (one, shared)
+
Tenant Database (one per tenant)
```

Never mix control-plane and tenant-plane tables in the same database. The control plane must remain queryable even if an individual tenant database is unreachable (e.g. to report tenant status), and a tenant database must remain fully self-contained (no cross-database joins/foreign keys into the control plane — references are by ID only, resolved at the application layer).

## 2. Control plane schema (CLAUDE.md §11)

| Table | Purpose |
|---|---|
| `tenants` | Tenant identity, slug, status |
| `tenant_database_registry` | Per-tenant connection string/credentials reference, physical placement metadata |
| `subscriptions` | Tenant's active subscription |
| `plans` | Available subscription plans and included modules/limits |
| `tenant_modules` | Per-tenant module activation state (ACTIVE/DISABLED) |
| `module_versions` | Installed module version per tenant |
| `billing` | Billing records/invoices at the platform level |
| `feature_flags` | Flag definitions and tenant/user/environment/percentage targeting |
| `domains` | Custom domain → tenant slug mapping |
| `platform_users` | Platform-level operators (support/admin staff), distinct from tenant business users in `identity` |
| `sessions` | Web sessions (Phase 4) — opaque token hash, tenantId, userId (unenforced ref to a tenant-DB user row), expiry/revocation; see [ADR-0006](./docs/adr/0006-authentication.md) |

`tenant_database_registry.connection_string` (or its component parts) is treated as a secret — never logged, and access to read it is itself an audited operation.

## 3. Tenant database placement per environment

The **mechanism** is identical in every environment: the control plane's `tenant_database_registry` holds a real connection string per tenant, and the application always connects to whatever that row says. What differs is only where those databases physically live:

| Environment | Placement |
|---|---|
| Local dev (Docker Compose) | Single local Postgres container; tenant databases created within it (`CREATE DATABASE tenant_<id>`) |
| Demo (Vercel + managed Postgres) | Small shared managed instance (e.g. one Neon project) hosting a handful of seeded demo tenant databases — cheap, proves the mechanism without provisioning for 1,000 tenants |
| Production (AWS / customer infra) | Tenant databases distributed across one or more instances/clusters as load requires; large tenants can be moved to dedicated instances — a data-migration operation (update the registry row + physically move the database), not an application code change |

This is a genuine database-per-tenant model (not schema-per-tenant): each tenant gets its own Postgres *database*, giving a hard connection-level isolation boundary regardless of how many databases share a physical server. See [ADR-0009](./docs/adr/0009-tenant-db-placement.md) for the full rationale and rejected alternatives (schema-per-tenant, one-instance-per-tenant).

## 4. Connection management in serverless

Vercel functions can scale to many concurrent instances; without care this multiplies Postgres connections beyond what a single instance can hold. Mitigations, applied together:

1. **External pooler in front of Postgres** (managed provider's built-in pooler, e.g. Neon's, or PgBouncer), in transaction-pooling mode — serverless functions never hold a raw long-lived connection against the database directly.
2. **In-app tenant connection registry** (described in [MULTI-TENANCY.md](./MULTI-TENANCY.md) §3): small per-tenant pool (1–3 connections), LRU-evicted, created lazily.
3. Where available, prefer a serverless-native driver (e.g. Neon's HTTP/WebSocket driver) for read-heavy/edge-adjacent paths, sidestepping pool exhaustion for those requests entirely.

## 5. ORM: Drizzle

Drizzle is used for both the control-plane schema and every tenant database schema (see [ADR-0008](./docs/adr/0008-orm-selection-drizzle.md) for the full evaluation against Prisma). Key implications for this architecture:

- A Drizzle "client" is a thin wrapper over a driver connection/pool — cheap to construct and discard, which is what makes the dynamic per-tenant connection registry practical. A query-engine-per-client model (as used by Prisma) would not scale to holding many concurrent tenant connections cheaply.
- Schema is defined once per module (colocated in that module's `infrastructure/persistence/`) and applied identically, via Drizzle Kit migrations, to every tenant database — "one schema, many physical databases."
- Control-plane schema lives in `packages/database`, versioned and migrated independently from tenant schemas.

## 6. Migrations (CLAUDE.md §44)

- Versioned, deterministic, reviewable SQL (Drizzle Kit generates plain SQL migration files, not an opaque binary format).
- Tenant provisioning always applies the current full migration set for every installed module to a newly created tenant database — provisioning is idempotent and resumable if it fails partway (see tenant provisioning flow in [ARCHITECTURE.md](./ARCHITECTURE.md) roadmap, Phase 3).
- Schema changes to an already-installed module ship as a new migration that is applied to every tenant with that module active — a background/administrative operation, not a per-request one.
- No manual production schema edits; every change is a recorded, reviewed migration.

**Tenant-side migrations (implemented, Phase 4):** `packages/database` exposes `runTenantMigrations(tenantId, migrationsFolder)`, which applies a pre-generated SQL migration set (via `drizzle-orm/postgres-js/migrator`) to one tenant's database over a short-lived connection. This is a minimal, module-agnostic primitive — each module owning tenant-DB tables (e.g. `identity`'s `users` table) generates its own migrations and calls this directly (see `modules/identity/src/apply-migrations.ts`). It is a deliberate stand-in for Phase 6's module-installation migration step (MODULE-SYSTEM.md §3, "run migrations" as one of the 10 install steps), which will generalize this into "apply every installed module's migrations for this tenant, in dependency order." Known limitation: the migrations folder is resolved relative to the calling file at runtime, which only works against real source files (tsx scripts, tests, `next dev`) — never call this from inside a Next.js Route Handler bundle, only from ops/admin scripts, until Phase 6 replaces it with proper migration-asset packaging.

## 7. Inventory consistency note

Stock truth is never a single mutable `current_quantity` column alone — every change is recorded in an append-only stock movement ledger (`RECEIPT`, `SALE`, `RETURN`, `TRANSFER`, `ADJUSTMENT`, `DAMAGE`, `RESERVATION`, `RELEASE`), with `current_quantity` maintained as a derived, transactionally-consistent projection. Full detail belongs to the `inventory` module's own documentation once implemented (Phase 9); noted here because it is a database-design constraint, not just a domain rule.

## 8. Caching

Redis is introduced only where justified (product catalog, configuration, permissions, module metadata, other frequently-read reference data) — not attached to every request by default (CLAUDE.md §29). Every cache entry is tenant-scoped (`tenant:{tenantId}:...`), versioned, and has an explicit TTL/invalidation strategy. Mutable financial state is not cached without an explicit, documented invalidation path.
