import * as api from "./api-client";
import { ApiError, NetworkError } from "./api-client";
import { getSyncableSales, savePendingSale, type PendingSale } from "./db";

/**
 * Drains the durable sale queue — OFFLINE-POS.md §6: entries sync in
 * creation order (causal consistency per terminal), retried with backoff
 * + jitter on failure, never in a tight loop. Processes ONE sale fully
 * before starting the next (not in parallel) — the ordering guarantee
 * matters more than throughput for this "true foundation" scope, and a
 * single POS terminal's own queue is never large enough for serial
 * processing to be a real bottleneck.
 */
export async function drainSyncQueue(tenantHost: string, terminalId: string): Promise<void> {
  const sales = await getSyncableSales();
  for (const sale of sales) {
    await syncOneSale(tenantHost, terminalId, sale);
  }
}

/**
 * Exponential backoff with jitter (CLAUDE.md §26) — never a tight retry
 * loop. Caps at 5 minutes so a terminal that's been offline for hours
 * doesn't wait an unreasonable amount of time once it does reconnect.
 */
export function backoffMs(attempts: number): number {
  const base = Math.min(30_000 * 2 ** Math.max(attempts - 1, 0), 5 * 60_000);
  const jitter = Math.floor(Math.random() * 1000);
  return base + jitter;
}

/**
 * Resumable but not fully partial-state-aware: a retry after a network
 * failure always re-creates a fresh cart and re-adds every line, then
 * calls checkout with the SAME idempotencyKey every time. This is safe
 * (never double-completes a sale) because checkout()'s own idempotency
 * check runs before it touches the cart at all (modules/pos/src/
 * application/checkout.ts) — a retry that recreates a cart but then hits
 * an already-completed idempotency key just returns the original
 * transaction. The cost is a documented, accepted gap: a cart abandoned
 * partway through a failed sync attempt is never cleaned up here (no
 * garbage-collection job exists yet for orphaned "open" carts) — a
 * correctness-neutral cleanliness gap, not a duplication risk.
 */
export async function syncOneSale(tenantHost: string, terminalId: string, sale: PendingSale): Promise<PendingSale> {
  const syncing: PendingSale = { ...sale, status: "syncing" };
  await savePendingSale(syncing);

  try {
    const cart = await api.createCart(tenantHost, terminalId);
    for (const line of sale.lines) {
      await api.addCartLine(tenantHost, cart.id, line);
    }
    const transaction = await api.checkout(tenantHost, cart.id, {
      idempotencyKey: sale.idempotencyKey,
      paymentMethod: sale.paymentMethod,
      ...(sale.paymentMethodToken !== undefined ? { paymentMethodToken: sale.paymentMethodToken } : {}),
      ...(sale.taxCents !== undefined ? { taxCents: sale.taxCents } : {}),
    });

    const synced: PendingSale = { ...syncing, status: "synced", serverTransactionId: transaction.id };
    await savePendingSale(synced);
    return synced;
  } catch (error) {
    if (error instanceof NetworkError) {
      const attempts = syncing.attempts + 1;
      const failed: PendingSale = {
        ...syncing,
        status: "failed",
        attempts,
        lastError: error.message,
        nextRetryAt: new Date(Date.now() + backoffMs(attempts)).toISOString(),
      };
      await savePendingSale(failed);
      return failed;
    }

    // A definitive server response (4xx/5xx that isn't a network failure)
    // is a genuine conflict OFFLINE-POS.md §5's deterministic policies
    // don't cover automatically here (e.g. oversell — this "true
    // foundation" phase does not implement a backorder/negative-inventory
    // allowance server-side, so an offline sale that would oversell
    // surfaces for manual review rather than silently completing, per §5's
    // fallback: "Any conflict not covered by a deterministic policy is
    // queued for manual resolution"). Never auto-retried.
    const message = error instanceof ApiError ? `${error.code}: ${error.message}` : error instanceof Error ? error.message : String(error);
    const conflict: PendingSale = { ...syncing, status: "conflict", lastError: message };
    await savePendingSale(conflict);
    return conflict;
  }
}
