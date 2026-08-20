# Offline-First POS

Status: Implemented, Phase 12 ("true foundation" scope — see [ADR-0003](./docs/adr/0003-offline-pos.md)'s Update for exactly what shipped vs. what's still open, and [apps/pos/README.md](./apps/pos/README.md) for how to run it).

## 1. Architecture

```text
POS UI
 ↓
Local application state
 ↓
IndexedDB / local persistence
 ↓
Sync Queue
 ↓
Online API
 ↓
Tenant Backend
```

The POS app (`apps/pos`) is designed offline-first: every cashier action writes to local state and IndexedDB first, and is queued for sync. The UI never blocks on network availability for the golden-path flow (search → scan → add → quantity → discount → customer → payment → complete sale → receipt).

## 2. Local persistence contents (CLAUDE.md §17)

Stored locally on the terminal:

```text
products, prices, tax configuration, customers,
terminal configuration, pending orders, pending payments, sync state
```

Reference data (products/prices/tax/customers) is synced down opportunistically and cached with a version marker so the terminal can detect staleness once connectivity returns, without blocking offline sales in the meantime.

## 3. Terminal identity (CLAUDE.md §18)

```text
tenant → branch → terminal → device
```

Each terminal persists: `terminal_id`, `device_id`, `branch_id`, `last_sync`, `sync_version`, `status`. Terminal identity is established once (registration, online) and then used to scope every offline-generated record and every idempotency key.

## 4. Idempotency (CLAUDE.md §19)

Every financial/order sync operation carries a deterministic idempotency key:

```text
POS-TERM-001-20260819-000123
```

On retry (network failure, client re-send, duplicate sync attempt), the server recognizes the same key and returns the previously-recorded result rather than creating a new order/payment. Idempotency keys are generated client-side at the moment of order/payment creation (not at sync time), so retries of the *same* underlying action always carry the *same* key even across app restarts.

## 5. Conflict management (CLAUDE.md §20)

Conflicts are never silently overwritten. Each conflict class has an explicit, documented policy:

| Conflict | Policy |
|---|---|
| Product price changed online while offline cart used old price | Deterministic: honor the price at time of sale (captured in the offline order), flag for manual review if the delta exceeds a configurable threshold |
| Stock changed online (oversold while offline) | Deterministic: order still completes (POS must never block a completed sale); a negative-inventory / backorder event is raised for `inventory` to reconcile, per the module's oversell policy |
| Customer record changed online | Deterministic: server record wins for customer master data; the offline order's customer *reference* is preserved even if display fields differ |
| Order already refunded (double sync) | Deterministic, via idempotency key: second sync attempt returns the original result, no duplicate refund |
| Payment already processed (double sync) | Deterministic, via idempotency key: same as above |

Any conflict not covered by a deterministic policy is queued for manual resolution in an admin-facing review, never auto-resolved silently.

## 6. Sync queue behavior

- Durable: queue entries survive app restart/crash (persisted in IndexedDB, not memory).
- Ordered per terminal: entries sync in the order they were created to preserve causal consistency for a single terminal's actions.
- Retried with backoff + jitter on failure (see resilience principles in [ARCHITECTURE.md](./ARCHITECTURE.md) §6 and CLAUDE.md §26), never retried in a tight loop.
- Each entry's eventual server response (success, or a well-defined conflict resolution) is written back to local state so the UI can reflect final status.

## 7. Relationship to other modules

Offline POS sync ultimately calls the same `pos` module application-layer use cases as an online POS request — the offline queue is a client-side durability and retry mechanism in front of the same server-side API, not a parallel code path. This keeps the "module owns its data" rule intact: the offline client never writes directly to Inventory/Payments state, it only ever calls POS's own interface, which in turn calls Inventory/Payments through their application interfaces (per [ARCHITECTURE.md](./ARCHITECTURE.md) §4).
