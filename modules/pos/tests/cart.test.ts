import { describe, expect, it } from "vitest";
import { addCartLine } from "../src/application/add-cart-line";
import { createCart } from "../src/application/create-cart";
import { removeCartLine } from "../src/application/remove-cart-line";
import { TerminalNotActiveError, TerminalNotFoundError } from "../src/domain/terminal";
import { CartNotOpenError } from "../src/domain/cart";
import { fakeDb, FakeCartRepository, FakeTerminalRepository } from "./fakes";

describe("createCart", () => {
  it("creates an open cart for an active terminal", async () => {
    const terminalRepo = new FakeTerminalRepository();
    const cartRepo = new FakeCartRepository();
    const terminal = terminalRepo.seed({ name: "Front", deviceId: null, status: "active" });

    const cart = await createCart(cartRepo, terminalRepo, fakeDb, { terminalId: terminal.id });
    expect(cart.status).toBe("open");
    expect(cart.lines).toEqual([]);
  });

  it("rejects an unknown terminal", async () => {
    const terminalRepo = new FakeTerminalRepository();
    const cartRepo = new FakeCartRepository();
    await expect(createCart(cartRepo, terminalRepo, fakeDb, { terminalId: "missing" })).rejects.toThrow(
      TerminalNotFoundError,
    );
  });

  it("rejects an inactive terminal", async () => {
    const terminalRepo = new FakeTerminalRepository();
    const cartRepo = new FakeCartRepository();
    const terminal = terminalRepo.seed({ name: "Retired", deviceId: null, status: "inactive" });

    await expect(createCart(cartRepo, terminalRepo, fakeDb, { terminalId: terminal.id })).rejects.toThrow(
      TerminalNotActiveError,
    );
  });
});

describe("addCartLine / removeCartLine", () => {
  it("adds a new line", async () => {
    const cartRepo = new FakeCartRepository();
    const cart = cartRepo.seed({ terminalId: "t1", customerId: null, status: "open", lines: [] });

    const updated = await addCartLine(cartRepo, fakeDb, cart.id, { sku: "SKU-1", name: "Widget", quantity: 2, unitPriceCents: 500 });
    expect(updated.lines).toHaveLength(1);
    expect(updated.lines[0]).toMatchObject({ sku: "SKU-1", quantity: 2, unitPriceCents: 500 });
  });

  it("merges quantity when the same SKU is added again", async () => {
    const cartRepo = new FakeCartRepository();
    const cart = cartRepo.seed({ terminalId: "t1", customerId: null, status: "open", lines: [] });

    await addCartLine(cartRepo, fakeDb, cart.id, { sku: "SKU-1", name: "Widget", quantity: 2, unitPriceCents: 500 });
    const updated = await addCartLine(cartRepo, fakeDb, cart.id, { sku: "SKU-1", name: "Widget", quantity: 3, unitPriceCents: 500 });

    expect(updated.lines).toHaveLength(1);
    expect(updated.lines[0]!.quantity).toBe(5);
  });

  it("rejects adding to a non-open cart", async () => {
    const cartRepo = new FakeCartRepository();
    const cart = cartRepo.seed({ terminalId: "t1", customerId: null, status: "completed", lines: [] });

    await expect(
      addCartLine(cartRepo, fakeDb, cart.id, { sku: "SKU-1", name: "Widget", quantity: 1, unitPriceCents: 100 }),
    ).rejects.toThrow(CartNotOpenError);
  });

  it("rejects a non-positive quantity", async () => {
    const cartRepo = new FakeCartRepository();
    const cart = cartRepo.seed({ terminalId: "t1", customerId: null, status: "open", lines: [] });

    await expect(
      addCartLine(cartRepo, fakeDb, cart.id, { sku: "SKU-1", name: "Widget", quantity: 0, unitPriceCents: 100 }),
    ).rejects.toThrow(/positive/i);
  });

  it("removes a line by id", async () => {
    const cartRepo = new FakeCartRepository();
    const cart = cartRepo.seed({ terminalId: "t1", customerId: null, status: "open", lines: [] });
    const withLine = await addCartLine(cartRepo, fakeDb, cart.id, { sku: "SKU-1", name: "Widget", quantity: 1, unitPriceCents: 100 });

    const updated = await removeCartLine(cartRepo, fakeDb, cart.id, withLine.lines[0]!.id);
    expect(updated.lines).toHaveLength(0);
  });
});
