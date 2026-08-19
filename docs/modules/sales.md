# Module: sales

## Domain ownership

`sales` owns customers and the sales order lifecycle:

- Customers
- Quotations
- Sales orders and order lines
- Sales pricing

## Owned entities

`Customer`, `Quotation`, `SalesOrder`, `SalesOrderLine`

## Dependencies

```text
sales
 ├── core
 ├── tenant
 └── identity
```

## Depended on by

`pos` (customer lookup, order creation), `delivery` (order/customer reference), `accounting` (ledger entries derived from sales events).

## Notes: resolving the "Customer" ambiguity

CLAUDE.md §9 shows `Delivery` and `POS` depending on a "Customer" module that does not appear in the platform's module list (§5). This is resolved by making **`sales` the owner of `Customer`** — a customer is fundamentally the party that places sales orders, so customer ownership belongs with the order-taking module rather than a standalone module absent from the spec's own module list. `pos` and `delivery` obtain customer data exclusively through `sales`' application interface; they never read/write the `Customer` table directly (CLAUDE.md §10). See [DOMAIN-MODEL.md](../../DOMAIN-MODEL.md) §4 for the full rationale.

If a dedicated CRM module is introduced in the future (mentioned only in CLAUDE.md's product-vision example, not its module list), it would depend on `sales` for customer identity rather than the reverse, to avoid re-litigating this ownership decision.
