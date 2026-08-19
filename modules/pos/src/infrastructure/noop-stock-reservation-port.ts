import type { StockReservationPort } from "../application/stock-reservation-port";

/** Phase 8 stand-in — see stock-reservation-port.ts's doc comment. Replaced by a real implementation in Phase 9. */
export class NoopStockReservationPort implements StockReservationPort {
  async reserveStock(): Promise<void> {
    // Intentionally does nothing — no inventory module exists yet.
  }
}
