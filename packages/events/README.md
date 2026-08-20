# packages/events

Domain event envelope, transactional outbox, and outbox publisher (see [EVENTS.md](../../EVENTS.md) and [ADR-0004](../../docs/adr/0004-outbox-pattern.md)).

Implemented (Phase 13): `writeOutboxEvent()` — call it with the same `db`/`tx` handle the business write it describes just used, inside that write's own `db.transaction()`, so the business fact and the event-to-publish commit atomically. `publishPendingEvents()` dispatches each pending row to every registered `EventConsumer` for its event type, idempotently per `(event, consumer)` pair (CLAUDE.md §25), and dead-letters an event after 5 consecutive failures by any one consumer.

Not a `ModuleManifest` — the outbox table's migration runs via `modules/core`'s own `applyMigrations` hook instead, since it must exist before any module might publish (see `src/apply-migrations.ts`'s doc comment). No background scheduler triggers `publishPendingEvents` yet (CLAUDE.md §27) — `apps/web` exposes it as a permission-gated `POST /api/events/publish` in the meantime.

See `modules/pos/src/application/checkout.ts` for the reference producer (`OrderPaid`, written in the same transaction as the sale) and `modules/delivery/src/application/order-paid-consumer.ts` for the reference consumer (EVENTS.md §6's worked example).
