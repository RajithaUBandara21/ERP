import { randomUUID } from "node:crypto";
import type { TenantDb } from "@erp/database";
import { InsufficientStockError } from "../src/domain/errors";
import type { StockLevel } from "../src/domain/stock-level";
import { toStockLevel } from "../src/domain/stock-level";
import type { Warehouse } from "../src/domain/warehouse";
import type { ApplyMovementInput, StockRepository } from "../src/application/stock-repository";
import type { WarehouseRepository } from "../src/application/warehouse-repository";

export const fakeDb = {} as TenantDb;

export class FakeWarehouseRepository implements WarehouseRepository {
  private readonly byId = new Map<string, Warehouse>();

  async create(_db: TenantDb, input: { name: string; isDefault: boolean }): Promise<Warehouse> {
    const now = new Date();
    const warehouse: Warehouse = { id: randomUUID(), name: input.name, isDefault: input.isDefault, createdAt: now, updatedAt: now };
    this.byId.set(warehouse.id, warehouse);
    return warehouse;
  }

  async findById(_db: TenantDb, id: string): Promise<Warehouse | undefined> {
    return this.byId.get(id);
  }

  async findDefault(_db: TenantDb): Promise<Warehouse | undefined> {
    return [...this.byId.values()].find((w) => w.isDefault);
  }

  async createDefaultIfMissing(db: TenantDb): Promise<Warehouse> {
    const existing = await this.findDefault(db);
    if (existing) return existing;
    return this.create(db, { name: "Main Warehouse", isDefault: true });
  }

  async list(_db: TenantDb): Promise<Warehouse[]> {
    return [...this.byId.values()];
  }
}

/** In-memory equivalent of DrizzleStockRepository's invariants (no negative onHand/reserved, reserved <= onHand). */
export class FakeStockRepository implements StockRepository {
  private readonly byKey = new Map<string, { onHand: number; reserved: number }>();
  public movements: ApplyMovementInput[] = [];

  private key(warehouseId: string, sku: string): string {
    return `${warehouseId}:${sku}`;
  }

  async getLevel(_db: TenantDb, warehouseId: string, sku: string): Promise<StockLevel | undefined> {
    const row = this.byKey.get(this.key(warehouseId, sku));
    return row ? toStockLevel({ warehouseId, sku, ...row }) : undefined;
  }

  async applyMovement(_db: TenantDb, input: ApplyMovementInput): Promise<StockLevel> {
    const key = this.key(input.warehouseId, input.sku);
    const current = this.byKey.get(key) ?? { onHand: 0, reserved: 0 };
    const nextOnHand = current.onHand + input.onHandDelta;
    const nextReserved = current.reserved + input.reservedDelta;

    if (nextOnHand < 0 || nextReserved < 0 || nextReserved > nextOnHand) {
      const requested = input.reservedDelta !== 0 ? input.reservedDelta : -input.onHandDelta;
      throw new InsufficientStockError(input.sku, input.warehouseId, requested, current.onHand - current.reserved);
    }

    this.byKey.set(key, { onHand: nextOnHand, reserved: nextReserved });
    this.movements.push(input);
    return toStockLevel({ warehouseId: input.warehouseId, sku: input.sku, onHand: nextOnHand, reserved: nextReserved });
  }
}
