import type { StockReservationPort } from "../application/stock-reservation-port";

/** Phase 8 stand-in — see stock-reservation-port.ts's doc comment. Still used by tests/fakes that don't care about inventory. */
export class NoopStockReservationPort implements StockReservationPort {
  async reserveStock(): Promise<void> {
    // Intentionally does nothing.
  }

  async confirmReservation(): Promise<void> {
    // Intentionally does nothing.
  }

  async releaseReservation(): Promise<void> {
    // Intentionally does nothing.
  }
}
