# modules/payments

Owns: payment attempts, refunds, provider transaction records. (Payment methods on file, and `authorize` as a step separate from `capture`, are not yet built — no current consumer.)

Implemented (Phase 10 — see [docs/modules/payments.md](../../docs/modules/payments.md)): idempotent capture, concurrency-safe partial/full refund (row-locked, proven under genuine concurrent connections). `CashProvider` is real and complete; `SimulatedCardProvider` is an explicitly-documented stand-in, not a real gateway integration — it proves the `PaymentProvider` adapter shape is correct and swappable. `modules/pos` depends on this module for real payment capture.

Opt-in module — not installed by `apps/web/scripts/bootstrap-tenant.ts`; install explicitly via `POST /api/modules/payments/install` (before `pos`, which now depends on it).
