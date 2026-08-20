/** This module's permission catalog — see modules/identity/src/domain/permissions.ts for the same pattern. */
export const INVENTORY_PERMISSIONS = {
  WAREHOUSE_MANAGE: "INVENTORY.WAREHOUSE.MANAGE",
  STOCK_READ: "INVENTORY.STOCK.READ",
  STOCK_RECEIVE: "INVENTORY.STOCK.RECEIVE",
  STOCK_ADJUST: "INVENTORY.STOCK.ADJUST",
  // Declared per CLAUDE.md §14's example list; no transfer use case or route implemented yet.
  STOCK_TRANSFER: "INVENTORY.TRANSFER",
} as const;

export type InventoryPermission = (typeof INVENTORY_PERMISSIONS)[keyof typeof INVENTORY_PERMISSIONS];
