import type { TenantDb } from "@erp/database";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { DomainEvent, NewDomainEvent } from "../domain/domain-event";
import type { OutboxRepository, PendingEvent } from "../application/outbox-repository";
import { outbox, processedEvents } from "./persistence/schema";

function toDomain(row: typeof outbox.$inferSelect): DomainEvent {
  return {
    eventId: row.id,
    aggregateId: row.aggregateId,
    eventType: row.eventType,
    version: row.version,
    createdAt: row.createdAt,
    payload: row.payload,
  };
}

function toPending(row: typeof outbox.$inferSelect): PendingEvent {
  return { ...toDomain(row), attempts: row.attempts };
}

export class DrizzleOutboxRepository implements OutboxRepository {
  async insert(db: TenantDb, event: NewDomainEvent): Promise<DomainEvent> {
    const [row] = await db
      .insert(outbox)
      .values({ aggregateId: event.aggregateId, eventType: event.eventType, version: event.version ?? 1, payload: event.payload })
      .returning();
    if (!row) throw new Error("Failed to write outbox event");
    return toDomain(row);
  }

  async findPending(db: TenantDb, limit: number): Promise<PendingEvent[]> {
    const rows = await db
      .select()
      .from(outbox)
      .where(and(isNull(outbox.deliveredAt), isNull(outbox.deadLetteredAt)))
      .orderBy(outbox.createdAt)
      .limit(limit);
    return rows.map(toPending);
  }

  async hasBeenDelivered(db: TenantDb, eventId: string, consumerId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: processedEvents.id })
      .from(processedEvents)
      .where(and(eq(processedEvents.eventId, eventId), eq(processedEvents.consumerId, consumerId)))
      .limit(1);
    return Boolean(row);
  }

  async markConsumerDelivered(db: TenantDb, eventId: string, consumerId: string): Promise<void> {
    await db
      .insert(processedEvents)
      .values({ eventId, consumerId })
      .onConflictDoNothing({ target: [processedEvents.eventId, processedEvents.consumerId] });
  }

  async markFullyDelivered(db: TenantDb, eventId: string): Promise<void> {
    await db.update(outbox).set({ deliveredAt: new Date() }).where(eq(outbox.id, eventId));
  }

  async recordFailedAttempt(db: TenantDb, eventId: string, error: string): Promise<{ attempts: number }> {
    const [row] = await db
      .update(outbox)
      .set({ attempts: sql`${outbox.attempts} + 1`, lastError: error })
      .where(eq(outbox.id, eventId))
      .returning({ attempts: outbox.attempts });
    if (!row) throw new Error(`Outbox event not found: ${eventId}`);
    return { attempts: row.attempts };
  }

  async markDeadLettered(db: TenantDb, eventId: string, error: string): Promise<void> {
    await db.update(outbox).set({ deadLetteredAt: new Date(), lastError: error }).where(eq(outbox.id, eventId));
  }

  async findDeadLettered(db: TenantDb): Promise<PendingEvent[]> {
    const rows = await db.select().from(outbox).where(isNotNull(outbox.deadLetteredAt)).orderBy(outbox.createdAt);
    return rows.map(toPending);
  }
}
