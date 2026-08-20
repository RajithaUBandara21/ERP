import { randomUUID } from "node:crypto";
import type { BillingCharge } from "../src/domain/billing-charge";
import type { Plan } from "../src/domain/plan";
import type { Subscription } from "../src/domain/subscription";
import type { BillingChargeRepository } from "../src/application/billing-charge-repository";
import type { PlanRepository } from "../src/application/plan-repository";
import type { SubscriptionRepository } from "../src/application/subscription-repository";
import type { GatewayChargeInput, GatewayChargeResult, PaymentGatewayPort } from "../src/application/payment-gateway-port";

export class FakePlanRepository implements PlanRepository {
  private readonly byCode = new Map<string, Plan>();

  async findByCode(code: string): Promise<Plan | undefined> {
    return this.byCode.get(code);
  }

  async findById(id: string): Promise<Plan | undefined> {
    return [...this.byCode.values()].find((plan) => plan.id === id);
  }

  async list(): Promise<Plan[]> {
    return [...this.byCode.values()];
  }

  async upsert(input: {
    code: string;
    name: string;
    includedModules: string[];
    userLimit: number | null;
    priceCents: number;
    billingInterval: "monthly" | "yearly";
  }): Promise<Plan> {
    const existing = this.byCode.get(input.code);
    const now = new Date();
    const plan: Plan = {
      id: existing?.id ?? randomUUID(),
      ...input,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.byCode.set(input.code, plan);
    return plan;
  }
}

export class FakeSubscriptionRepository implements SubscriptionRepository {
  private readonly byTenant = new Map<string, Subscription>();

  async findForTenant(tenantId: string): Promise<Subscription | undefined> {
    return this.byTenant.get(tenantId);
  }

  async create(input: { tenantId: string; planId: string }): Promise<Subscription> {
    const existing = this.byTenant.get(input.tenantId);
    if (existing) return existing;

    const now = new Date();
    const subscription: Subscription = {
      id: randomUUID(),
      tenantId: input.tenantId,
      planId: input.planId,
      status: "trialing",
      currentPeriodStart: now,
      currentPeriodEnd: null,
      createdAt: now,
      updatedAt: now,
    };
    this.byTenant.set(input.tenantId, subscription);
    return subscription;
  }

  async updateStatus(id: string, status: Subscription["status"]): Promise<void> {
    for (const [tenantId, subscription] of this.byTenant) {
      if (subscription.id === id) {
        this.byTenant.set(tenantId, { ...subscription, status, updatedAt: new Date() });
        return;
      }
    }
  }
}

export class FakeBillingChargeRepository implements BillingChargeRepository {
  private readonly charges = new Map<string, BillingCharge>();

  async create(input: { tenantId: string; amountCents: number; currency: string }): Promise<BillingCharge> {
    const now = new Date();
    const charge: BillingCharge = {
      id: randomUUID(),
      tenantId: input.tenantId,
      amountCents: input.amountCents,
      currency: input.currency,
      status: "pending",
      issuedAt: now,
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.charges.set(charge.id, charge);
    return charge;
  }

  async markPaid(id: string): Promise<void> {
    const charge = this.charges.get(id);
    if (charge) this.charges.set(id, { ...charge, status: "paid", paidAt: new Date() });
  }

  async markFailed(id: string): Promise<void> {
    const charge = this.charges.get(id);
    if (charge) this.charges.set(id, { ...charge, status: "failed" });
  }

  async listForTenant(tenantId: string): Promise<BillingCharge[]> {
    return [...this.charges.values()].filter((charge) => charge.tenantId === tenantId);
  }
}

export class FakePaymentGateway implements PaymentGatewayPort {
  constructor(private readonly result: GatewayChargeResult = { success: true, providerReference: "FAKE-REF" }) {}

  async charge(_input: GatewayChargeInput): Promise<GatewayChargeResult> {
    return this.result;
  }
}
