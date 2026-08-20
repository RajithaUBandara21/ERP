# Module: delivery

## Domain ownership

`delivery` owns fulfillment/delivery state:

- Deliveries
- Drivers
- Assignments
- Delivery status

## Owned entities

`Delivery`, `Driver`, `DeliveryAssignment`

## Dependencies

```text
delivery
 ├── core
 ├── tenant
 └── sales        (order reference, customer/address — see docs/modules/sales.md)
```

## Depended on by

`accounting` (may reference delivery completion for revenue recognition timing, if applicable), `reporting`.

## Notes

`delivery` references a `SalesOrder` by ID; it does not own or duplicate order data. Provider abstraction:

```text
DeliveryService
 ├── InternalDriverProvider
 ├── ExternalProviderA
 └── ExternalProviderB
```

A third-party delivery provider's failure must never corrupt the underlying order — delivery failures are handled within `delivery`'s own state machine (retry, reassign, manual fallback) and reported via domain events (`DeliveryAssigned`, `DeliveryCompleted`), without requiring `sales` or `pos` to roll back the sale itself (CLAUDE.md §34, [EVENTS.md](../../EVENTS.md) §6).

## Implementation status (Phase 11)

- **Built**: `Driver`, `Delivery`, and `DeliveryAssignment` (an append-only audit ledger of every assign/reassign — `Delivery.driverId` is the current-state projection, same ledger+projection pattern as `modules/inventory`'s stock levels) as owned entities; `registerDriver`/`createDelivery`/`assignDriver`/`completeDelivery`/`failDelivery` use cases; HTTP routes under `apps/web/src/app/api/delivery/*`.
- **Dependency change from the original plan**: depends on `core`/`tenant`/`identity` only, **not** `sales` — no `sales` module exists in this codebase, and it isn't one of CLAUDE.md §54's 19 scheduled phases. `Delivery.orderReference` is a plain opaque string (e.g. a `PosTransaction` id), not a foreign key — the same "self-contained snapshot" choice `modules/pos` made for `CartLine` before any product catalog existed. See `module.manifest.ts`'s doc comment.
- **State machine**: `pending → assigned` (first assignment); `assigned → assigned` (a dispatcher swapping drivers before completion — a normal operation, not a failure); `assigned/pending → failed` and `failed → assigned` (the "retry, reassign" path CLAUDE.md §34 describes); `assigned → completed` (terminal). Live-verified end to end, including the fail → reassign → complete path and rejection of any transition out of `completed`.
- **Not yet built**: the `DeliveryService`/`InternalDriverProvider`/`ExternalProviderA`/`ExternalProviderB` provider abstraction shown above — internal driver assignment is a pure local operation (no external system to call), so no provider seam was needed to implement it correctly. An external-provider integration would need this abstraction; it doesn't exist yet since there's no real third-party delivery API integrated (same "don't build unused abstraction" reasoning CLAUDE.md §55 and §63 apply elsewhere). `DeliveryAssigned`/`DeliveryCompleted` domain events are not yet published — no event bus exists yet (Phase 13).
