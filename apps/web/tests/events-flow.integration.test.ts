/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 *
 * Phase 13 exit proof — EVENTS.md §6's worked example, end to end through
 * real HTTP route handlers: a POS checkout writes OrderPaid to the outbox
 * in the same transaction as the sale; POST /api/events/publish drains
 * the queue; delivery's consumer idempotently creates a pending Delivery
 * referencing the paid transaction. Also proves per-consumer delivery
 * dedup: publishing twice never creates a second Delivery for the same
 * transaction.
 *
 * Phase 14 extends this same flagship test: reporting's consumer reacts to
 * the identical OrderPaid event independently of delivery's, so the sale
 * must also show up in GET /api/reporting/sales-summary once published.
 */
import postgres from "postgres";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb, getTenantDb } from "@erp/database";
import { createTenant, DrizzleTenantRepository, provisionTenantDatabase, tenantManifest } from "@erp/tenant";
import { DrizzleRoleRepository, DrizzleUserRepository, identityManifest, registerUser, seedDefaultRoles } from "@erp/identity";
import { inventoryManifest } from "@erp/inventory";
import { paymentsManifest } from "@erp/payments";
import { deliveryManifest, DrizzleDeliveryRepository } from "@erp/delivery";
import { posManifest } from "@erp/pos";
import { reportingManifest } from "@erp/reporting";
import { coreManifest, DrizzleModuleRegistryRepository, installModule } from "@erp/core";
import { ModuleRegistry } from "@erp/module-registry";

const hasDatabases = Boolean(process.env.CONTROL_PLANE_DATABASE_URL && process.env.TENANT_DATABASE_ADMIN_URL);

function loginRequestFor(host: string, body: { email: string; password: string }): NextRequest {
  const headers = new Headers({ host, "x-tenant-host-hint": host, "content-type": "application/json" });
  return new NextRequest(`http://${host}/api/auth/login`, { method: "POST", body: JSON.stringify(body), headers });
}

function jsonRequestFor(host: string, path: string, sessionToken: string, body?: unknown): NextRequest {
  const headers = new Headers({ host, "x-tenant-host-hint": host, cookie: `erp_session=${sessionToken}` });
  if (body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(`http://${host}${path}`, {
    method: "POST",
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function extractSessionToken(response: Response): string {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = /erp_session=([^;]+)/.exec(setCookie);
  if (!match) throw new Error("No session cookie set on login response");
  return match[1]!;
}

describe.skipIf(!hasDatabases)("events flow (integration)", () => {
  const runId = Date.now();
  const slug = `events-flow-${runId}`;
  const host = `${slug}.platform.example.com`;
  const databaseName = `tenant_${slug.replace(/-/g, "_")}`;
  const ownerPassword = "owner-password1";
  let tenantId: string;

  beforeAll(async () => {
    const tenantRepo = new DrizzleTenantRepository();
    const tenant = await createTenant(tenantRepo, { slug, name: "Events Flow Test Tenant" });
    tenantId = tenant.id;
    await provisionTenantDatabase(tenant);

    const registry = new ModuleRegistry();
    registry.register(coreManifest);
    registry.register(tenantManifest);
    registry.register(identityManifest);
    registry.register(inventoryManifest);
    registry.register(paymentsManifest);
    registry.register(deliveryManifest);
    registry.register(posManifest);
    registry.register(reportingManifest);
    registry.validateGraph();

    const moduleRepository = new DrizzleModuleRegistryRepository();
    await installModule(registry, moduleRepository, tenant.id, "core", null);
    await installModule(registry, moduleRepository, tenant.id, "tenant", null);
    await installModule(registry, moduleRepository, tenant.id, "identity", null);
    await installModule(registry, moduleRepository, tenant.id, "inventory", null);
    await installModule(registry, moduleRepository, tenant.id, "payments", null);
    await installModule(registry, moduleRepository, tenant.id, "delivery", null);
    await installModule(registry, moduleRepository, tenant.id, "pos", null);
    await installModule(registry, moduleRepository, tenant.id, "reporting", null);

    const db = await getTenantDb(tenant.id);
    const { owner } = await seedDefaultRoles(new DrizzleRoleRepository(), db);
    const userRepository = new DrizzleUserRepository();
    await registerUser(userRepository, db, { email: "owner@events-flow.example", password: ownerPassword, name: "Owner", roleId: owner.id });
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

  it("a paid POS sale reaches delivery as a pending Delivery once the outbox is published", async () => {
    const token = await loginAs("owner@events-flow.example", ownerPassword);

    const { POST: receiveStock } = await import("../src/app/api/inventory/stock/receive/route");
    await receiveStock(jsonRequestFor(host, "/api/inventory/stock/receive", token, { sku: "SKU-EVT", quantity: 5 }));

    const { POST: createTerminal } = await import("../src/app/api/pos/terminals/route");
    const terminal = await (await createTerminal(jsonRequestFor(host, "/api/pos/terminals", token, { name: "Events Terminal" }))).json();

    const { POST: createCartRoute } = await import("../src/app/api/pos/carts/route");
    const cart = await (await createCartRoute(jsonRequestFor(host, "/api/pos/carts", token, { terminalId: terminal.id }))).json();

    const { POST: addLine } = await import("../src/app/api/pos/carts/[cartId]/lines/route");
    await addLine(
      jsonRequestFor(host, `/api/pos/carts/${cart.id}/lines`, token, { sku: "SKU-EVT", name: "Event Widget", quantity: 1, unitPriceCents: 1500 }),
      { params: Promise.resolve({ cartId: cart.id }) },
    );

    const { POST: checkoutRoute } = await import("../src/app/api/pos/carts/[cartId]/checkout/route");
    const checkoutResponse = await checkoutRoute(
      jsonRequestFor(host, `/api/pos/carts/${cart.id}/checkout`, token, { idempotencyKey: "POS-TERM-001-20260819-990001", paymentMethod: "cash" }),
      { params: Promise.resolve({ cartId: cart.id }) },
    );
    expect(checkoutResponse.status).toBe(201);
    const transaction = await checkoutResponse.json();

    // Before publishing, delivery has not reacted yet — the outbox write and the consumer's reaction are genuinely decoupled.
    const db = await getTenantDb(tenantId);
    const deliveryRepository = new DrizzleDeliveryRepository();
    const beforePublish = await deliveryRepository.list(db);
    expect(beforePublish.some((d) => d.orderReference === transaction.id)).toBe(false);

    const { POST: publish } = await import("../src/app/api/events/publish/route");
    const publishResponse = await publish(jsonRequestFor(host, "/api/events/publish", token));
    expect(publishResponse.status).toBe(200);
    const publishResult = await publishResponse.json();
    expect(publishResult.deliveries).toBeGreaterThanOrEqual(1);

    const afterPublish = await deliveryRepository.list(db);
    const created = afterPublish.find((d) => d.orderReference === transaction.id);
    expect(created).toBeDefined();
    expect(created?.status).toBe("pending");

    // Publishing again must not create a second Delivery for the same transaction (per-consumer dedup, CLAUDE.md §25).
    await publish(jsonRequestFor(host, "/api/events/publish", token));
    const afterSecondPublish = await deliveryRepository.list(db);
    const matches = afterSecondPublish.filter((d) => d.orderReference === transaction.id);
    expect(matches).toHaveLength(1);

    // Reporting's consumer reacted to the same event independently — the sale shows up in the sales summary too.
    const { GET: getSalesSummary } = await import("../src/app/api/reporting/sales-summary/route");
    const summaryResponse = await getSalesSummary(new NextRequest(`http://${host}/api/reporting/sales-summary`, {
      headers: new Headers({ host, "x-tenant-host-hint": host, cookie: `erp_session=${token}` }),
    }));
    expect(summaryResponse.status).toBe(200);
    const summary = await summaryResponse.json();
    const totalCents = (summary.items as { totalCents: number }[]).reduce((sum, row) => sum + row.totalCents, 0);
    expect(totalCents).toBeGreaterThanOrEqual(transaction.totalCents);
  });
});
