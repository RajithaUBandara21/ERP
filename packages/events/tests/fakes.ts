import { randomUUID } from "node:crypto";
import type { TenantDb } from "@erp/database";
import type { DomainEvent, NewDomainEvent } from "../src/domain/domain-event";
import type { OutboxRepository, PendingEvent } from "../src/application/outbox-repository";

export const fakeDb = {} as TenantDb;

interface StoredEvent extends PendingEvent {
  deliveredAt?: Date;
  deadLetteredAt?: Date;
  lastError?: string;
}

export class FakeOutboxRepository implements OutboxRepository {
  private readonly byId = new Map<string, StoredEvent>();
  private readonly delivered = new Set<string>(); // `${eventId}:${consumerId}`

  async insert(_db: TenantDb, event: NewDomainEvent): Promise<DomainEvent> {
    const stored: StoredEvent = { eventId: randomUUID(), createdAt: new Date(), version: event.version ?? 1, attempts: 0, ...event };
    this.byId.set(stored.eventId, stored);
    return stored;
  }

  async findPending(_db: TenantDb, limit: number): Promise<PendingEvent[]> {
    return [...this.byId.values()]
      .filter((event) => !event.deliveredAt && !event.deadLetteredAt)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit);
  }

  async hasBeenDelivered(_db: TenantDb, eventId: string, consumerId: string): Promise<boolean> {
    return this.delivered.has(`${eventId}:${consumerId}`);
  }

  async markConsumerDelivered(_db: TenantDb, eventId: string, consumerId: string): Promise<void> {
    this.delivered.add(`${eventId}:${consumerId}`);
  }

  async markFullyDelivered(_db: TenantDb, eventId: string): Promise<void> {
    const event = this.byId.get(eventId);
    if (event) event.deliveredAt = new Date();
  }

  async recordFailedAttempt(_db: TenantDb, eventId: string, error: string): Promise<{ attempts: number }> {
    const event = this.byId.get(eventId);
    if (!event) throw new Error(`Outbox event not found: ${eventId}`);
    event.attempts += 1;
    event.lastError = error;
    return { attempts: event.attempts };
  }

  async markDeadLettered(_db: TenantDb, eventId: string, error: string): Promise<void> {
    const event = this.byId.get(eventId);
    if (event) {
      event.deadLetteredAt = new Date();
      event.lastError = error;
    }
  }

  async findDeadLettered(_db: TenantDb): Promise<PendingEvent[]> {
    return [...this.byId.values()].filter((event) => event.deadLetteredAt);
  }
}
