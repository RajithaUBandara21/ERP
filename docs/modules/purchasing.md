# Module: purchasing

## Domain ownership

`purchasing` owns the procurement lifecycle:

- Suppliers
- Purchase orders and purchase order lines
- Goods-receipt records (the purchasing-side record that a shipment arrived)

## Owned entities

`Supplier`, `PurchaseOrder`, `PurchaseOrderLine`, `GoodsReceipt`

## Dependencies

```text
purchasing
 ├── core
 ├── tenant
 └── identity
```

## Depended on by

`accounting` (ledger entries derived from purchasing events).

## Notes

Receiving goods against a purchase order does not let `purchasing` write directly to `inventory`'s stock ledger — it calls `inventory`'s application interface to record a `RECEIPT` stock movement, keeping `inventory` the sole owner of stock truth (CLAUDE.md §10, §21). `purchasing`'s own `GoodsReceipt` record is the procurement-side fact ("this PO was received"); `inventory`'s `StockMovement` is the stock-side fact ("this quantity was added at this warehouse") — two related but separately-owned records, linked by ID, not a shared table.
