import {
  BILLING_PERMISSIONS,
  DrizzlePlanRepository,
  DrizzleSubscriptionRepository,
  getSubscriptionForTenant,
  NoSubscriptionError,
} from "@erp/billing";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/with-permission";

const planRepository = new DrizzlePlanRepository();
const subscriptionRepository = new DrizzleSubscriptionRepository();

export const GET = withPermission(BILLING_PERMISSIONS.SUBSCRIPTION_READ, async (_request, { tenant }) => {
  const requestId = crypto.randomUUID();

  try {
    const { subscription, plan } = await getSubscriptionForTenant({ planRepository, subscriptionRepository }, tenant.id);
    return NextResponse.json({ subscription, plan });
  } catch (error) {
    if (error instanceof NoSubscriptionError) {
      return NextResponse.json({ code: "NO_SUBSCRIPTION", message: error.message, requestId }, { status: 404 });
    }
    throw error;
  }
});
