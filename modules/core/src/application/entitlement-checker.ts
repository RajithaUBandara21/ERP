/**
 * Seam for the real billing integration — same reasoning as modules/pos's
 * StockReservationPort (ARCHITECTURE.md §4): core must never depend on
 * billing (core is foundational, layer 0 — see module.manifest.ts's doc
 * comment), so it only knows about this interface. modules/billing's
 * SubscriptionEntitlementChecker (Phase 15) supplies the real
 * implementation, wired in by the composition root (apps/web); the
 * AllowAllEntitlementChecker below is installModule's default so every
 * existing caller that doesn't care about billing keeps working unchanged.
 */
export interface EntitlementChecker {
  isModuleIncluded(tenantId: string, moduleId: string): Promise<boolean>;
}
