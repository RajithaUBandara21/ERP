/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 *
 * Phase 11 exit proof: driver registration, delivery creation, assign ->
 * complete, and the fail -> reassign retry path, through the real HTTP
 * route handlers, plus permission gating.
 */
import postgres from "postgres";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb, getTenantDb } from "@erp/database";
import { createTenant, DrizzleTenantRepository, provisionTenantDatabase } from "@erp/tenant";
import { applyIdentityMigrations, DrizzleRoleRepository, DrizzleUserRepository, registerUser, seedDefaultRoles } from "@erp/identity";
import { applyDeliveryMigrations } from "@erp/delivery";

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

describe.skipIf(!hasDatabases)("delivery flow (integration)", () => {
  const runId = Date.now();
  const slug = `delivery-flow-${runId}`;
  const host = `${slug}.platform.example.com`;
  const databaseName = `tenant_${slug.replace(/-/g, "_")}`;
  const ownerPassword = "owner-password1";
  const memberPassword = "member-password1";

  beforeAll(async () => {
    const tenantRepo = new DrizzleTenantRepository();
    const tenant = await createTenant(tenantRepo, { slug, name: "Delivery Flow Test Tenant" });
    await provisionTenantDatabase(tenant);
    await applyIdentityMigrations(tenant.id);
    await applyDeliveryMigrations(tenant.id);

    const db = await getTenantDb(tenant.id);
    const { owner, member } = await seedDefaultRoles(new DrizzleRoleRepository(), db);
    const userRepository = new DrizzleUserRepository();
    await registerUser(userRepository, db, { email: "owner@delivery-flow.example", password: ownerPassword, name: "Owner", roleId: owner.id });
    await registerUser(userRepository, db, { email: "member@delivery-flow.example", password: memberPassword, name: "Member", roleId: member.id });
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

  it("member cannot register a driver", async () => {
    const token = await loginAs("member@delivery-flow.example", memberPassword);
    const { POST: registerDriverRoute } = await import("../src/app/api/delivery/drivers/route");
    const response = await registerDriverRoute(jsonRequestFor(host, "/api/delivery/drivers", token, "POST", { name: "Alex" }));
    expect(response.status).toBe(403);
  });

  it("owner runs the full driver -> delivery -> assign -> complete flow via HTTP", async () => {
    const token = await loginAs("owner@delivery-flow.example", ownerPassword);

    const { POST: registerDriverRoute } = await import("../src/app/api/delivery/drivers/route");
    const driverResponse = await registerDriverRoute(jsonRequestFor(host, "/api/delivery/drivers", token, "POST", { name: "Alex" }));
    expect(driverResponse.status).toBe(201);
    const driver = await driverResponse.json();

    const { POST: createDeliveryRoute } = await import("../src/app/api/delivery/deliveries/route");
    const deliveryResponse = await createDeliveryRoute(
      jsonRequestFor(host, "/api/delivery/deliveries", token, "POST", { orderReference: "pos-transaction-999" }),
    );
    expect(deliveryResponse.status).toBe(201);
    const delivery = await deliveryResponse.json();
    expect(delivery.status).toBe("pending");

    const { POST: assignRoute } = await import("../src/app/api/delivery/deliveries/[deliveryId]/assign/route");
    const assignResponse = await assignRoute(
      jsonRequestFor(host, `/api/delivery/deliveries/${delivery.id}/assign`, token, "POST", { driverId: driver.id }),
      { params: Promise.resolve({ deliveryId: delivery.id }) },
    );
    expect(assignResponse.status).toBe(200);
    expect((await assignResponse.json()).status).toBe("assigned");

    const { POST: completeRoute } = await import("../src/app/api/delivery/deliveries/[deliveryId]/complete/route");
    const completeResponse = await completeRoute(
      jsonRequestFor(host, `/api/delivery/deliveries/${delivery.id}/complete`, token, "POST"),
      { params: Promise.resolve({ deliveryId: delivery.id }) },
    );
    expect(completeResponse.status).toBe(200);
    expect((await completeResponse.json()).status).toBe("completed");

    // Terminal — no further assignment allowed.
    const rejectedAssign = await assignRoute(
      jsonRequestFor(host, `/api/delivery/deliveries/${delivery.id}/assign`, token, "POST", { driverId: driver.id }),
      { params: Promise.resolve({ deliveryId: delivery.id }) },
    );
    expect(rejectedAssign.status).toBe(409);
    expect((await rejectedAssign.json()).code).toBe("DELIVERY_NOT_ASSIGNABLE");
  });

  it("supports a fail -> reassign retry via HTTP", async () => {
    const token = await loginAs("owner@delivery-flow.example", ownerPassword);

    const { POST: registerDriverRoute } = await import("../src/app/api/delivery/drivers/route");
    const driver = await (await registerDriverRoute(jsonRequestFor(host, "/api/delivery/drivers", token, "POST", { name: "Sam" }))).json();

    const { POST: createDeliveryRoute } = await import("../src/app/api/delivery/deliveries/route");
    const delivery = await (
      await createDeliveryRoute(jsonRequestFor(host, "/api/delivery/deliveries", token, "POST", { orderReference: "pos-transaction-1000" }))
    ).json();

    const { POST: assignRoute } = await import("../src/app/api/delivery/deliveries/[deliveryId]/assign/route");
    await assignRoute(jsonRequestFor(host, `/api/delivery/deliveries/${delivery.id}/assign`, token, "POST", { driverId: driver.id }), {
      params: Promise.resolve({ deliveryId: delivery.id }),
    });

    const { POST: failRoute } = await import("../src/app/api/delivery/deliveries/[deliveryId]/fail/route");
    const failResponse = await failRoute(jsonRequestFor(host, `/api/delivery/deliveries/${delivery.id}/fail`, token, "POST"), {
      params: Promise.resolve({ deliveryId: delivery.id }),
    });
    expect((await failResponse.json()).status).toBe("failed");

    const retryResponse = await assignRoute(
      jsonRequestFor(host, `/api/delivery/deliveries/${delivery.id}/assign`, token, "POST", { driverId: driver.id }),
      { params: Promise.resolve({ deliveryId: delivery.id }) },
    );
    expect(retryResponse.status).toBe(200);
    expect((await retryResponse.json()).status).toBe("assigned");
  });

  it("returns 404 assigning an unknown driver", async () => {
    const token = await loginAs("owner@delivery-flow.example", ownerPassword);
    const { POST: createDeliveryRoute } = await import("../src/app/api/delivery/deliveries/route");
    const delivery = await (
      await createDeliveryRoute(jsonRequestFor(host, "/api/delivery/deliveries", token, "POST", { orderReference: "pos-transaction-1001" }))
    ).json();

    const { POST: assignRoute } = await import("../src/app/api/delivery/deliveries/[deliveryId]/assign/route");
    const response = await assignRoute(
      jsonRequestFor(host, `/api/delivery/deliveries/${delivery.id}/assign`, token, "POST", { driverId: "00000000-0000-0000-0000-000000000000" }),
      { params: Promise.resolve({ deliveryId: delivery.id }) },
    );
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("DRIVER_NOT_FOUND");
  });
});
