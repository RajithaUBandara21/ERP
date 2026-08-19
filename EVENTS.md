# Events

Status: Phase 1 (architecture only). Implementation begins Phase 13. See [ADR-0004](./docs/adr/0004-outbox-pattern.md).

## 1. Why events

Modules never call into another module's database. Where the interaction is *synchronous and required for the current operation to succeed* (e.g. POS needs a stock decision before completing a sale), it goes through a direct application-interface call ([ARCHITECTURE.md](./ARCHITECTURE.md) §4). Where the interaction is a *reaction to something that already happened* (e.g. Accounting recording a ledger entry once a payment is captured), it goes through a domain event.

## 2. Representative events (CLAUDE.md §23)

```text
OrderCreated, OrderPaid, OrderCancelled
StockReserved, StockReleased
DeliveryCreated, DeliveryAssigned, DeliveryCompleted
PaymentCaptured, PaymentRefunded
```

Events contain stable identifiers (`tenantId`, aggregate IDs, event type/version, timestamp) rather than large payloads of sensitive data — consumers that need more detail than the event carries look it up through the owning module's query interface, keeping the event contract stable even as the owning module's internal shape evolves.

## 3. Outbox pattern

```text
DB Transaction
 ├── Business Data
 └── Outbox Event
          ↓
    Event Publisher
          ↓
      Broker/Queue
```

An event is never published as a side effect that can fail independently of the business write it describes. The business state change and the outbox row recording the event to publish are written in the **same database transaction**, in the tenant's own database. A separate publisher process polls (or uses logical replication from) the outbox table and delivers events to consumers, marking them delivered. This guarantees "the event was recorded" and "the business fact is true" are never out of sync, without requiring a distributed transaction (CLAUDE.md §24, consistent with the "no distributed transactions unless necessary" rule in §55).

No external broker (Kafka, etc.) is introduced for this in Phase 1–13; the outbox table plus an in-process/scheduled publisher is sufficient at the target scale and keeps the deployment simple (CLAUDE.md §55). This is revisited only if a measured throughput requirement demands it.

## 4. Event envelope

```text
event_id        — unique, used for consumer-side deduplication
aggregate_id     — the entity the event is about
tenant_id
event_type
version          — schema version of the payload
created_at
payload
```

## 5. Consumer requirements (CLAUDE.md §25)

Every event consumer must be:

- **Idempotent** — processing the same `event_id` twice produces the same end state as processing it once (consumers track processed `event_id`s or perform naturally idempotent upserts).
- **Retryable** — a failed handler can be re-invoked safely.
- **Observable** — consumption success/failure/latency is logged and measurable (see [docs/architecture/observability.md](./docs/architecture/observability.md)).
- **Failure tolerant** — a poison/malformed event goes to a dead-letter path rather than blocking the consumer indefinitely.

## 6. Cross-module workflow example

```text
POS completes a sale
 → pos module: creates PosTransaction, calls Inventory's application interface synchronously to decrement stock (must succeed or the sale fails)
 → pos module: calls Payments' application interface synchronously to capture payment (must succeed or the sale fails)
 → pos module: commits, writes OrderPaid to its own outbox in the same transaction
 → outbox publisher delivers OrderPaid
 → accounting module (consumer): idempotently creates a ledger entry
 → delivery module (consumer, if applicable): idempotently creates a pending Delivery
```

Everything required for the sale itself to succeed is synchronous within one transaction boundary; everything that is a *downstream reaction* to the completed sale is asynchronous via the outbox. This is the transaction-boundary pattern referenced in CLAUDE.md §22: `transactional database operations + idempotency + outbox + compensating actions` for cross-module workflows, with compensating actions defined per-workflow where a downstream reaction can itself fail (e.g. delivery creation failing does not roll back the sale — it is retried/alerted instead).
