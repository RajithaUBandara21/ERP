# ADR-0002: Database-per-Tenant with Control Plane

- Status: Accepted
- Date: 2026-08-19

## Context

Tenant isolation is the platform's core security promise (CLAUDE.md §11, §13). The platform also needs shared, cross-tenant state (subscriptions, billing, module registry, feature flags) that does not belong to any single tenant. Physical placement must stay affordable in a demo environment while scaling toward ~1,000 tenants in production (CLAUDE.md §2).

## Decision

Split storage into two planes:

- **Control plane** (one database): `tenants`, `tenant_database_registry`, `subscriptions`, `plans`, `tenant_modules`, `module_versions`, `billing`, `feature_flags`, `domains`, `platform_users`.
- **Tenant plane** (one Postgres *database* per tenant): all business data owned by installed modules.

The control plane never stores tenant business data; tenant databases never store control-plane state. A tenant database connection is never exposed to a request authenticated for a different tenant (see [MULTI-TENANCY.md](../../MULTI-TENANCY.md)). Physical placement of tenant databases across environments is addressed separately in [ADR-0009](./0009-tenant-db-placement.md).

## Alternatives Considered

- **Single shared database, tenant_id column on every table (pooled multi-tenancy)**: rejected as the primary model — a single missing `WHERE tenant_id = ?` clause anywhere in the codebase becomes a cross-tenant data leak. Database-per-tenant makes that entire bug class structurally impossible: the connection itself cannot see another tenant's rows.
- **Schema-per-tenant on one database**: considered as a middle ground; rejected as the primary isolation boundary because Postgres roles/permissions and connection-level isolation are still shared across schemas in the same database, a weaker boundary than the platform's isolation guarantee should rest on. (It remains a viable *implementation detail* for how databases are physically packed — see ADR-0009 — but the unit of isolation is the database, not the schema.)

## Consequences

- Strongest practical tenant isolation boundary available without per-tenant infrastructure.
- Requires a connection-routing layer (tenant connection registry, [MULTI-TENANCY.md](../../MULTI-TENANCY.md) §3) rather than a single always-open connection pool.
- Cross-tenant analytics/reporting cannot use a simple cross-database SQL join; reporting is built from per-tenant event-driven read models instead (see [EVENTS.md](../../EVENTS.md), [DOMAIN-MODEL.md](../../DOMAIN-MODEL.md) §3).
- Schema migrations must be applied to every tenant database individually (tooling requirement addressed in [DATABASE.md](../../DATABASE.md) §6).
