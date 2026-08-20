import { describe, expect, it } from "vitest";
import { adjustStock } from "../src/application/adjust-stock";
import { receiveStock } from "../src/application/receive-stock";
import { getStockLevel } from "../src/application/get-stock-level";
import { FakeStockRepository, FakeWarehouseRepository, fakeDb } from "./fakes";

describe("receiveStock", () => {
  it("increases onHand and leaves reserved untouched", async () => {
    const stockRepository = new FakeStockRepository();
    const warehouseRepository = new FakeWarehouseRepository();
    const deps = { stockRepository, warehouseRepository };

    const level = await receiveStock(deps, fakeDb, { sku: "SKU-1", quantity: 10 });

    expect(level.onHand).toBe(10);
    expect(level.reserved).toBe(0);
    expect(level.available).toBe(10);
  });

  it("rejects a non-positive quantity", async () => {
    const deps = { stockRepository: new FakeStockRepository(), warehouseRepository: new FakeWarehouseRepository() };
    await expect(receiveStock(deps, fakeDb, { sku: "SKU-1", quantity: 0 })).rejects.toThrow(RangeError);
  });

  it("auto-creates a default warehouse on first use", async () => {
    const warehouseRepository = new FakeWarehouseRepository();
    const deps = { stockRepository: new FakeStockRepository(), warehouseRepository };

    await receiveStock(deps, fakeDb, { sku: "SKU-1", quantity: 5 });

    const warehouses = await warehouseRepository.list(fakeDb);
    expect(warehouses).toHaveLength(1);
    expect(warehouses[0]?.isDefault).toBe(true);
  });
});

describe("adjustStock", () => {
  it("applies a positive correction", async () => {
    const deps = { stockRepository: new FakeStockRepository(), warehouseRepository: new FakeWarehouseRepository() };
    await receiveStock(deps, fakeDb, { sku: "SKU-1", quantity: 5 });

    const level = await adjustStock(deps, fakeDb, { sku: "SKU-1", delta: 3 });
    expect(level.onHand).toBe(8);
  });

  it("applies a negative correction without going below zero", async () => {
    const deps = { stockRepository: new FakeStockRepository(), warehouseRepository: new FakeWarehouseRepository() };
    await receiveStock(deps, fakeDb, { sku: "SKU-1", quantity: 5 });

    const level = await adjustStock(deps, fakeDb, { sku: "SKU-1", delta: -2 });
    expect(level.onHand).toBe(3);
  });

  it("rejects a correction that would drive onHand negative", async () => {
    const deps = { stockRepository: new FakeStockRepository(), warehouseRepository: new FakeWarehouseRepository() };
    await receiveStock(deps, fakeDb, { sku: "SKU-1", quantity: 5 });

    await expect(adjustStock(deps, fakeDb, { sku: "SKU-1", delta: -10 })).rejects.toThrow("Insufficient stock");
  });

  it("rejects a zero delta", async () => {
    const deps = { stockRepository: new FakeStockRepository(), warehouseRepository: new FakeWarehouseRepository() };
    await expect(adjustStock(deps, fakeDb, { sku: "SKU-1", delta: 0 })).rejects.toThrow(RangeError);
  });
});

describe("getStockLevel", () => {
  it("returns a zeroed level for a sku with no movements yet", async () => {
    const deps = { stockRepository: new FakeStockRepository(), warehouseRepository: new FakeWarehouseRepository() };
    const level = await getStockLevel(deps, fakeDb, { sku: "SKU-NEVER-SEEN" });
    expect(level).toMatchObject({ onHand: 0, reserved: 0, available: 0 });
  });
});
