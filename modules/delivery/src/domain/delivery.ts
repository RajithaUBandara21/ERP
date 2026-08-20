/**
 * pending: created, no driver yet.
 * assigned: a driver is currently assigned — reachable from pending, from
 * failed (a retry/reassign, CLAUDE.md §34: "retry, reassign, manual
 * fallback" without corrupting the underlying order), or from itself (a
 * dispatcher swapping drivers before completion).
 * failed: reachable from pending/assigned; not terminal — assignable again.
 * completed: terminal.
 */
export type DeliveryStatus = "pending" | "assigned" | "completed" | "failed";

export interface Delivery {
  id: string;
  /**
   * The order this delivery fulfills — an opaque reference (e.g. a
   * PosTransaction id), not a foreign key. No Sales module exists in this
   * codebase (docs/modules/delivery.md's planned `sales` dependency isn't
   * even a scheduled phase in CLAUDE.md §54's roadmap) — see
   * module.manifest.ts's doc comment. Same "self-contained snapshot, not a
   * DB-enforced FK" pattern as modules/pos's CartLine.
   */
  orderReference: string;
  status: DeliveryStatus;
  driverId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class DeliveryNotFoundError extends Error {
  constructor(id: string) {
    super(`Delivery not found: ${id}`);
    this.name = "DeliveryNotFoundError";
  }
}

export class DeliveryNotAssignableError extends Error {
  constructor(id: string, status: DeliveryStatus) {
    super(`Delivery ${id} cannot be assigned a driver from status '${status}'`);
    this.name = "DeliveryNotAssignableError";
  }
}

export class DeliveryNotCompletableError extends Error {
  constructor(id: string, status: DeliveryStatus) {
    super(`Delivery ${id} cannot be completed from status '${status}'`);
    this.name = "DeliveryNotCompletableError";
  }
}
