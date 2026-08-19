# Module: reporting

## Domain ownership

`reporting` owns read-optimized aggregates and materialized views built from other modules' published events — it owns no transactional/operational data of its own.

## Owned entities

Module-specific read models / materialized views (defined per report, not a fixed aggregate list).

## Dependencies

```text
reporting
 ├── core
 └── tenant
 (soft/event-based subscription to whichever other modules are installed for a tenant)
```

## Depended on by

Nothing — `reporting` is the top of the dependency graph (topological layer 4, [DOMAIN-MODEL.md](../../DOMAIN-MODEL.md) §3).

## Notes

`reporting` is deliberately **not** given a hard manifest dependency on every module it might report on. Instead it subscribes to domain events published by whichever modules are active for a given tenant and builds its own read models from them — this avoids `reporting` becoming a dependency bottleneck as new modules are added, while still respecting "no direct database access to another module's tables" (CLAUDE.md §10). This also naturally satisfies CLAUDE.md §52's guidance to protect OLTP performance: reporting queries never run against `sales`/`inventory`/`pos`'s live tables, only against reporting's own pre-aggregated read models, populated by background jobs consuming the outbox.

Large exports follow the pattern in CLAUDE.md §51: request → background job → generate file → object storage → signed download URL. Never a synchronous `SELECT *` over millions of rows inside a request.
