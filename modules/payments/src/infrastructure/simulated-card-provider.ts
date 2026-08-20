import { randomUUID } from "node:crypto";
import type { PaymentProvider, ProviderCaptureInput, ProviderCaptureResult, ProviderRefundInput, ProviderRefundResult } from "../application/payment-provider";

/**
 * Explicitly NOT a real gateway integration — CLAUDE.md §62 requires
 * evaluating alternatives/maintenance cost before adding a dependency, and
 * no real card processor (Stripe, Adyen, etc.) has been chosen or
 * integrated. This exists to prove the PaymentProvider adapter shape
 * (tokenized input, async capture/refund, a declinable outcome) is
 * correct and swappable — the eventual real implementation replaces only
 * this file, not the port interface or any call site.
 *
 * Simulates a decline when `paymentMethodToken` is the literal sentinel
 * "tok_declined" — a deliberate test/demo hook, not a real risk-scoring
 * engine. Every other token succeeds. Never stores or accepts raw card
 * data (CLAUDE.md §33) — callers must already hold a tokenized reference.
 */
export class SimulatedCardProvider implements PaymentProvider {
  readonly id = "card";

  async capture(input: ProviderCaptureInput): Promise<ProviderCaptureResult> {
    if (input.paymentMethodToken === "tok_declined") {
      return { success: false, providerTransactionId: `CARD-${randomUUID()}`, failureReason: "card_declined" };
    }
    return { success: true, providerTransactionId: `CARD-${randomUUID()}` };
  }

  async refund(_input: ProviderRefundInput): Promise<ProviderRefundResult> {
    return { success: true, providerRefundId: `CARD-REFUND-${randomUUID()}` };
  }
}
