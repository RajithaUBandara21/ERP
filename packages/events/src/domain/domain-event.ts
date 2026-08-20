/**
 * EVENTS.md §4's envelope. `eventId` is the outbox row's own primary key
 * (see infrastructure/persistence/schema.ts) — assigned when the event is
 * written, not before, so it's stable and unique per event instance.
 * `payload` carries stable identifiers only (CLAUDE.md §23: never large or
 * sensitive data) — a consumer needing more looks it up through the
 * owning module's own query interface.
 */
export interface DomainEvent<TPayload = unknown> {
  eventId: string;
  aggregateId: string;
  eventType: string;
  version: number;
  createdAt: Date;
  payload: TPayload;
}

/** Input to writeOutboxEvent — everything except what the database assigns (eventId, createdAt). */
export interface NewDomainEvent<TPayload = unknown> {
  aggregateId: string;
  eventType: string;
  version?: number;
  payload: TPayload;
}

/**
 * EVENTS.md §2's representative list. Not an exhaustive or closed set —
 * new event types are added as producers need them — but keeping the
 * ones CLAUDE.md §23 names in one place gives producers and consumers a
 * shared vocabulary instead of ad-hoc string literals scattered per module.
 */
export const DOMAIN_EVENT_TYPES = {
  ORDER_CREATED: "OrderCreated",
  ORDER_PAID: "OrderPaid",
  ORDER_CANCELLED: "OrderCancelled",
  STOCK_RESERVED: "StockReserved",
  STOCK_RELEASED: "StockReleased",
  DELIVERY_CREATED: "DeliveryCreated",
  DELIVERY_ASSIGNED: "DeliveryAssigned",
  DELIVERY_COMPLETED: "DeliveryCompleted",
  PAYMENT_CAPTURED: "PaymentCaptured",
  PAYMENT_REFUNDED: "PaymentRefunded",
} as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[keyof typeof DOMAIN_EVENT_TYPES];
