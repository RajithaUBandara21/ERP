import {
  CashProvider,
  DrizzlePaymentAttemptRepository,
  PAYMENTS_PERMISSIONS,
  PaymentAttemptNotFoundError,
  PaymentAttemptNotSucceededError,
  ProviderError,
  refundPayment,
  RefundExceedsCapturedAmountError,
  SimulatedCardProvider,
} from "@erp/payments";
import { createLogger } from "@erp/logging";
import { stripUndefined, z } from "@erp/validation";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/with-permission";

const paymentAttemptRepository = new DrizzlePaymentAttemptRepository();
const providers = { cash: new CashProvider(), card: new SimulatedCardProvider() };
const logger = createLogger({ bindings: { module: "payments", operation: "refund-payment-route" } });

const refundSchema = z.object({
  amountCents: z.number().int().positive(),
  reason: z.string().optional(),
});

export const POST = withPermission<{ attemptId: string }>(
  PAYMENTS_PERMISSIONS.PAYMENT_REFUND,
  async (request, { tenant, tenantDb, params }) => {
    const requestId = crypto.randomUUID();
    const body = await request.json().catch(() => undefined);
    const parsed = refundSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_REQUEST", message: "Invalid refund request", requestId }, { status: 400 });
    }

    try {
      const result = await refundPayment(
        { paymentAttemptRepository, providers },
        tenantDb,
        { paymentAttemptId: params.attemptId, ...stripUndefined(parsed.data) },
      );
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof PaymentAttemptNotFoundError) {
        return NextResponse.json({ code: "PAYMENT_ATTEMPT_NOT_FOUND", message: error.message, requestId }, { status: 404 });
      }
      if (error instanceof PaymentAttemptNotSucceededError) {
        return NextResponse.json({ code: "PAYMENT_NOT_REFUNDABLE", message: error.message, requestId }, { status: 409 });
      }
      if (error instanceof RefundExceedsCapturedAmountError) {
        return NextResponse.json({ code: "REFUND_EXCEEDS_CAPTURED_AMOUNT", message: error.message, requestId }, { status: 422 });
      }
      if (error instanceof ProviderError) {
        return NextResponse.json({ code: "PROVIDER_REFUND_FAILED", message: error.message, requestId }, { status: 402 });
      }

      logger.error("refund failed unexpectedly", {
        requestId,
        tenantId: tenant.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
    }
  },
);
