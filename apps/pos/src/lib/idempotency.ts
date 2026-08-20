import { idempotencyKeySchema } from "@erp/validation";

/**
 * OFFLINE-POS.md §4: generated client-side at the moment of sale
 * completion (not at sync time), so a retried sync of the same
 * underlying sale always carries the same key even across app restarts —
 * this is what makes checkout() idempotent end-to-end. Format matches
 * packages/validation's idempotencyKeySchema:
 * `POS-{terminalIdShort}-{YYYYMMDD}-{sequence}`.
 */
export function generateIdempotencyKey(terminalId: string, sequence: number, now: Date = new Date()): string {
  const terminalIdShort = terminalId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const yyyy = now.getUTCFullYear().toString().padStart(4, "0");
  const mm = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = now.getUTCDate().toString().padStart(2, "0");
  const seq = (sequence % 1_000_000).toString().padStart(6, "0");
  const key = `POS-${terminalIdShort}-${yyyy}${mm}${dd}-${seq}`;
  return idempotencyKeySchema.parse(key);
}
