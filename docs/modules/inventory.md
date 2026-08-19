# Module: inventory

## Domain ownership

`inventory` owns stock truth:

- Stock levels (per warehouse, derived — see below)
- Stock movement ledger
- Stock reservations

## Owned entities

`StockItem`, `StockMovement`, `StockReservation`

## Dependencies

```text
inventory
 ├── core
 └── tenant       (warehouse organizational structure, owned by tenant, referenced by ID)
```

## Depended on by

`pos` (stock check/deduction at checkout), `purchasing` (records `RECEIPT` movements via inventory's interface), `accounting` (may reference stock valuation).

## Notes: stock as a ledger, not a mutable counter (CLAUDE.md §21)

`current_quantity` is never the sole source of truth. Every change is recorded as an append-only movement:

```text
RECEIPT, SALE, RETURN, TRANSFER, ADJUSTMENT, DAMAGE, RESERVATION, RELEASE
```

`current_quantity` is maintained as a transactionally-consistent projection of the movement ledger, not an independently-mutated field. Concurrent stock changes (e.g. two POS terminals selling the last unit simultaneously) are handled with database-level locking/versioning so the result is never a physically-impossible negative quantity, unless negative inventory is explicitly enabled for that tenant/product (CLAUDE.md §21).

No module other than `inventory` ever writes a stock movement directly — `pos` and `purchasing` call `inventory`'s application interface (`reserveStock`, `recordReceipt`, `adjustStock`, etc.), and `inventory` is the only module that touches its own tables.
