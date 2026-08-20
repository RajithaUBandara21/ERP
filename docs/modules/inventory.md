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
 ├── tenant       (warehouse organizational structure, owned by tenant, referenced by ID)
 └── identity     (retrofit-pattern baseline — see modules/pos/src/module.manifest.ts's
                   comment: every business module depends on identity too, since its
                   permission-gated routes need identity's role/permission system
                   regardless of whether the module's own tables reference it)
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

## Implementation status (Phase 9)

- **Built**: `Warehouse`, `StockLevel` (projection), `StockMovement` (ledger) as owned entities; `createWarehouse`/`getOrCreateDefaultWarehouse`/`getStockLevel`/`receiveStock`/`adjustStock`/`reserveStock`/`releaseReservation`/`confirmSale` use cases; concurrency-safe `DrizzleStockRepository.applyMovement` (row-locks the `stock_levels` row inside a transaction via `SELECT ... FOR UPDATE`, proven under genuine concurrent connections in `tests/inventory-lifecycle.integration.test.ts`); HTTP routes under `apps/web/src/app/api/inventory/*`.
- **Not yet built**: `TRANSFER` movement (permission declared, no use case or route — same "declared, not wired" precedent as `pos`'s `ORDER_REFUND`); negative-inventory opt-in (would need the feature-flag system, Phase 47).
- **POS integration**: `modules/pos`'s `StockReservationPort` now has a real `InventoryStockReservationPort` implementation (reserve → confirm-on-success / release-on-failure), closing the compensating-action gap Phase 8 had flagged. `pos`'s manifest now declares a hard dependency on `inventory`.
- **No per-terminal warehouse yet**: POS always reserves against the tenant's auto-created "Main Warehouse" default (`getOrCreateDefaultWarehouse`) — branch/warehouse scoping is still deferred (ADR-0007's Update).
- **A real bug found and fixed during this phase**: drizzle-orm's default migrator tracks "already applied" migrations via a single watermark timestamp shared across *every* module using the database's default `__drizzle_migrations` table — not per-folder. Since `inventory`'s migration was generated (Phase 9) *after* `pos`'s (Phase 8), installing `inventory` before `pos` for a tenant caused `pos`'s migration to be silently skipped as "already applied," even though it had never run for that tenant — `pos`'s tables didn't exist, and `installModule` still reported success. Fixed by giving every module its own migrations tracking table (`__drizzle_migrations_<module>`) — see `packages/database/src/tenant/migrate.ts`'s doc comment for the full account.
