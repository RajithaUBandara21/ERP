# ADR-0004: Transactional Outbox for Event Publishing

- Status: Accepted (implemented, Phase 13 — see Update below)
- Date: 2026-08-19

## Context

Modules integrate via domain events (CLAUDE.md §23) rather than direct database access (ADR-0001). A naive "commit business data, then publish an event" sequence has an unavoidable failure window: the process can crash or the publish call can fail *after* the business commit succeeds, silently dropping the event and leaving downstream modules (accounting, delivery, reporting) permanently unaware a fact occurred.

## Decision

Every domain event is written to an `outbox` table in the **same database transaction** as the business state change it describes, within the tenant's own database. A separate publisher process polls (or uses logical replication on) the outbox table and delivers events to consumers, marking rows delivered. No distributed transaction is used; the guarantee comes entirely from the outbox row and the business write being atomic within one Postgres transaction (CLAUDE.md §24).

## Alternatives Considered

- **Dual write (commit DB, then publish to a broker)**: rejected — exactly the failure mode this ADR exists to prevent (CLAUDE.md §24 explicitly forbids relying on "database commit + publish message" without transactional reliability).
- **External message broker (Kafka, RabbitMQ, SQS) as the primary integration mechanism**: rejected for this phase — introduces an additional infrastructure dependency and operational surface not yet justified at current scale (CLAUDE.md §55). The outbox table + polling/logical-replication publisher is sufficient and can be swapped for a broker-backed publisher later without changing how modules author or consume events, since the event envelope (§[EVENTS.md](../../EVENTS.md) §4) does not depend on the transport.
- **Change-data-capture directly off business tables (no outbox table)**: rejected as a starting point — it couples the event contract to internal table shape, making a later table refactor a breaking change for consumers; a dedicated outbox table gives an explicit, stable event contract independent of internal schema.

## Consequences

- Every module that publishes events needs an `outbox` write as part of its transactional unit of work — a pattern to bake into the application layer's transaction-boundary helper from Phase 2 onward, not bolt on later.
- The publisher becomes a small piece of shared infrastructure (`packages/events`) rather than per-module bespoke code.
- Consumers must still be idempotent (CLAUDE.md §25) since at-least-once delivery is the realistic guarantee (a publisher crash after delivery but before marking delivered can redeliver).
- Swapping the transport (e.g. to a broker) later is additive — event producers and consumers do not need to change, only the publisher's delivery mechanism.

## Update (Phase 13 implementation)

Built in `packages/events`: an `outbox` table (event envelope, delivery/dead-letter timestamps, attempt count) plus a `processed_events` table recording per-`(event, consumer)` delivery — CLAUDE.md §25's dedup ledger, not just the naive "one delivered_at on the outbox row" version, since different consumers of the same event succeed and fail independently. `publishPendingEvents()` dispatches each pending row to every consumer registered for its event type, marks the row fully delivered only once every consumer that saw it that cycle succeeded, and dead-letters (stops retrying) after `MAX_DELIVERY_ATTEMPTS` (5) consecutive failures by any one consumer.

**Where the outbox migration actually runs**: not from a `packages/events` ModuleManifest — packages/events isn't a business module, and the outbox needs to exist before *any* module might publish, not conditionally on one being installed. Instead `modules/core`'s own `applyMigrations` hook (previously unset — core owned no tables at all) now calls `applyEventsMigrations`, since core is the one module every tenant always installs first.

**The producer**: `modules/pos`'s `checkout()` now wraps its final writes — creating the `PosTransaction` row, closing the cart, and writing the `OrderPaid` outbox event — in one `db.transaction()`, genuinely verified against real Postgres: an event written inside a transaction that's then rolled back never appears in the outbox. This required widening `TenantDb`'s type (`packages/database`) to a union with the type `db.transaction()`'s own callback receives — `PostgresJsDatabase` and the transaction handle are separate, non-inheriting classes in drizzle-orm that both extend a common base, so passing a `tx` into a repository function typed to accept `TenantDb` was a real type error before this; the union is inferred directly from `.transaction()`'s own declared signature rather than importing drizzle-orm's transaction class by name, so it stays correct even if that class is renamed or stops being exported.

**The consumer**: `modules/delivery` implements EVENTS.md §6's own worked example almost verbatim — `OrderPaid` idempotently creates a pending `Delivery` referencing the paid transaction. Documented simplification: there's no real "this order needs delivery" signal anywhere yet (`checkout()` has no fulfillment-method field), so every `OrderPaid` currently creates one unconditionally.

**No background scheduler exists yet** (CLAUDE.md §27's job system isn't built) — `publishPendingEvents` is a plain callable function, triggered for now via a permission-gated `POST /api/events/publish` (owner-only; `CORE.EVENTS.PUBLISH` isn't granted to the seeded "member" role). Live-verified end to end: a real POS checkout, confirmed to leave delivery untouched until publishing runs, then confirmed to create exactly one pending Delivery after publishing — and still exactly one after publishing a second time.

A build-tooling note, not an architectural one: `modules/core` depending on `@erp/events` (for the migration call) meant `packages/events`' own tests could not also depend on `@erp/core` — pnpm flags that as a genuine cyclic workspace dependency. `packages/events`' tests prove its migration and repository work by calling `applyEventsMigrations` directly; the separate proof that installing "core" through the real module registry actually triggers it lives in `modules/core`'s own test suite instead, where the dependency is legitimately one-directional.
