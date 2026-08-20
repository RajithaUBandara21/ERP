import type { EntitlementChecker } from "../application/entitlement-checker";

/** Default for installModule's entitlementChecker param — see entitlement-checker.ts's doc comment. Used whenever no billing model applies (most existing tests/scripts). */
export class AllowAllEntitlementChecker implements EntitlementChecker {
  async isModuleIncluded(): Promise<boolean> {
    return true;
  }
}
