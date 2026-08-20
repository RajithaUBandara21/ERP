# modules/reporting

Owns: read-optimized aggregates/materialized views built from other modules' events. Owns no operational data.

Implemented (Phase 14 — see [docs/modules/reporting.md](../../docs/modules/reporting.md)): one read model, `SalesDailySummary`, populated by a consumer reacting to `pos`'s `OrderPaid` event and exposed via `GET /api/reporting/sales-summary` with cursor pagination. Depends only on `core`/`tenant`/`identity` — no hard dependency on the modules it reports on; it subscribes to their published events instead (see `module.manifest.ts`'s doc comment and CLAUDE.md §10/§52).

Opt-in module — not installed by `apps/web/scripts/bootstrap-tenant.ts`; install explicitly via `POST /api/modules/reporting/install`.
