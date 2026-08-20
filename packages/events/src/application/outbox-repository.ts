import type { TenantDb } from "@erp/database";
import type { DomainEvent, NewDomainEvent } from "../domain/domain-event";

export interface PendingEvent extends DomainEvent {
  attempts: number;
}

export interface OutboxRepository {
  /**
   * Inserts the event row. Callers pass whichever `db` handle their
   * business write used (the tenant db, or a `tx` from that write's own
   * `db.transaction()`) — same-transaction atomicity is the caller's
   * responsibility to preserve by passing the right handle through, not
   * something this repository can enforce on its own (ADR-0004).
   */
  insert(db: TenantDb, event: NewDomainEvent): Promise<DomainEvent>;

  /** Rows not yet marked fully delivered or dead-lettered, oldest first. */
  findPending(db: TenantDb, limit: number): Promise<PendingEvent[]>;

  /** Has this specific consumer already processed this event? (per-consumer dedup — CLAUDE.md §25.) */
  hasBeenDelivered(db: TenantDb, eventId: string, consumerId: string): Promise<boolean>;

  /** Records one consumer's successful delivery of this event. */
  markConsumerDelivered(db: TenantDb, eventId: string, consumerId: string): Promise<void>;

  /** Marks the row itself as fully delivered — every consumer the publisher knew about at the time succeeded. Excludes it from findPending. */
  markFullyDelivered(db: TenantDb, eventId: string): Promise<void>;

  /** Increments attempts and records the failure; the caller decides (based on the returned attempt count) whether to dead-letter. */
  recordFailedAttempt(db: TenantDb, eventId: string, error: string): Promise<{ attempts: number }>;

  markDeadLettered(db: TenantDb, eventId: string, error: string): Promise<void>;

  findDeadLettered(db: TenantDb): Promise<PendingEvent[]>;
}
