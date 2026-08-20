import type { TenantDb } from "@erp/database";
import type { EventConsumer } from "../domain/consumer";
import type { OutboxRepository } from "./outbox-repository";

/** After this many failed attempts by any single consumer, the event stops being retried and moves to the dead-letter path (CLAUDE.md §25/§26). */
export const MAX_DELIVERY_ATTEMPTS = 5;

export interface PublishPendingEventsResult {
  eventsProcessed: number;
  deliveries: number;
  failures: number;
  deadLettered: number;
}

/**
 * The outbox publisher — polls for pending rows and dispatches each to
 * every registered consumer for its event type, per-consumer idempotent
 * (CLAUDE.md §25: processing the same event_id twice for the same
 * consumer must be a no-op). No background scheduler invokes this yet
 * (CLAUDE.md §27's job system isn't built) — it's a plain callable
 * function a route, script, or future job runner can trigger; see
 * ADR-0004's Consequences for why a broker-backed publisher can replace
 * the caller of this function later without changing producers or
 * consumers.
 */
export async function publishPendingEvents(
  repository: OutboxRepository,
  db: TenantDb,
  consumers: EventConsumer[],
  options: { batchSize?: number } = {},
): Promise<PublishPendingEventsResult> {
  const pending = await repository.findPending(db, options.batchSize ?? 50);
  const result: PublishPendingEventsResult = { eventsProcessed: pending.length, deliveries: 0, failures: 0, deadLettered: 0 };

  for (const event of pending) {
    const relevantConsumers = consumers.filter((consumer) => consumer.eventType === event.eventType);
    let allSucceeded = true;

    for (const consumer of relevantConsumers) {
      if (await repository.hasBeenDelivered(db, event.eventId, consumer.id)) continue;

      try {
        await consumer.handle(event, db);
        await repository.markConsumerDelivered(db, event.eventId, consumer.id);
        result.deliveries += 1;
      } catch (error) {
        allSucceeded = false;
        const message = `${consumer.id}: ${error instanceof Error ? error.message : String(error)}`;
        const { attempts } = await repository.recordFailedAttempt(db, event.eventId, message);
        if (attempts >= MAX_DELIVERY_ATTEMPTS) {
          await repository.markDeadLettered(db, event.eventId, message);
          result.deadLettered += 1;
        } else {
          result.failures += 1;
        }
      }
    }

    if (allSucceeded) {
      await repository.markFullyDelivered(db, event.eventId);
    }
  }

  return result;
}
