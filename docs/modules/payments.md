# Module: payments

## Domain ownership

`payments` owns everything about how money is captured/returned, independent of what was purchased:

- Payment attempts
- Payment methods
- Refunds
- Provider transaction records

## Owned entities

`PaymentAttempt`, `PaymentMethod`, `Refund`, `ProviderTransaction`

## Dependencies

```text
payments
 ├── core
 ├── tenant
 └── identity
```

## Depended on by

`pos` (checkout/capture), `accounting` (ledger entries derived from payment events).

## Notes

`payments` never owns order/cart state — `pos` and `sales` own what is being paid for; `payments` owns the payment side of the transaction only, linked by order ID. Provider abstraction:

```text
PaymentService
 ├── CashProvider
 ├── CardProvider
 ├── BankProvider
 └── GatewayProvider
```

No payment provider is hardcoded into order logic in `pos` or `sales` — they call `payments`' application interface (`authorize`, `capture`, `refund`) which dispatches to the appropriate provider adapter. Raw card data is never stored; provider tokenization is used exclusively. Every capture/refund operation is idempotent (keyed) and webhook/callback-driven reconciliation is validated against provider signatures before being trusted (CLAUDE.md §33, [SECURITY.md](../../SECURITY.md) §3).

## Implementation status (Phase 10)

- **Built**: `PaymentAttempt` (idempotency-keyed, tracks `capturedAmountCents`/`refundedAmountCents`) and `Refund` as owned entities; `capturePayment`/`refundPayment`/`getPaymentAttempt` use cases; concurrency-safe `DrizzlePaymentAttemptRepository.applyRefund` (row-locks the payment attempt inside a transaction, proven to prevent over-refunding under genuine concurrent connections — same pattern as `modules/inventory`'s stock ledger); HTTP routes under `apps/web/src/app/api/payments/attempts/*`.
- **Providers**: `CashProvider` is a real, complete implementation (cash has no external gateway to call — capture/refund are till operations). `SimulatedCardProvider` is an explicitly-documented stand-in, not a real gateway integration (no Stripe/Adyen/etc. chosen or evaluated) — it proves the `PaymentProvider` adapter shape (tokenized input, async capture/refund, a declinable outcome) is correct and swappable. It declines when given the sentinel token `"tok_declined"`.
- **Not yet built**: `authorize` (separate from `capture`) — this phase went straight to capture, matching how POS checkout actually uses it; webhook/callback-driven reconciliation — no real gateway means no real webhooks to validate yet.
- **POS integration**: `modules/pos`'s `PaymentCapturePort` now has a real `PaymentsCapturePort` implementation, dispatching by `method` ("cash"/"card") to the corresponding provider. `checkout()`'s idempotency key is reused as both the `PaymentAttempt`'s own idempotency guard and its `reference` (so the payment ledger stays traceable back to the POS transaction that caused it) — a retried checkout never captures twice. `pos`'s manifest now declares a hard dependency on `payments`.
- **Refund is reachable only through `payments`' own API** (`POST /api/payments/attempts/[attemptId]/refund`), not through a `pos`-level route — `pos`'s `ORDER_REFUND` permission is still declared but unimplemented (same "declared, not wired" precedent as `inventory`'s `STOCK_TRANSFER`). Refunding is architecturally payments' job; a future POS-level refund UX would call this same route, not reimplement refund logic.
