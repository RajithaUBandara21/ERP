/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 *
 * Phase 9 exit proof: warehouse creation, stock receipt, adjustment, and
 * level queries through the real HTTP route handlers, plus permission
 * gating (owner can manage stock, member is denied).
 */
import postgres from "postgres";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb, getTenantDb } from "@erp/database";
import { createTenant, DrizzleTenantRepository, provisionTenantDatabase } from "@erp/tenant";
import { applyIdentityMigrations, DrizzleRoleRepository, DrizzleUserRepository, registerUser, seedDefaultRoles } from "@erp/identity";
import { applyInventoryMigrations } from "@erp/inventory";

const hasDatabases = Boolean(process.env.CONTROL_PLANE_DATABASE_URL && process.env.TENANT_DATABASE_ADMIN_URL);

function loginRequestFor(host: string, body: { email: string; password: string }): NextRequest {
  const headers = new Headers({ host, "x-tenant-host-hint": host, "content-type": "application/json" });
  return new NextRequest(`http://${host}/api/auth/login`, { method: "POST", body: JSON.stringify(body), headers });
}

function jsonRequestFor(host: string, path: string, sessionToken: string, method: string, body?: unknown): NextRequest {
  const headers = new Headers({ host, "x-tenant-host-hint": host, cookie: `erp_session=${sessionToken}` });
  if (body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(`http://${host}${path}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}

function extractSessionToken(response: Response): string {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = /erp_session=([^;]+)/.exec(setCookie);
  if (!match) throw new Error("No session cookie set on login response");
  return match[1]!;
}

describe.skipIf(!hasDatabases)("inventory flow (integration)", () => {
  const runId = Date.now();
  const slug = `inv-flow-${runId}`;
  const host = `${slug}.platform.example.com`;
  const databaseName = `tenant_${slug.replace(/-/g, "_")}`;
  const ownerPassword = "owner-password1";
  const memberPassword = "member-password1";

  beforeAll(async () => {
    const tenantRepo = new DrizzleTenantRepository();
    const tenant = await createTenant(tenantRepo, { slug, name: "Inventory Flow Test Tenant" });
    await provisionTenantDatabase(tenant);
    await applyIdentityMigrations(tenant.id);
    await applyInventoryMigrations(tenant.id);

    const db = await getTenantDb(tenant.id);
    const { owner, member } = await seedDefaultRoles(new DrizzleRoleRepository(), db);
    const userRepository = new DrizzleUserRepository();
    await registerUser(userRepository, db, { email: "owner@inv-flow.example", password: ownerPassword, name: "Owner", roleId: owner.id });
    await registerUser(userRepository, db, { email: "member@inv-flow.example", password: memberPassword, name: "Member", roleId: member.id });
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

  it("member cannot receive stock", async () => {
    const token = await loginAs("member@inv-flow.example", memberPassword);
    const { POST: receive } = await import("../src/app/api/inventory/stock/receive/route");
    const response = await receive(jsonRequestFor(host, "/api/inventory/stock/receive", token, "POST", { sku: "SKU-1", quantity: 10 }));
    expect(response.status).toBe(403);
  });

  it("owner receives stock, reads the level, then adjusts it downward", async () => {
    const token = await loginAs("owner@inv-flow.example", ownerPassword);

    const { POST: receive } = await import("../src/app/api/inventory/stock/receive/route");
    const receiveResponse = await receive(jsonRequestFor(host, "/api/inventory/stock/receive", token, "POST", { sku: "SKU-1", quantity: 10 }));
    expect(receiveResponse.status).toBe(201);
    const received = await receiveResponse.json();
    expect(received).toMatchObject({ onHand: 10, reserved: 0, available: 10 });

    const { GET: getStock } = await import("../src/app/api/inventory/stock/route");
    const stockResponse = await getStock(new NextRequest(`http://${host}/api/inventory/stock?sku=SKU-1`, {
      headers: new Headers({ host, "x-tenant-host-hint": host, cookie: `erp_session=${token}` }),
    }));
    expect(stockResponse.status).toBe(200);
    const level = await stockResponse.json();
    expect(level).toMatchObject({ onHand: 10, reserved: 0, available: 10 });

    const { POST: adjust } = await import("../src/app/api/inventory/stock/adjust/route");
    const adjustResponse = await adjust(jsonRequestFor(host, "/api/inventory/stock/adjust", token, "POST", { sku: "SKU-1", delta: -3 }));
    expect(adjustResponse.status).toBe(200);
    const adjusted = await adjustResponse.json();
    expect(adjusted).toMatchObject({ onHand: 7, reserved: 0, available: 7 });
  });

  it("rejects an adjustment that would drive stock negative with 422", async () => {
    const token = await loginAs("owner@inv-flow.example", ownerPassword);
    const { POST: adjust } = await import("../src/app/api/inventory/stock/adjust/route");
    const response = await adjust(jsonRequestFor(host, "/api/inventory/stock/adjust", token, "POST", { sku: "SKU-NEVER-RECEIVED", delta: -1 }));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("INVENTORY_INSUFFICIENT_STOCK");
  });

  it("creates a named warehouse and lists it", async () => {
    const token = await loginAs("owner@inv-flow.example", ownerPassword);

    const { POST: createWarehouse } = await import("../src/app/api/inventory/warehouses/route");
    const createResponse = await createWarehouse(jsonRequestFor(host, "/api/inventory/warehouses", token, "POST", { name: "Overflow Storage" }));
    expect(createResponse.status).toBe(201);

    const { GET: listWarehouses } = await import("../src/app/api/inventory/warehouses/route");
    const listResponse = await listWarehouses(new NextRequest(`http://${host}/api/inventory/warehouses`, {
      headers: new Headers({ host, "x-tenant-host-hint": host, cookie: `erp_session=${token}` }),
    }));
    const { warehouses } = await listResponse.json();
    expect(warehouses.map((w: { name: string }) => w.name)).toContain("Overflow Storage");
  });
});
