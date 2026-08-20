import type { Plan } from "../domain/plan";
import type { Subscription } from "../domain/subscription";
import { NoSubscriptionError } from "../domain/subscription";
import { PlanNotFoundError } from "../domain/plan";
import type { PlanRepository } from "./plan-repository";
import type { SubscriptionRepository } from "./subscription-repository";

export interface SubscriptionWithPlan {
  subscription: Subscription;
  plan: Plan;
}

export interface GetSubscriptionDependencies {
  planRepository: PlanRepository;
  subscriptionRepository: SubscriptionRepository;
}

export async function getSubscriptionForTenant(
  dependencies: GetSubscriptionDependencies,
  tenantId: string,
): Promise<SubscriptionWithPlan> {
  const subscription = await dependencies.subscriptionRepository.findForTenant(tenantId);
  if (!subscription) throw new NoSubscriptionError(tenantId);

  const plan = await dependencies.planRepository.findById(subscription.planId);
  if (!plan) throw new PlanNotFoundError(subscription.planId);

  return { subscription, plan };
}
