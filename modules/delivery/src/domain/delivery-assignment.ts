/**
 * An append-only audit trail of every assign/reassign — Delivery.driverId
 * is the current-state projection, this is the history (CLAUDE.md §37).
 * `unassignedAt` is set when a later assignment supersedes this one.
 */
export interface DeliveryAssignment {
  id: string;
  deliveryId: string;
  driverId: string;
  assignedAt: Date;
  unassignedAt: Date | null;
}
