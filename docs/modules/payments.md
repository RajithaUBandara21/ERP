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
