import { describe, expect, it } from "vitest";
import { InsufficientStockError } from "../src/domain/errors";
import { confirmSale } from "../src/application/confirm-sale";
import { receiveStock } from "../src/application/receive-stock";
import { releaseReservation } from "../src/application/release-reservation";
import { reserveStock } from "../src/application/reserve-stock";
import { FakeStockRepository, FakeWarehouseRepository, fakeDb } from "./fakes";

function deps() {
  return { stockRepository: new FakeStockRepository(), warehouseRepository: new FakeWarehouseRepository() };
}

describe("reserveStock", () => {
  it("increments reserved without touching onHand", async () => {
    const d = deps();
    await receiveStock(d, fakeDb, { sku: "SKU-1", quantity: 10 });

    await reserveStock(d, fakeDb, { lines: [{ sku: "SKU-1", quantity: 4 }] });

    const level = await d.stockRepository.getLevel(fakeDb, (await d.warehouseRepository.findDefault(fakeDb))!.id, "SKU-1");
    expect(level).toMatchObject({ onHand: 10, reserved: 4, available: 6 });
  });

  it("rejects reserving more than available (CLAUDE.md §21: never oversell)", async () => {
    const d = deps();
    await receiveStock(d, fakeDb, { sku: "SKU-1", quantity: 1 });

    // Simulates two terminals racing for the last unit — the second call must lose.
    await reserveStock(d, fakeDb, { lines: [{ sku: "SKU-1", quantity: 1 }] });
    await expect(reserveStock(d, fakeDb, { lines: [{ sku: "SKU-1", quantity: 1 }] })).rejects.toThrow(InsufficientStockError);
  });

  it("compensates already-reserved lines when a later line in the same call fails", async () => {
    const d = deps();
    await receiveStock(d, fakeDb, { sku: "SKU-1", quantity: 10 });
    await receiveStock(d, fakeDb, { sku: "SKU-2", quantity: 1 });

    await expect(
      reserveStock(d, fakeDb, {
        lines: [
          { sku: "SKU-1", quantity: 5 }, // succeeds
          { sku: "SKU-2", quantity: 5 }, // fails — only 1 available
        ],
      }),
    ).rejects.toThrow(InsufficientStockError);

    const warehouse = await d.warehouseRepository.findDefault(fakeDb);
    const sku1Level = await d.stockRepository.getLevel(fakeDb, warehouse!.id, "SKU-1");
    // SKU-1's reservation must have been released (compensated), not left dangling.
    expect(sku1Level).toMatchObject({ onHand: 10, reserved: 0, available: 10 });
  });
});

describe("releaseReservation", () => {
  it("decrements reserved, restoring availability", async () => {
    const d = deps();
    await receiveStock(d, fakeDb, { sku: "SKU-1", quantity: 10 });
    await reserveStock(d, fakeDb, { lines: [{ sku: "SKU-1", quantity: 4 }] });

    await releaseReservation(d, fakeDb, { lines: [{ sku: "SKU-1", quantity: 4 }] });

    const warehouse = await d.warehouseRepository.findDefault(fakeDb);
    const level = await d.stockRepository.getLevel(fakeDb, warehouse!.id, "SKU-1");
    expect(level).toMatchObject({ onHand: 10, reserved: 0, available: 10 });
  });
});

describe("confirmSale", () => {
  it("finalizes a reservation into a real deduction of both onHand and reserved", async () => {
    const d = deps();
    await receiveStock(d, fakeDb, { sku: "SKU-1", quantity: 10 });
    await reserveStock(d, fakeDb, { lines: [{ sku: "SKU-1", quantity: 4 }] });

    await confirmSale(d, fakeDb, { lines: [{ sku: "SKU-1", quantity: 4 }] });

    const warehouse = await d.warehouseRepository.findDefault(fakeDb);
    const level = await d.stockRepository.getLevel(fakeDb, warehouse!.id, "SKU-1");
    expect(level).toMatchObject({ onHand: 6, reserved: 0, available: 6 });
  });
});
