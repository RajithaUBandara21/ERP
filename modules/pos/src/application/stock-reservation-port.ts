import type { CartLine } from "../domain/cart-line";

/**
 * Seam for the real inventory integration — see ARCHITECTURE.md §4: POS
 * must never touch inventory's tables directly, only its application
 * interface. Phase 9 adds the real implementation
 * (infrastructure/inventory-stock-reservation-port.ts, calling into
 * @erp/inventory's reserveStock/confirmSale/releaseReservation); the Phase
 * 8 no-op (infrastructure/noop-stock-reservation-port.ts) is still used by
 * fakes/tests that don't care about inventory.
 *
 * Three methods, not one, because a real inventory backend needs the full
 * reserve → confirm-or-release lifecycle (CLAUDE.md §21's RESERVATION/
 * SALE/RELEASE movement types) — checkout() reserves before capturing
 * payment, then confirms on success or releases on failure. `reference` is
 * the cart id, threaded through so the stock ledger stays traceable back
 * to the transaction that caused it (CLAUDE.md §37, auditability).
 */
export interface StockReservationPort {
  reserveStock(tenantId: string, reference: string, lines: CartLine[]): Promise<void>;
  confirmReservation(tenantId: string, reference: string, lines: CartLine[]): Promise<void>;
  releaseReservation(tenantId: string, reference: string, lines: CartLine[]): Promise<void>;
}
