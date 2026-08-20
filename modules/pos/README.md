# modules/pos

Owns: POS transactions, carts, terminals. (Receipts and terminal sessions not yet built — no current consumer.)

Implemented (Phase 8 "true foundation", Phase 9 and 10 retrofits — see [docs/modules/pos.md](../../docs/modules/pos.md)): terminal registration, cart lifecycle (create/add-line/remove-line), and an idempotent checkout flow producing a `PosTransaction`. Depends on `core`/`tenant`/`identity`/`inventory`/`payments` — checkout reserves stock via a real `InventoryStockReservationPort`, then captures payment via a real `PaymentsCapturePort`: on success it confirms the stock reservation; on a declined/failed payment it releases the reservation instead of leaving it dangling. Offline sync lands in Phase 12.

Opt-in module — not installed by `apps/web/scripts/bootstrap-tenant.ts`; install explicitly via `POST /api/modules/pos/install` (requires `inventory` and `payments` to be installed first).
