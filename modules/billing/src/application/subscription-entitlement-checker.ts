import type { EntitlementChecker } from "@erp/core";
import { isEntitled } from "../domain/subscription";
import type { PlanRepository } from "./plan-repository";
import type { SubscriptionRepository } from "./subscription-repository";

/**
 * The real implementation of @erp/core's EntitlementChecker seam — wired in
 * by apps/web's install route (the composition root), not by modules/core
 * itself (which stays dependency-free). Fails closed: a tenant with no
 * subscription, or one that's past_due/canceled, is not entitled to
 * install anything (CLAUDE.md §57's "who can access this" default-deny).
 */
export class SubscriptionEntitlementChecker implements EntitlementChecker {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly planRepository: PlanRepository,
  ) {}

  async isModuleIncluded(tenantId: string, moduleId: string): Promise<boolean> {
    const subscription = await this.subscriptionRepository.findForTenant(tenantId);
    if (!subscription || !isEntitled(subscription.status)) return false;

    const plan = await this.planRepository.findById(subscription.planId);
    if (!plan) return false;

    return plan.includedModules.includes(moduleId);
  }
}
