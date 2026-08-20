import { getTenantDb } from "@erp/database";
import {
  confirmSale,
  DrizzleStockRepository,
  DrizzleWarehouseRepository,
  releaseReservation,
  reserveStock,
  type StockLine,
} from "@erp/inventory";
import type { CartLine } from "../domain/cart-line";
import type { StockReservationPort } from "../application/stock-reservation-port";

function toStockLines(lines: CartLine[]): StockLine[] {
  return lines.map((line) => ({ sku: line.sku, quantity: line.quantity }));
}

/**
 * Real implementation, Phase 9 — see stock-reservation-port.ts's doc
 * comment. Resolves the tenant's own database (same tenant DB pos's
 * tables live in, per ARCHITECTURE.md's database-per-tenant model, just a
 * different module's tables within it) and always reserves against the
 * tenant's default warehouse — POS terminals don't carry a warehouseId yet
 * (branch/warehouse scoping deferred, see ADR-0007's Update).
 */
export class InventoryStockReservationPort implements StockReservationPort {
  private readonly stockRepository = new DrizzleStockRepository();
  private readonly warehouseRepository = new DrizzleWarehouseRepository();

  async reserveStock(tenantId: string, reference: string, lines: CartLine[]): Promise<void> {
    const db = await getTenantDb(tenantId);
    await reserveStock(
      { stockRepository: this.stockRepository, warehouseRepository: this.warehouseRepository },
      db,
      { lines: toStockLines(lines), reference },
    );
  }

  async confirmReservation(tenantId: string, reference: string, lines: CartLine[]): Promise<void> {
    const db = await getTenantDb(tenantId);
    await confirmSale(
      { stockRepository: this.stockRepository, warehouseRepository: this.warehouseRepository },
      db,
      { lines: toStockLines(lines), reference },
    );
  }

  async releaseReservation(tenantId: string, reference: string, lines: CartLine[]): Promise<void> {
    const db = await getTenantDb(tenantId);
    await releaseReservation(
      { stockRepository: this.stockRepository, warehouseRepository: this.warehouseRepository },
      db,
      { lines: toStockLines(lines), reference },
    );
  }
}
