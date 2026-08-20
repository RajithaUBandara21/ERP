/** This module's permission catalog — see modules/identity/src/domain/permissions.ts for the same pattern. */
export const REPORTING_PERMISSIONS = {
  SALES_READ: "REPORTING.SALES.READ",
} as const;

export type ReportingPermission = (typeof REPORTING_PERMISSIONS)[keyof typeof REPORTING_PERMISSIONS];
