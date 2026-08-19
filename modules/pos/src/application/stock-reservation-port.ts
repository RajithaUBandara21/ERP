import type { CartLine } from "../domain/cart-line";

/**
 * Seam for the real inventory integration — see ARCHITECTURE.md §4: POS
 * must never touch inventory's tables directly, only its application
 * interface. That interface doesn't exist yet (Phase 9), so checkout()
 * depends on this port instead of a concrete implementation. Phase 9 adds a
 * real Drizzle-backed implementation calling into @erp/inventory (or
 * whatever it's named); until then, infrastructure/noop-stock-reservation.ts
 * is wired in, and every call site is where the real integration attaches.
 */
export interface StockReservationPort {
  reserveStock(tenantId: string, lines: CartLine[]): Promise<void>;
}
