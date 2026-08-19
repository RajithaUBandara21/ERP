# Module: accounting

## Domain ownership

`accounting` owns the financial ledger derived from other modules' activity:

- Ledger entries
- Journals
- Invoices

## Owned entities

`LedgerEntry`, `Journal`, `Invoice`

## Dependencies

```text
accounting
 ├── core
 ├── tenant
 ├── sales
 ├── purchasing
 └── payments
```

## Depended on by

`reporting`.

## Notes

`accounting` does not rewrite or take ownership of `sales`/`purchasing`/`payments` source data — it derives ledger entries and invoices from their domain events (`OrderPaid`, `PaymentCaptured`, `PaymentRefunded`, purchasing's goods-receipt/invoice events), consuming them idempotently via the outbox ([EVENTS.md](../../EVENTS.md)). This keeps each source module the single owner of its own transactional data while still letting accounting maintain a consistent, auditable ledger. Because it consumes events from three other business modules, `accounting` is one of the later, higher-layer modules in the dependency graph (see [DOMAIN-MODEL.md](../../DOMAIN-MODEL.md) §3, topological layer 3).
