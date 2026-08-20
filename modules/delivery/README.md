# modules/delivery

Owns: deliveries, drivers, assignments, delivery status.

Implemented (Phase 11 — see [docs/modules/delivery.md](../../docs/modules/delivery.md)): driver registration, delivery creation, a state machine (assign → mid-flight reassign, or complete; fail → retry/reassign, per CLAUDE.md §34), and an append-only `DeliveryAssignment` audit ledger. Depends only on `core`/`tenant`/`identity` — no `sales` module exists in this codebase, so `Delivery.orderReference` is an opaque string (e.g. a `PosTransaction` id), not a foreign key. No external-provider dispatch abstraction yet (internal driver assignment needs no external call) — see the doc's Implementation status section.

Opt-in module — not installed by `apps/web/scripts/bootstrap-tenant.ts`; install explicitly via `POST /api/modules/delivery/install`.
