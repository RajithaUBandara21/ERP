# ADR-0003: Offline-First POS Architecture

- Status: Accepted
- Date: 2026-08-19

## Context

POS terminals must keep selling during network outages (CLAUDE.md §17) — a POS that stops working offline is a non-starter for retail use. This requires local durability, a sync mechanism, idempotent server-side application of synced actions, and explicit conflict handling, without corrupting inventory/payment state when connectivity returns.

## Decision

`apps/pos` maintains local application state backed by IndexedDB, with a durable, ordered sync queue per terminal. Every financial/order action generated offline carries a client-generated idempotency key (`POS-TERM-{terminal}-{date}-{seq}`) so server-side replay of a retried sync is a no-op returning the original result, never a duplicate. Sync ultimately invokes the same `pos` module application-layer use cases as an online request — offline is a client-side durability/retry layer in front of one server-side code path, not a separate one. Conflict classes (price changed, stock changed, customer changed, already-refunded, already-processed) each have an explicit, documented resolution policy — see [OFFLINE-POS.md](../../OFFLINE-POS.md) §5 — rather than "last write wins."

## Alternatives Considered

- **Online-only POS with a "can't sell right now" fallback during outages**: rejected — directly contradicts the product requirement (CLAUDE.md §17) and is commercially unacceptable for a retail POS.
- **Optimistic last-write-wins sync with no idempotency keys**: rejected — CLAUDE.md §19–20 explicitly forbid duplicate orders/payments from retries and silent conflict overwrites; this is a financial-correctness requirement, not a nice-to-have.
- **CRDVs / operational-transform-based sync**: rejected as overkill — POS actions (create order, add line, apply payment) are naturally expressed as idempotent commands with deterministic conflict policies; general-purpose CRDT merge semantics are not needed for this domain and would add significant complexity (CLAUDE.md §55, do not overengineer).

## Consequences

- Every POS-originated write path must be designed idempotent from the start (Phase 8, POS Foundation) even before offline support itself is implemented (Phase 12) — retrofitting idempotency later would be far more invasive.
- Requires terminal identity (`terminal_id`/`device_id`/`branch_id`) to exist before offline sync can be built (CLAUDE.md §18), since idempotency keys and conflict scoping depend on it.
- Conflict policies must be documented and reviewed per class (§20) rather than left to implicit merge behavior — increases upfront design work but eliminates a whole class of "silently wrong inventory/financial state" bugs.
