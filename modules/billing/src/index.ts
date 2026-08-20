export type { BillingInterval, Plan } from "./domain/plan";
export { PlanNotFoundError } from "./domain/plan";
export type { Subscription, SubscriptionStatus } from "./domain/subscription";
export { NoSubscriptionError, isEntitled } from "./domain/subscription";
export type { BillingCharge, BillingChargeStatus } from "./domain/billing-charge";
export { BILLING_PERMISSIONS } from "./domain/permissions";
export type { BillingPermission } from "./domain/permissions";

export type { PlanRepository } from "./application/plan-repository";
export type { SubscriptionRepository } from "./application/subscription-repository";
export type { BillingChargeRepository } from "./application/billing-charge-repository";
export type { GatewayChargeInput, GatewayChargeResult, PaymentGatewayPort } from "./application/payment-gateway-port";

export { seedDefaultPlans } from "./application/seed-default-plans";
export { createSubscription } from "./application/create-subscription";
export { getSubscriptionForTenant } from "./application/get-subscription-for-tenant";
export type { SubscriptionWithPlan } from "./application/get-subscription-for-tenant";
export { recordCharge } from "./application/record-charge";
export { SubscriptionEntitlementChecker } from "./application/subscription-entitlement-checker";

export { DrizzlePlanRepository } from "./infrastructure/drizzle-plan-repository";
export { DrizzleSubscriptionRepository } from "./infrastructure/drizzle-subscription-repository";
export { DrizzleBillingChargeRepository } from "./infrastructure/drizzle-billing-charge-repository";
export { StubPaymentGateway } from "./infrastructure/stub-payment-gateway";

export { billingManifest } from "./module.manifest";
