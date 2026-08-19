# Module: pos

## Domain ownership

`pos` owns point-of-sale transaction state:

- POS transactions
- Carts
- Receipts
- Terminals and terminal sessions

## Owned entities

`PosTransaction`, `Cart`, `Receipt`, `Terminal`, `TerminalSession`

## Dependencies

```text
pos
 ├── core
 ├── tenant
 ├── identity
 ├── sales        (customer lookup, order creation — see docs/modules/sales.md)
 ├── inventory    (stock check/deduction)
 └── payments     (checkout/capture)
```

## Depended on by

`delivery` (indirectly, via the sales order a POS transaction may create), `accounting` (ledger entries derived from POS payment events), `reporting`.

## Notes

`pos` never writes to Inventory's or Payments' tables directly — every checkout calls Inventory's application interface to reserve/deduct stock and Payments' application interface to capture funds, both within the same transaction boundary as creating the `PosTransaction` (CLAUDE.md §22). This is also why `pos` depends on `inventory` and `payments` directly rather than only on `sales`: POS is the "orchestrator" module (§9's example lists it depending on Core, Customer [→ owned by `sales`], and Payments).

POS is designed offline-first from the start (see [OFFLINE-POS.md](../../OFFLINE-POS.md) and [ADR-0003](../adr/0003-offline-pos.md)): every write path this module exposes must be idempotent, because the same operation may be replayed by the offline sync queue.

## Implementation status (Phase 8 — "true foundation")

CLAUDE.md §54 sequences POS foundation (Phase 8) before Inventory (Phase 9) and Payments (Phase 10), but the target dependency graph above requires both. Rather than block on reordering the whole roadmap, Phase 8 built what POS itself owns now and deferred the rest:

- **Built**: `Terminal`, `Cart`/`CartLine`, `PosTransaction` (owned entities), register-terminal / create-cart / add-cart-line / remove-cart-line / checkout use cases, Drizzle persistence, and permission-gated HTTP routes under `apps/web/src/app/api/pos/*`.
- **Not yet built**: `Receipt`, `TerminalSession` — deferred, no current consumer.
- **Manifest dependencies today**: `core`, `tenant`, `identity` only — **not** `sales`/`inventory`/`payments`, since none of those modules exist yet. `modules/pos/src/module.manifest.ts` documents this as intentional, not an oversight.
- **Stubbed integration points**: `checkout()` (`modules/pos/src/application/checkout.ts`) calls a `StockReservationPort` and a `PaymentCapturePort` — interfaces, not real integrations. Current implementations are `NoopStockReservationPort` (does nothing) and `AlwaysSucceedsPaymentCapturePort` (always reports success). Real stock reservation/deduction and real payment capture land when Phase 9 (Inventory) and Phase 10 (Payments) exist; call sites in the routes/use case do not need to change — only the port implementations get swapped, and the manifest's dependency list gets amended to add `inventory`/`payments` at that point.
- **Idempotency**: `checkout()` is idempotent on `idempotencyKey` (format enforced by `packages/validation`'s `idempotencyKeySchema`) — a retried checkout with the same key returns the original `PosTransaction` rather than creating a duplicate or re-capturing payment. Verified in `modules/pos/tests/checkout.test.ts` and live via `apps/web/tests/pos-flow.integration.test.ts`.
- **Opt-in module**: unlike core/tenant/identity, `pos` is not auto-installed by `apps/web/scripts/bootstrap-tenant.ts` — a tenant must explicitly `POST /api/modules/pos/install`.
