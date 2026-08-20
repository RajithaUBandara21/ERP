/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 *
 * Phase 15 exit proof, through the real HTTP route handlers: a tenant with
 * no subscription can't even read one (404), subscribing to "starter"
 * entitles it to install a module the plan includes (pos, via HTTP —
 * proving the real SubscriptionEntitlementChecker wiring in the install
 * route, not just the unit-level fake), denies one the plan doesn't
 * include (delivery, 402 MODULE_NOT_ENTITLED), and a manual charge against
 * the stub gateway is recorded as paid. Also covers permission gating.
 */
import postgres from "postgres";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb, getTenantDb } from "@erp/database";
import { createTenant, DrizzleTenantRepository, provisionTenantDatabase, tenantManifest } from "@erp/tenant";
import {
  DrizzleRoleRepository,
  DrizzleUserRepository,
  identityManifest,
  registerUser,
  seedDefaultRoles,
} from "@erp/identity";
import { coreManifest, DrizzleModuleRegistryRepository, installModule } from "@erp/core";
import { DrizzlePlanRepository, DrizzleSubscriptionRepository, seedDefaultPlans } from "@erp/billing";
import { ModuleRegistry } from "@erp/module-registry";

const hasDatabases = Boolean(process.env.CONTROL_PLANE_DATABASE_URL && process.env.TENANT_DATABASE_ADMIN_URL);

function loginRequestFor(host: string, body: { email: string; password: string }): NextRequest {
  const headers = new Headers({ host, "x-tenant-host-hint": host, "content-type": "application/json" });
  return new NextRequest(`http://${host}/api/auth/login`, { method: "POST", body: JSON.stringify(body), headers });
}

function requestFor(host: string, path: string, sessionToken: string, method = "GET"): NextRequest {
  const headers = new Headers({ host, "x-tenant-host-hint": host, cookie: `erp_session=${sessionToken}` });
  return new NextRequest(`http://${host}${path}`, { method, headers });
}

function extractSessionToken(response: Response): string {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = /erp_session=([^;]+)/.exec(setCookie);
  if (!match) throw new Error("No session cookie set on login response");
  return match[1]!;
}

describe.skipIf(!hasDatabases)("billing flow (integration)", () => {
  const runId = Date.now();
  const slug = `billing-flow-${runId}`;
  const host = `${slug}.platform.example.com`;
  const databaseName = `tenant_${slug.replace(/-/g, "_")}`;
  const ownerPassword = "owner-password1";
  const memberPassword = "member-password1";
  let tenantId: string;

  beforeAll(async () => {
    const tenantRepo = new DrizzleTenantRepository();
    const tenant = await createTenant(tenantRepo, { slug, name: "Billing Flow Test Tenant" });
    tenantId = tenant.id;
    await provisionTenantDatabase(tenant);

    const registry = new ModuleRegistry();
    registry.register(coreManifest);
    registry.register(tenantManifest);
    registry.register(identityManifest);
    registry.validateGraph();
    const moduleRepository = new DrizzleModuleRegistryRepository();
    await installModule(registry, moduleRepository, tenant.id, "core", null);
    await installModule(registry, moduleRepository, tenant.id, "tenant", null);
    await installModule(registry, moduleRepository, tenant.id, "identity", null);

    const db = await getTenantDb(tenant.id);
    const { owner, member } = await seedDefaultRoles(new DrizzleRoleRepository(), db);
    const userRepository = new DrizzleUserRepository();
    await registerUser(userRepository, db, { email: "owner@billing-flow.example", password: ownerPassword, name: "Owner", roleId: owner.id });
    await registerUser(userRepository, db, { email: "member@billing-flow.example", password: memberPassword, name: "Member", roleId: member.id });
  });

  afterAll(async () => {
    const admin = postgres(process.env.TENANT_DATABASE_ADMIN_URL!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.end();
    await closeControlPlaneDb();
  });

  async function loginAs(email: string, password: string): Promise<string> {
    const { POST: login } = await import("../src/app/api/auth/login/route");
    const response = await login(loginRequestFor(host, { email, password }));
    return extractSessionToken(response);
  }

  it("a tenant with no subscription gets 404 reading its subscription, and can't install anything entitlement-gated", async () => {
    const token = await loginAs("owner@billing-flow.example", ownerPassword);

    const { GET: getSubscription } = await import("../src/app/api/billing/subscription/route");
    const subResponse = await getSubscription(requestFor(host, "/api/billing/subscription", token));
    expect(subResponse.status).toBe(404);

    const { POST: install } = await import("../src/app/api/modules/[moduleId]/install/route");
    const installResponse = await install(requestFor(host, "/api/modules/inventory/install", token, "POST"), {
      params: Promise.resolve({ moduleId: "inventory" }),
    });
    expect(installResponse.status).toBe(402);
    const body = await installResponse.json();
    expect(body.code).toBe("MODULE_NOT_ENTITLED");
  });

  it("member cannot read the subscription or record a charge", async () => {
    const token = await loginAs("member@billing-flow.example", memberPassword);

    const { GET: getSubscription } = await import("../src/app/api/billing/subscription/route");
    expect((await getSubscription(requestFor(host, "/api/billing/subscription", token))).status).toBe(403);

    const { POST: charge } = await import("../src/app/api/billing/charge/route");
    expect((await charge(requestFor(host, "/api/billing/charge", token, "POST"))).status).toBe(403);
  });

  it("subscribing to starter entitles pos (included) but not delivery (not included), installed via the real HTTP route", async () => {
    const planRepository = new DrizzlePlanRepository();
    const subscriptionRepository = new DrizzleSubscriptionRepository();
    await seedDefaultPlans(planRepository);
    await subscriptionRepository.create({
      tenantId,
      planId: (await planRepository.findByCode("starter"))!.id,
    });

    const token = await loginAs("owner@billing-flow.example", ownerPassword);

    const { GET: getSubscription } = await import("../src/app/api/billing/subscription/route");
    const subResponse = await getSubscription(requestFor(host, "/api/billing/subscription", token));
    expect(subResponse.status).toBe(200);
    const subBody = await subResponse.json();
    expect(subBody.plan.code).toBe("starter");

    const { POST: install } = await import("../src/app/api/modules/[moduleId]/install/route");

    // starter includes inventory and payments — pos's own hard dependencies.
    const inventoryResponse = await install(requestFor(host, "/api/modules/inventory/install", token, "POST"), {
      params: Promise.resolve({ moduleId: "inventory" }),
    });
    expect(inventoryResponse.status).toBe(200);
    const paymentsResponse = await install(requestFor(host, "/api/modules/payments/install", token, "POST"), {
      params: Promise.resolve({ moduleId: "payments" }),
    });
    expect(paymentsResponse.status).toBe(200);

    const posResponse = await install(requestFor(host, "/api/modules/pos/install", token, "POST"), {
      params: Promise.resolve({ moduleId: "pos" }),
    });
    expect(posResponse.status).toBe(200);

    // delivery is not in starter's includedModules.
    const deliveryResponse = await install(requestFor(host, "/api/modules/delivery/install", token, "POST"), {
      params: Promise.resolve({ moduleId: "delivery" }),
    });
    expect(deliveryResponse.status).toBe(402);
    const deliveryBody = await deliveryResponse.json();
    expect(deliveryBody.code).toBe("MODULE_NOT_ENTITLED");
  });

  it("owner records a charge against the stub gateway, which is recorded as paid", async () => {
    const token = await loginAs("owner@billing-flow.example", ownerPassword);
    const { POST: charge } = await import("../src/app/api/billing/charge/route");
    const response = await charge(requestFor(host, "/api/billing/charge", token, "POST"));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.status).toBe("paid");
    expect(body.amountCents).toBe(4900); // starter's priceCents
  });
});
