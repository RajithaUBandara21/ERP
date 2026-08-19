# Domain Model

Status: `tenant`'s lifecycle use cases (create/provision/resolve) are implemented as of Phase 3 — see the ownership refinement in §3 below. Other modules remain architecture-only. See [ARCHITECTURE.md](./ARCHITECTURE.md) for how modules are layered and bounded.

## 1. Domain ownership principle

> A module owns its business data and business rules. (CLAUDE.md §10)

No module ever reads or writes another module's tables. All cross-module access goes through the owning module's application-layer interface, or through domain events.

## 2. Module list and owned aggregates

| Module | Owns | Does NOT own |
|---|---|---|
| **core** | module registry entries, feature flags, configuration definitions, audit log entries | any tenant business data |
| **identity** | users, credentials, permission catalog, role definitions | tenant/branch/warehouse structure (owned by `tenant`); sessions (owned by `packages/auth` — see [docs/modules/identity.md](./docs/modules/identity.md), refined during Phase 4) |
| **tenant** | tenant lifecycle (control-plane `tenants` record — see §3), and eventually branches/warehouses/tenant-scoped settings on the tenant-DB side | subscriptions/billing (control plane, owned by the platform itself, not this module) |
| **sales** | customers, quotations, sales orders, order lines, sales pricing | inventory stock levels, payment capture |
| **purchasing** | suppliers, purchase orders, purchase order lines, goods-receipt records | inventory stock ledger (purchasing triggers a `RECEIPT` movement via Inventory's interface, does not write it directly) |
| **inventory** | stock levels, warehouses' stock, stock movement ledger, reservations | product catalog ownership decisions belonging to Sales/Purchasing pricing |
| **payments** | payment attempts, payment methods, refunds, provider transaction records | order/cart state (owned by POS/Sales) |
| **pos** | POS transactions, carts, receipts, terminals, terminal sessions | stock truth (delegates to Inventory), payment capture (delegates to Payments) |
| **delivery** | deliveries, drivers, assignments, delivery status | order truth (references Sales order by ID only) |
| **accounting** | ledger entries, journals, invoices | source transactions in Sales/Purchasing/Payments (accounting derives entries from their events, does not rewrite their data) |
| **reporting** | read-optimized aggregates/materialized views built from other modules' published events | any operational/write-path data |

## 3. Module dependency graph

Declared dependencies (validated acyclic — CLAUDE.md §9):

```text
core
 └── (no dependencies — foundational)

identity
 └── core

tenant
 └── core

sales
 ├── core
 ├── tenant
 └── identity

purchasing
 ├── core
 ├── tenant
 └── identity

inventory
 ├── core
 └── tenant

payments
 ├── core
 ├── tenant
 └── identity

pos
 ├── core
 ├── tenant
 ├── identity
 ├── sales        (customer lookup, order creation)
 ├── inventory     (stock check/deduction)
 └── payments      (checkout/capture)

delivery
 ├── core
 ├── tenant
 └── sales         (order reference, customer/address)

accounting
 ├── core
 ├── tenant
 ├── sales
 ├── purchasing
 └── payments

reporting
 ├── core
 └── tenant
 (soft/event-based subscription to any other installed module — see below)
```

Topological layers (each layer may only depend on modules in a strictly earlier layer — this is what makes the graph acyclic by construction):

```text
Layer 0: core
Layer 1: identity, tenant
Layer 2: sales, purchasing, inventory, payments
Layer 3: pos, delivery, accounting
Layer 4: reporting (event-driven, not a hard runtime dependency)
```

`reporting` is intentionally weakly coupled: rather than declaring a hard dependency on every module it reports on, it subscribes to whichever modules are installed for a given tenant via their published domain events (§[EVENTS.md](./EVENTS.md)). This keeps `reporting` from becoming a dependency bottleneck as new modules are added, while still respecting "no direct database access" — reporting builds its own read models from events, it never queries another module's tables.

## 4. Resolved ambiguity: "Customer"

CLAUDE.md §9 shows `Delivery` and `POS` depending on a "Customer" module that is absent from the §5 module list. Resolved as: **Customer is owned by `sales`.** A customer is the party that places sales orders; POS transactions and deliveries both reference a customer by ID through Sales' application interface. If a future requirement needs a standalone CRM module (mentioned only in the product-vision example, not the module list), it would be introduced as a new module depending on `sales` for the customer identity, not the reverse.

## 5. Representative entities per module (illustrative, not exhaustive — full detail belongs in each module's own domain documentation once implemented)

- **core**: `ModuleRegistryEntry`, `FeatureFlag`, `AuditLogEntry`, `ConfigurationDefinition`
- **identity**: `User`, `Credential`, `Session`, `Role`, `Permission`
- **tenant**: `Tenant` (control-plane lifecycle record — see §6), `Branch`, `Warehouse`, `TenantModuleActivation` (tenant-DB side, not yet implemented)
- **sales**: `Customer`, `Quotation`, `SalesOrder`, `SalesOrderLine`
- **purchasing**: `Supplier`, `PurchaseOrder`, `PurchaseOrderLine`, `GoodsReceipt`
- **inventory**: `StockItem`, `Warehouse` (stock view), `StockMovement`, `StockReservation`
- **payments**: `PaymentAttempt`, `PaymentMethod`, `Refund`, `ProviderTransaction`
- **pos**: `PosTransaction`, `Cart`, `Receipt`, `Terminal`, `TerminalSession`
- **delivery**: `Delivery`, `Driver`, `DeliveryAssignment`
- **accounting**: `LedgerEntry`, `Journal`, `Invoice`
- **reporting**: module-specific read models / materialized views, no owned transactional aggregates

## 6. Control plane vs tenant plane

Most domain entities above live in **tenant databases**. Platform-level state (subscriptions, billing, module registry, feature flags, domains, platform operators) lives in the **control plane** database and is owned by the platform itself, not any business module. See [DATABASE.md](./DATABASE.md) §2 for the control-plane schema.

**Refinement made during Phase 3 implementation:** `tenant`'s lifecycle (create/provision/resolve a tenant) is the one exception to "modules own tenant-DB tables" — a tenant's *existence* is inherently a control-plane fact (it's what has to be resolved *before* any tenant database connection can even be opened), so the `tenant` module's `create`/`get-by-slug`/`resolve-context` use cases operate on the control-plane `tenants` table (via `@erp/database`), not a tenant-DB table. This does not violate module ownership — the control-plane `tenants` table is still only ever written to through `modules/tenant`'s repository, never directly by another module or by `packages/database` callers other than the CLI/ops path. What genuinely lives inside each tenant's own database under `tenant`'s ownership — branches, warehouses, tenant-scoped settings — is introduced once the module registry (Phase 6) can install per-tenant schemas; until then those remain architecture-only. See [docs/modules/tenant.md](./docs/modules/tenant.md) and [ADR-0002](./docs/adr/0002-database-per-tenant.md).
