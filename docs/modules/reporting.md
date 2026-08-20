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

## Implementation status (Phase 14)

- **Built**: one read model, `SalesDailySummary` (date, transaction count, total cents), populated by `application/order-paid-report-consumer.ts` reacting to `pos`'s `OrderPaid` event — the second real consumer of that event alongside `delivery`'s (Phase 13), proving the outbox can fan an event out to independent modules. Buckets by the event's own `createdAt` (UTC date), not wall-clock publish time, so a late-published event still lands on the day the sale happened. Increments use `INSERT ... ON CONFLICT DO UPDATE SET col = col + delta` (proven correct under 20 concurrent increments to the same date in `tests/sales-summary-lifecycle.integration.test.ts` — a read-then-write implementation would lose updates here). `GET /api/reporting/sales-summary` (gated by `REPORTING.SALES.READ`) exposes it with cursor pagination (`packages/validation`'s `paginationCursorSchema`, newest date first, `limit+1` fetch to detect `hasMore`).
- **Dependencies**: `core`/`tenant`/`identity` only, exactly as planned above — no hard dependency on `pos`, `inventory`, `payments`, or `delivery`, even though it reports on data those modules produce. This was verified live: installing `reporting` and publishing an `OrderPaid` event with `delivery` *not yet installed* still updated the sales summary correctly (the reporting consumer succeeded independently; only the unrelated delivery consumer failed until `delivery` was installed).
- **Not yet built**: no CSV/file export (needs the object-storage + background-job infrastructure described above, neither of which exists yet), no materialized views/analytics warehouse, and only one report (sales-by-day) — CLAUDE.md §52's "read-optimized queries + background aggregation" foundation is in place for adding more reports the same way (a new consumer + a new read model + a new cursor-paginated query route) without revisiting this architecture.
