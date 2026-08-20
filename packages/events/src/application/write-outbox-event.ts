import type { TenantDb } from "@erp/database";
import type { DomainEvent, NewDomainEvent } from "../domain/domain-event";
import type { OutboxRepository } from "./outbox-repository";

/**
 * ADR-0004: call this with the SAME `db`/`tx` handle the business write
 * it describes just used, inside that write's own `db.transaction()` —
 * that shared transaction is the entire guarantee this pattern provides.
 * Calling it with a fresh, separately-committed `db` handle instead
 * reintroduces exactly the dual-write failure window this exists to
 * close (CLAUDE.md §24) — a caller can do that (the type signature can't
 * prevent it), but it defeats the point.
 */
export async function writeOutboxEvent(
  repository: OutboxRepository,
  db: TenantDb,
  event: NewDomainEvent,
): Promise<DomainEvent> {
  return repository.insert(db, event);
}
