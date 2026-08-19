# ADR-0004: Transactional Outbox for Event Publishing

- Status: Accepted
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
