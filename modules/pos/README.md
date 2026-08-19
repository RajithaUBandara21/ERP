# modules/pos

Owns: POS transactions, carts, terminals. (Receipts and terminal sessions not yet built — no current consumer.)

Implemented (Phase 8, "true foundation" — see [docs/modules/pos.md](../../docs/modules/pos.md)): terminal registration, cart lifecycle (create/add-line/remove-line), and an idempotent checkout flow producing a `PosTransaction`. Depends only on `core`/`tenant`/`identity` — stock reservation and payment capture go through stubbed `StockReservationPort`/`PaymentCapturePort` interfaces, to be replaced with real `inventory`/`payments` integrations once those modules exist (Phases 9–10). Offline sync lands in Phase 12.

Opt-in module — not installed by `apps/web/scripts/bootstrap-tenant.ts`; install explicitly via `POST /api/modules/pos/install`.
