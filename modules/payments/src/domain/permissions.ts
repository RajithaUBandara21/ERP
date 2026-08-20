/** This module's permission catalog — see modules/identity/src/domain/permissions.ts for the same pattern. */
export const PAYMENTS_PERMISSIONS = {
  PAYMENT_CAPTURE: "PAYMENTS.PAYMENT.CAPTURE",
  PAYMENT_REFUND: "PAYMENTS.PAYMENT.REFUND",
  PAYMENT_READ: "PAYMENTS.PAYMENT.READ",
} as const;

export type PaymentsPermission = (typeof PAYMENTS_PERMISSIONS)[keyof typeof PAYMENTS_PERMISSIONS];
