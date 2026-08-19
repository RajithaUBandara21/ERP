/** This module's permission catalog — see modules/identity/src/domain/permissions.ts for the same pattern. */
export const POS_PERMISSIONS = {
  TERMINAL_MANAGE: "POS.TERMINAL.MANAGE",
  ORDER_CREATE: "POS.ORDER.CREATE",
  ORDER_REFUND: "POS.ORDER.REFUND",
} as const;

export type PosPermission = (typeof POS_PERMISSIONS)[keyof typeof POS_PERMISSIONS];
