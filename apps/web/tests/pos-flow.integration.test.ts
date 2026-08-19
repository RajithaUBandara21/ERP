/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 *
 * Phase 8 exit proof: install pos as an opt-in module (not auto-installed),
 * then run the real HTTP route handlers through terminal → cart → checkout,
 * including the idempotent-retry guarantee and permission gating.
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
import { posManifest } from "@erp/pos";
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

describe.skipIf(!hasDatabases)("POS flow (integration)", () => {
  const runId = Date.now();
  const slug = `pos-flow-${runId}`;
  const host = `${slug}.platform.example.com`;
  const databaseName = `tenant_${slug.replace(/-/g, "_")}`;
  const ownerPassword = "owner-password1";
  const memberPassword = "member-password1";

  beforeAll(async () => {
    const tenantRepo = new DrizzleTenantRepository();
    const tenant = await createTenant(tenantRepo, { slug, name: "POS Flow Test Tenant" });
    await provisionTenantDatabase(tenant);

    // pos depends on core/tenant/identity (its manifest) — they must be
    // installed through the registry first, exactly like a real tenant
    // onboarding would (see apps/web/scripts/bootstrap-tenant.ts), not
    // just have their migrations applied directly.
    const registry = new ModuleRegistry();
    registry.register(coreManifest);
    registry.register(tenantManifest);
    registry.register(identityManifest);
    registry.register(posManifest);
    registry.validateGraph();
    const moduleRepository = new DrizzleModuleRegistryRepository();
    await installModule(registry, moduleRepository, tenant.id, "core", null);
    await installModule(registry, moduleRepository, tenant.id, "tenant", null);
    await installModule(registry, moduleRepository, tenant.id, "identity", null);

    const db = await getTenantDb(tenant.id);
    const { owner, member } = await seedDefaultRoles(new DrizzleRoleRepository(), db);
    const userRepository = new DrizzleUserRepository();
    await registerUser(userRepository, db, { email: "owner@pos-flow.example", password: ownerPassword, name: "Owner", roleId: owner.id });
    await registerUser(userRepository, db, { email: "member@pos-flow.example", password: memberPassword, name: "Member", roleId: member.id });
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

  it("member (no permissions) cannot install pos", async () => {
    const token = await loginAs("member@pos-flow.example", memberPassword);
    const { POST: install } = await import("../src/app/api/modules/[moduleId]/install/route");
    const response = await install(jsonRequestFor(host, "/api/modules/pos/install", token), {
      params: Promise.resolve({ moduleId: "pos" }),
    });
    expect(response.status).toBe(403);
  });

  it("owner installs pos, then runs a full terminal → cart → checkout flow via HTTP", async () => {
    const token = await loginAs("owner@pos-flow.example", ownerPassword);

    const { POST: install } = await import("../src/app/api/modules/[moduleId]/install/route");
    const installResponse = await install(jsonRequestFor(host, "/api/modules/pos/install", token), {
      params: Promise.resolve({ moduleId: "pos" }),
    });
    expect(installResponse.status).toBe(200);

    const { POST: createTerminal } = await import("../src/app/api/pos/terminals/route");
    const terminalResponse = await createTerminal(jsonRequestFor(host, "/api/pos/terminals", token, { name: "Front Counter" }));
    expect(terminalResponse.status).toBe(201);
    const terminal = await terminalResponse.json();

    const { POST: createCartRoute } = await import("../src/app/api/pos/carts/route");
    const cartResponse = await createCartRoute(jsonRequestFor(host, "/api/pos/carts", token, { terminalId: terminal.id }));
    expect(cartResponse.status).toBe(201);
    const cart = await cartResponse.json();

    const { POST: addLine } = await import("../src/app/api/pos/carts/[cartId]/lines/route");
    const lineResponse = await addLine(
      jsonRequestFor(host, `/api/pos/carts/${cart.id}/lines`, token, { sku: "SKU-1", name: "Widget", quantity: 2, unitPriceCents: 500 }),
      { params: Promise.resolve({ cartId: cart.id }) },
    );
    expect(lineResponse.status).toBe(200);

    const idempotencyKey = "POS-TERM-001-20260819-000001";
    const { POST: checkoutRoute } = await import("../src/app/api/pos/carts/[cartId]/checkout/route");
    const checkoutResponse = await checkoutRoute(
      jsonRequestFor(host, `/api/pos/carts/${cart.id}/checkout`, token, { idempotencyKey, paymentMethod: "cash" }),
      { params: Promise.resolve({ cartId: cart.id }) },
    );
    expect(checkoutResponse.status).toBe(201);
    const transaction = await checkoutResponse.json();
    expect(transaction.totalCents).toBe(1000);

    // CRITICAL: retrying checkout with the same idempotency key (e.g. a
    // network-retried request) returns the same transaction, never a duplicate.
    const retryResponse = await checkoutRoute(
      jsonRequestFor(host, `/api/pos/carts/${cart.id}/checkout`, token, { idempotencyKey, paymentMethod: "cash" }),
      { params: Promise.resolve({ cartId: cart.id }) },
    );
    expect(retryResponse.status).toBe(201);
    const retryTransaction = await retryResponse.json();
    expect(retryTransaction.id).toBe(transaction.id);
  });

  it("rejects checkout on an empty cart with 422", async () => {
    const token = await loginAs("owner@pos-flow.example", ownerPassword);

    const { POST: createTerminal } = await import("../src/app/api/pos/terminals/route");
    const terminalResponse = await createTerminal(jsonRequestFor(host, "/api/pos/terminals", token, { name: "Kiosk" }));
    const terminal = await terminalResponse.json();

    const { POST: createCartRoute } = await import("../src/app/api/pos/carts/route");
    const cartResponse = await createCartRoute(jsonRequestFor(host, "/api/pos/carts", token, { terminalId: terminal.id }));
    const cart = await cartResponse.json();

    const { POST: checkoutRoute } = await import("../src/app/api/pos/carts/[cartId]/checkout/route");
    const response = await checkoutRoute(
      jsonRequestFor(host, `/api/pos/carts/${cart.id}/checkout`, token, {
        idempotencyKey: "POS-TERM-001-20260819-000002",
        paymentMethod: "cash",
      }),
      { params: Promise.resolve({ cartId: cart.id }) },
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("CART_EMPTY");
  });
});
