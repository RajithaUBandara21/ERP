# ADR-0009: Tenant Database Physical Placement per Environment

- Status: Accepted
- Date: 2026-08-19

## Context

ADR-0002 establishes database-per-tenant as the isolation model. CLAUDE.md §2 requires the demo environment to stay inexpensive and explicitly forbids provisioning for the full 1,000-tenant target during development. Serverless deployment (Vercel, for the demo environment) has real Postgres connection-count constraints that a naive "one connection pool per tenant per function instance" model would exhaust quickly.

## Decision

Physical placement differs by environment; the connection **mechanism** does not (see [DATABASE.md](../../DATABASE.md) §3 and [MULTI-TENANCY.md](../../MULTI-TENANCY.md) §3, which this ADR must stay consistent with):

- Each tenant gets one real Postgres **database** (`CREATE DATABASE`), not merely a schema — preserving ADR-0002's connection-level isolation boundary regardless of how many databases share a physical server.
- **Dev**: all tenant databases live in one local Docker Postgres container.
- **Demo**: a small shared managed instance (e.g. one Neon project) hosts the control plane plus a handful of seeded demo tenant databases — enough to prove the mechanism, not the target scale.
- **Production**: tenant databases are distributed across one or more instances/clusters as load requires; a large tenant can be moved to a dedicated instance later.

In every environment, the control-plane `tenant_database_registry` table holds the authoritative connection string per tenant; the application always connects to whatever that row says. Moving a tenant between physical placements is a data-migration operation (copy the database, update the registry row) with **zero application code change**.

Connection exhaustion under serverless concurrency is mitigated by: (1) an external pooler in front of Postgres (managed provider's built-in pooler, e.g. Neon's, or PgBouncer) in transaction-pooling mode, so serverless functions never hold a raw long-lived connection; (2) an in-app LRU tenant-connection registry bounding resident pools per function instance, with each tenant pool kept small (1–3 connections); (3) preferring a serverless-native driver (e.g. Neon's HTTP/WebSocket driver) for read-heavy paths where available, avoiding pool pressure for those requests entirely.

## Alternatives Considered

- **One dedicated Postgres instance per tenant, even in demo**: rejected — cost-prohibitive and unnecessary; the demo's purpose is to prove the architecture works, not to simulate 1,000 tenants' worth of infrastructure (CLAUDE.md §2).
- **Schema-per-tenant instead of database-per-tenant, to reduce the number of physical databases**: rejected as the primary model per ADR-0002's rationale — schemas share connection-level Postgres permissions/roles in a way separate databases do not, weakening the isolation boundary the platform's security story depends on.
- **No pooler, rely on each serverless function opening its own direct connection**: rejected — a known failure mode for Postgres-behind-serverless deployments; would cause connection exhaustion well before reaching even the demo environment's modest tenant count under any real concurrent load.

## Consequences

- The demo environment stays cheap (one shared small instance) while still exercising the real database-per-tenant code path — no "demo-only shortcut" that diverges from production behavior.
- Production capacity planning (how many tenants per instance, when to split out a dedicated instance) is a data/operations decision made with real usage evidence, not a day-one architectural commitment (CLAUDE.md §56).
- Requires the pooling strategy (external pooler + bounded in-app registry) to be built into `packages/database` from Phase 2, not added reactively after a connection-exhaustion incident.
