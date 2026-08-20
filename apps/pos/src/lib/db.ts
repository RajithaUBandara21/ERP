import { openDB, type DBSchema, type IDBPDatabase } from "idb";

/**
 * IndexedDB via `idb` (Jake Archibald's promise wrapper around the native
 * IndexedDB API — ~1KB gzipped, zero runtime dependencies, no build step).
 * Chosen over hand-rolled raw IndexedDB (callback/event-based, verbose,
 * easy to get wrong around transaction lifetimes) and over a heavier
 * offline-storage framework (e.g. Dexie) — `idb` is a thin, well-maintained
 * wrapper that stays close to the platform API rather than replacing it,
 * which keeps this "true foundation" layer easy to reason about and test
 * (see vitest.config.ts's fake-indexeddb setup).
 *
 * OFFLINE-POS.md §2 lists products/prices/tax/customers as local
 * persistence targets too — not stored here yet, since no catalog module
 * exists server-side to sync them from (see docs/modules/pos.md); this
 * phase covers terminal identity and the sale sync queue only.
 */

export type PendingSaleStatus = "pending" | "syncing" | "synced" | "failed" | "conflict";

export interface PendingSaleLine {
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
}

export interface PendingSale {
  localId: string;
  idempotencyKey: string;
  lines: PendingSaleLine[];
  paymentMethod: string;
  paymentMethodToken?: string;
  taxCents?: number;
  createdAt: string;
  status: PendingSaleStatus;
  attempts: number;
  lastError?: string;
  nextRetryAt?: string;
  serverTransactionId?: string;
}

export interface TerminalRecord {
  id: "current";
  tenantHost: string;
  terminalId: string;
  deviceId: string;
  terminalName: string;
  registeredAt: string;
  /** Monotonic, persisted counter — see idempotency.ts's doc comment on why this must never reset or reuse a value. */
  saleSequence: number;
}

interface PosDbSchema extends DBSchema {
  terminal: {
    key: TerminalRecord["id"];
    value: TerminalRecord;
  };
  pendingSales: {
    key: PendingSale["localId"];
    value: PendingSale;
    indexes: { "by-status": PendingSaleStatus; "by-createdAt": string };
  };
}

const DB_NAME = "erp-pos";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PosDbSchema>> | undefined;

export function getPosDb(): Promise<IDBPDatabase<PosDbSchema>> {
  dbPromise ??= openDB<PosDbSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore("terminal", { keyPath: "id" });
      const sales = db.createObjectStore("pendingSales", { keyPath: "localId" });
      sales.createIndex("by-status", "status");
      sales.createIndex("by-createdAt", "createdAt");
    },
  });
  return dbPromise;
}

/**
 * Testing-only seam: clears the cached connection so the next getPosDb()
 * call opens fresh against whatever IndexedDB implementation is current
 * (e.g. a new fake-indexeddb instance per test) — without this, the
 * module-level memoization above would keep every test's connection
 * pinned to the first IndexedDB instance ever opened in the process.
 */
export function resetPosDbForTests(): void {
  dbPromise = undefined;
}

export async function getTerminalRecord(): Promise<TerminalRecord | undefined> {
  const db = await getPosDb();
  return db.get("terminal", "current");
}

export async function saveTerminalRecord(record: TerminalRecord): Promise<void> {
  const db = await getPosDb();
  await db.put("terminal", record);
}

/** Atomically reserves the next sale sequence number — see idempotency.ts. */
export async function nextSaleSequence(): Promise<number> {
  const db = await getPosDb();
  const tx = db.transaction("terminal", "readwrite");
  const record = await tx.store.get("current");
  if (!record) throw new Error("No terminal record — complete setup first");
  const sequence = record.saleSequence + 1;
  await tx.store.put({ ...record, saleSequence: sequence });
  await tx.done;
  return sequence;
}

export async function savePendingSale(sale: PendingSale): Promise<void> {
  const db = await getPosDb();
  await db.put("pendingSales", sale);
}

export async function listPendingSales(): Promise<PendingSale[]> {
  const db = await getPosDb();
  const all = await db.getAllFromIndex("pendingSales", "by-createdAt");
  return all;
}

export async function getSyncableSales(now: Date = new Date()): Promise<PendingSale[]> {
  const all = await listPendingSales();
  return all.filter(
    (sale) =>
      sale.status === "pending" || (sale.status === "failed" && (!sale.nextRetryAt || new Date(sale.nextRetryAt) <= now)),
  );
}
