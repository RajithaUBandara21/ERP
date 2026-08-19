# Scalability

Not duplicated at the top level — see [ARCHITECTURE.md](../../ARCHITECTURE.md) for the overall system design this document scales.

## Target scale (CLAUDE.md §2)

```text
Businesses:              1,000
Users/business:          up to 2,000
POS terminals/business:  up to 50
Orders/day/business:     potentially very high
```

The architecture is designed so it *can* scale toward these numbers, without provisioning for them during initial development. The demo environment stays cheap by hosting a handful of seeded tenants on shared infrastructure (see [DEPLOYMENT.md](../../DEPLOYMENT.md) §3 and [DATABASE.md](../../DATABASE.md) §3).

## What scales independently

Because tenant databases are physically independent (see [MULTI-TENANCY.md](../../MULTI-TENANCY.md)), scaling is largely a *data placement* problem, not an application redesign problem:

- A tenant approaching its database's capacity limits is moved to a dedicated instance by updating its `tenant_database_registry` row and physically migrating the database — the application code path is unchanged.
- POS terminal load is naturally partitioned per tenant per branch; there is no shared mutable state across tenants to contend on.
- Read-heavy reporting queries are isolated from the OLTP path via read-optimized queries and background aggregation first (see [ARCHITECTURE.md](../../ARCHITECTURE.md) and CLAUDE.md §52), with a dedicated analytics store introduced only once justified by measured load.

## Anticipated scaling levers (introduced only when measurement justifies them — CLAUDE.md §56)

| Bottleneck | Lever |
|---|---|
| Single Postgres instance hosting many tenant databases | Redistribute tenants across instances via the registry |
| High-traffic tenant's OLTP path | Read replicas for that tenant's database |
| Report/export generation | Background jobs + materialized views (see [DATABASE.md](../../DATABASE.md) §7, CLAUDE.md §51–52) |
| Serverless connection limits | External pooler + bounded per-tenant connection registry (see [DATABASE.md](../../DATABASE.md) §4) |
| Hot reference data (catalog, config, permissions) | Tenant-scoped Redis caching with explicit TTL/invalidation (see [DATABASE.md](../../DATABASE.md) §8) |

## Explicit non-goals until justified

Kubernetes, a message broker (Kafka/etc.), microservices, service mesh, or per-module databases are not introduced speculatively (CLAUDE.md §55). The modular monolith is designed so any of these become *additive* changes later (e.g. extracting one module to its own service) rather than requiring a rewrite — see [ADR-0001](../adr/0001-modular-monolith.md).
