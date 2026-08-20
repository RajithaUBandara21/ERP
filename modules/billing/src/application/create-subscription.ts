import type { Subscription } from "../domain/subscription";
import { PlanNotFoundError } from "../domain/plan";
import type { PlanRepository } from "./plan-repository";
import type { SubscriptionRepository } from "./subscription-repository";

export interface CreateSubscriptionDependencies {
  planRepository: PlanRepository;
  subscriptionRepository: SubscriptionRepository;
}

/** Idempotent: a tenant that already has a subscription (any status) gets it back unchanged, never a duplicate — see subscription-repository.ts. */
export async function createSubscription(
  dependencies: CreateSubscriptionDependencies,
  input: { tenantId: string; planCode: string },
): Promise<Subscription> {
  const plan = await dependencies.planRepository.findByCode(input.planCode);
  if (!plan) throw new PlanNotFoundError(input.planCode);

  return dependencies.subscriptionRepository.create({ tenantId: input.tenantId, planId: plan.id });
}
