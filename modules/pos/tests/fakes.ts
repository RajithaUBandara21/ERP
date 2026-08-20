import { randomUUID } from "node:crypto";
import type { TenantDb } from "@erp/database";
import type { DomainEvent, NewDomainEvent, OutboxRepository, PendingEvent } from "@erp/events";
import type { Cart, CartStatus } from "../src/domain/cart";
import type { CartLine } from "../src/domain/cart-line";
import type { PosTransaction } from "../src/domain/pos-transaction";
import type { Terminal } from "../src/domain/terminal";
import type { CartRepository } from "../src/application/cart-repository";
import type { CreatePosTransactionInput, PosTransactionRepository } from "../src/application/pos-transaction-repository";
import type { TerminalRepository } from "../src/application/terminal-repository";
import type { PaymentCaptureResult, PaymentCapturePort } from "../src/application/payment-capture-port";
import type { StockReservationPort } from "../src/application/stock-reservation-port";

/**
 * checkout() runs its final writes inside `db.transaction(async (tx) => ...)`
 * — the fakes don't model real transactional isolation, so `transaction`
 * just invokes the callback with `fakeDb` itself as `tx`, letting the same
 * in-memory repositories record the writes either way.
 */
export const fakeDb = {
  transaction: async <T>(callback: (tx: TenantDb) => Promise<T>): Promise<T> => callback(fakeDb),
} as unknown as TenantDb;

export class FakeOutboxRepository implements OutboxRepository {
  public events: DomainEvent[] = [];

  async insert(_db: TenantDb, event: NewDomainEvent): Promise<DomainEvent> {
    const stored: DomainEvent = { eventId: randomUUID(), createdAt: new Date(), version: event.version ?? 1, ...event };
    this.events.push(stored);
    return stored;
  }

  async findPending(): Promise<PendingEvent[]> {
    return this.events.map((event) => ({ ...event, attempts: 0 }));
  }

  async hasBeenDelivered(): Promise<boolean> {
    return false;
  }

  async markConsumerDelivered(): Promise<void> {}
  async markFullyDelivered(): Promise<void> {}

  async recordFailedAttempt(): Promise<{ attempts: number }> {
    return { attempts: 1 };
  }

  async markDeadLettered(): Promise<void> {}

  async findDeadLettered(): Promise<PendingEvent[]> {
    return [];
  }
}

export class FakeTerminalRepository implements TerminalRepository {
  private readonly byId = new Map<string, Terminal>();

  async findById(_db: TenantDb, id: string): Promise<Terminal | undefined> {
    return this.byId.get(id);
  }

  async create(_db: TenantDb, input: { name: string; deviceId: string | null }): Promise<Terminal> {
    const now = new Date();
    const terminal: Terminal = { id: randomUUID(), name: input.name, deviceId: input.deviceId, status: "active", createdAt: now, updatedAt: now };
    this.byId.set(terminal.id, terminal);
    return terminal;
  }

  seed(terminal: Omit<Terminal, "id" | "createdAt" | "updatedAt"> & Partial<Pick<Terminal, "id">>): Terminal {
    const now = new Date();
    const full: Terminal = { ...terminal, id: terminal.id ?? randomUUID(), createdAt: now, updatedAt: now };
    this.byId.set(full.id, full);
    return full;
  }
}

export class FakeCartRepository implements CartRepository {
  private readonly byId = new Map<string, Cart>();

  async findById(_db: TenantDb, id: string): Promise<Cart | undefined> {
    return this.byId.get(id);
  }

  async create(_db: TenantDb, input: { terminalId: string; customerId: string | null }): Promise<Cart> {
    const now = new Date();
    const cart: Cart = { id: randomUUID(), terminalId: input.terminalId, customerId: input.customerId, status: "open", lines: [], createdAt: now, updatedAt: now };
    this.byId.set(cart.id, cart);
    return cart;
  }

  async setLines(_db: TenantDb, id: string, lines: CartLine[]): Promise<void> {
    const cart = this.byId.get(id);
    if (cart) this.byId.set(id, { ...cart, lines, updatedAt: new Date() });
  }

  async setStatus(_db: TenantDb, id: string, status: CartStatus): Promise<void> {
    const cart = this.byId.get(id);
    if (cart) this.byId.set(id, { ...cart, status, updatedAt: new Date() });
  }

  seed(cart: Omit<Cart, "id" | "createdAt" | "updatedAt"> & Partial<Pick<Cart, "id">>): Cart {
    const now = new Date();
    const id = cart.id ?? randomUUID();
    const full: Cart = { createdAt: now, updatedAt: now, ...cart, id };
    this.byId.set(full.id, full);
    return full;
  }
}

export class FakePosTransactionRepository implements PosTransactionRepository {
  private readonly byId = new Map<string, PosTransaction>();

  async findByIdempotencyKey(_db: TenantDb, idempotencyKey: string): Promise<PosTransaction | undefined> {
    return [...this.byId.values()].find((t) => t.idempotencyKey === idempotencyKey);
  }

  async create(_db: TenantDb, input: CreatePosTransactionInput): Promise<PosTransaction> {
    const now = new Date();
    const transaction: PosTransaction = { id: randomUUID(), status: "completed", createdAt: now, updatedAt: now, ...input };
    this.byId.set(transaction.id, transaction);
    return transaction;
  }
}

export class FakeStockReservationPort implements StockReservationPort {
  public reserveCalls: { tenantId: string; reference: string; lines: CartLine[] }[] = [];
  public confirmCalls: { tenantId: string; reference: string; lines: CartLine[] }[] = [];
  public releaseCalls: { tenantId: string; reference: string; lines: CartLine[] }[] = [];

  async reserveStock(tenantId: string, reference: string, lines: CartLine[]): Promise<void> {
    this.reserveCalls.push({ tenantId, reference, lines });
  }

  async confirmReservation(tenantId: string, reference: string, lines: CartLine[]): Promise<void> {
    this.confirmCalls.push({ tenantId, reference, lines });
  }

  async releaseReservation(tenantId: string, reference: string, lines: CartLine[]): Promise<void> {
    this.releaseCalls.push({ tenantId, reference, lines });
  }
}

export class FakePaymentCapturePort implements PaymentCapturePort {
  public calls: { tenantId: string; idempotencyKey: string; amountCents: number; method: string }[] = [];
  constructor(private readonly result: PaymentCaptureResult = { success: true }) {}

  async capturePayment(tenantId: string, idempotencyKey: string, amountCents: number, method: string): Promise<PaymentCaptureResult> {
    this.calls.push({ tenantId, idempotencyKey, amountCents, method });
    return this.result;
  }
}
