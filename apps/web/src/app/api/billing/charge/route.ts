import {
  BILLING_PERMISSIONS,
  DrizzleBillingChargeRepository,
  DrizzlePlanRepository,
  DrizzleSubscriptionRepository,
  NoSubscriptionError,
  recordCharge,
  StubPaymentGateway,
} from "@erp/billing";
import { createLogger } from "@erp/logging";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/with-permission";

const planRepository = new DrizzlePlanRepository();
const subscriptionRepository = new DrizzleSubscriptionRepository();
const billingChargeRepository = new DrizzleBillingChargeRepository();
const paymentGateway = new StubPaymentGateway();
const logger = createLogger({ bindings: { module: "billing", operation: "charge-route" } });

/**
 * No billing-cycle scheduler exists yet (CLAUDE.md §27) — this is the
 * manual trigger until one does, the same precedent as
 * POST /api/events/publish (Phase 13).
 */
export const POST = withPermission(BILLING_PERMISSIONS.CHARGE_RECORD, async (_request, { tenant }) => {
  const requestId = crypto.randomUUID();

  try {
    const charge = await recordCharge({ planRepository, subscriptionRepository, billingChargeRepository, paymentGateway }, tenant.id);
    return NextResponse.json(charge, { status: charge.status === "paid" ? 201 : 402 });
  } catch (error) {
    if (error instanceof NoSubscriptionError) {
      return NextResponse.json({ code: "NO_SUBSCRIPTION", message: error.message, requestId }, { status: 404 });
    }

    logger.error("charge recording failed unexpectedly", {
      requestId,
      tenantId: tenant.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
  }
});
