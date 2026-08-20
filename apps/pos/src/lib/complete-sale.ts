import { getTerminalRecord, nextSaleSequence, savePendingSale, type PendingSale, type PendingSaleLine } from "./db";
import { generateIdempotencyKey } from "./idempotency";

export interface CompleteSaleInput {
  lines: PendingSaleLine[];
  paymentMethod: string;
  paymentMethodToken?: string;
  taxCents?: number;
}

/**
 * OFFLINE-POS.md §1: the golden path never blocks on network — this
 * writes the sale to durable local storage and returns immediately,
 * regardless of connectivity. Syncing to the server (sync-queue.ts) is a
 * separate, best-effort step that happens after the sale is already
 * "done" from the cashier's perspective.
 */
export async function completeSaleOffline(input: CompleteSaleInput): Promise<PendingSale> {
  const terminal = await getTerminalRecord();
  if (!terminal) throw new Error("No terminal record — complete setup first");
  if (input.lines.length === 0) throw new Error("Cannot complete a sale with no lines");

  const sequence = await nextSaleSequence();
  const idempotencyKey = generateIdempotencyKey(terminal.terminalId, sequence);

  const sale: PendingSale = {
    localId: crypto.randomUUID(),
    idempotencyKey,
    lines: input.lines,
    paymentMethod: input.paymentMethod,
    ...(input.paymentMethodToken !== undefined ? { paymentMethodToken: input.paymentMethodToken } : {}),
    ...(input.taxCents !== undefined ? { taxCents: input.taxCents } : {}),
    createdAt: new Date().toISOString(),
    status: "pending",
    attempts: 0,
  };
  await savePendingSale(sale);
  return sale;
}
