export type { Warehouse } from "./domain/warehouse";
export { WarehouseNotFoundError } from "./domain/warehouse";

export type { StockLevel } from "./domain/stock-level";
export { toStockLevel } from "./domain/stock-level";

export type { StockMovement, StockMovementType } from "./domain/stock-movement";

export { InsufficientStockError } from "./domain/errors";

export { INVENTORY_PERMISSIONS } from "./domain/permissions";
export type { InventoryPermission } from "./domain/permissions";

export type { WarehouseRepository } from "./application/warehouse-repository";
export { DrizzleWarehouseRepository } from "./infrastructure/drizzle-warehouse-repository";

export type { ApplyMovementInput, StockRepository } from "./application/stock-repository";
export { DrizzleStockRepository } from "./infrastructure/drizzle-stock-repository";

export { createWarehouse } from "./application/create-warehouse";
export type { CreateWarehouseInput } from "./application/create-warehouse";

export { getOrCreateDefaultWarehouse } from "./application/get-or-create-default-warehouse";

export { getStockLevel } from "./application/get-stock-level";

export { receiveStock } from "./application/receive-stock";
export type { ReceiveStockInput } from "./application/receive-stock";

export { adjustStock } from "./application/adjust-stock";
export type { AdjustStockInput } from "./application/adjust-stock";

export { reserveStock } from "./application/reserve-stock";
export type { ReserveStockInput, StockLine } from "./application/reserve-stock";

export { releaseReservation } from "./application/release-reservation";
export type { ReleaseReservationInput } from "./application/release-reservation";

export { confirmSale } from "./application/confirm-sale";
export type { ConfirmSaleInput } from "./application/confirm-sale";

export { applyInventoryMigrations } from "./apply-migrations";
export { inventoryManifest } from "./module.manifest";
