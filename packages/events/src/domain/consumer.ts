import type { TenantDb } from "@erp/database";
import type { DomainEvent } from "./domain-event";

/**
 * CLAUDE.md §25's consumer requirements. `id` is the dedup key —
 * publishPendingEvents records (id, eventId) pairs as delivered so
 * at-least-once delivery never re-invokes the same consumer for the same
 * event twice, even across publisher restarts (see infrastructure/
 * persistence/schema.ts's processedEvents table). This is on top of, not
 * instead of, `handle` itself being safe to re-run — belt and suspenders,
 * since a handler crash *during* a delivery attempt (after partial work
 * but before the publisher records success) is still possible.
 */
export interface EventConsumer<TPayload = unknown> {
  id: string;
  eventType: string;
  handle(event: DomainEvent<TPayload>, db: TenantDb): Promise<void>;
}
