# modules/inventory

Owns: warehouses, stock levels (a projection), stock movement ledger, reservations.

Implemented (Phase 9 — see [docs/modules/inventory.md](../../docs/modules/inventory.md)): warehouse creation, receive/adjust/reserve/release/confirm-sale use cases, and a concurrency-safe `DrizzleStockRepository` that row-locks per (warehouse, sku) inside a transaction — proven to prevent overselling under genuine concurrent connections. `modules/pos` depends on this module for real stock reservation/deduction.

Opt-in module — not installed by `apps/web/scripts/bootstrap-tenant.ts`; install explicitly via `POST /api/modules/inventory/install` (before `pos`, which now depends on it).
