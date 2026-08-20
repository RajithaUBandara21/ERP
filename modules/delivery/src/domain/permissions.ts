/** This module's permission catalog — see modules/identity/src/domain/permissions.ts for the same pattern. */
export const DELIVERY_PERMISSIONS = {
  DRIVER_MANAGE: "DELIVERY.DRIVER.MANAGE",
  DELIVERY_CREATE: "DELIVERY.CREATE",
  // CLAUDE.md §14's exact example permissions:
  DELIVERY_ASSIGN: "DELIVERY.ASSIGN",
  DELIVERY_COMPLETE: "DELIVERY.COMPLETE",
} as const;

export type DeliveryPermission = (typeof DELIVERY_PERMISSIONS)[keyof typeof DELIVERY_PERMISSIONS];
