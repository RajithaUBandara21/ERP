import type { Plan } from "../domain/plan";
import type { PlanRepository } from "./plan-repository";

/**
 * The two default plans, matching CLAUDE.md §1's own Tenant A / Tenant B
 * illustration. includedModules lists every module a subscribed tenant may
 * install, including the always-on foundational ones (core/tenant/identity)
 * — see domain/plan.ts's doc comment on why. Plans are global (not
 * tenant-scoped), so this is idempotent and safe to call redundantly, the
 * same pattern as identity's seedDefaultRoles.
 */
export async function seedDefaultPlans(repository: PlanRepository): Promise<{ starter: Plan; growth: Plan }> {
  const starter = await repository.upsert({
    code: "starter",
    name: "Starter",
    // pos hard-depends on both inventory and payments (modules/pos/src/module.manifest.ts)
    // — payments must be included even though it's not customer-facing on
    // its own, or a starter tenant could install pos's dependencies but
    // never satisfy them all through the entitlement-gated install route.
    includedModules: ["core", "tenant", "identity", "pos", "inventory", "payments"],
    userLimit: 5,
    priceCents: 4900,
    billingInterval: "monthly",
  });

  const growth = await repository.upsert({
    code: "growth",
    name: "Growth",
    includedModules: ["core", "tenant", "identity", "pos", "inventory", "payments", "delivery", "reporting"],
    userLimit: 50,
    priceCents: 19900,
    billingInterval: "monthly",
  });

  return { starter, growth };
}
