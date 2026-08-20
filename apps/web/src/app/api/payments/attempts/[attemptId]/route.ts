import { DrizzlePaymentAttemptRepository, getPaymentAttempt, PAYMENTS_PERMISSIONS, PaymentAttemptNotFoundError } from "@erp/payments";
import { createLogger } from "@erp/logging";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/with-permission";

const repository = new DrizzlePaymentAttemptRepository();
const logger = createLogger({ bindings: { module: "payments", operation: "get-payment-attempt-route" } });

export const GET = withPermission<{ attemptId: string }>(
  PAYMENTS_PERMISSIONS.PAYMENT_READ,
  async (_request, { tenant, tenantDb, params }) => {
    const requestId = crypto.randomUUID();
    try {
      const attempt = await getPaymentAttempt(repository, tenantDb, params.attemptId);
      return NextResponse.json(attempt);
    } catch (error) {
      if (error instanceof PaymentAttemptNotFoundError) {
        return NextResponse.json({ code: "PAYMENT_ATTEMPT_NOT_FOUND", message: error.message, requestId }, { status: 404 });
      }
      logger.error("get payment attempt failed unexpectedly", {
        requestId,
        tenantId: tenant.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
    }
  },
);
