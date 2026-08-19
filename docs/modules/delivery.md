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
