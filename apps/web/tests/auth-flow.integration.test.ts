/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 *
 * Exercises the real Route Handlers (not mocked) against real tenant
 * databases — this is the Phase 4 exit criterion: e2e login against a
 * seeded demo tenant, and proof that a session cannot cross tenants.
 */
import postgres from "postgres";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb, getTenantDb } from "@erp/database";
import { createTenant, DrizzleTenantRepository, provisionTenantDatabase } from "@erp/tenant";
import { applyIdentityMigrations, DrizzleRoleRepository, seedDefaultRoles } from "@erp/identity";

const hasDatabases = Boolean(process.env.CONTROL_PLANE_DATABASE_URL && process.env.TENANT_DATABASE_ADMIN_URL);

function requestFor(host: string, init: { method: string; body: string }): NextRequest {
  const headers = new Headers({
    host,
    "x-tenant-host-hint": host,
    "content-type": "application/json",
  });
  return new NextRequest(`http://${host}/api/auth/login`, { method: init.method, body: init.body, headers });
}

describe.skipIf(!hasDatabases)("auth flow (integration)", () => {
  const runId = Date.now();
  const slugA = `auth-a-${runId}`;
  const slugB = `auth-b-${runId}`;
  const hostA = `${slugA}.platform.example.com`;
  const hostB = `${slugB}.platform.example.com`;
  const dbNameA = `tenant_${slugA.replace(/-/g, "_")}`;
  const dbNameB = `tenant_${slugB.replace(/-/g, "_")}`;
  const tenantRepo = new DrizzleTenantRepository();
  const email = "owner@example.com";
  const password = "supersecret1";
  let ownerRoleId: string;

  beforeAll(async () => {
    const tenantA = await createTenant(tenantRepo, { slug: slugA, name: "Auth Test Tenant A" });
    const tenantB = await createTenant(tenantRepo, { slug: slugB, name: "Auth Test Tenant B" });
    await provisionTenantDatabase(tenantA);
    await provisionTenantDatabase(tenantB);
    await applyIdentityMigrations(tenantA.id);
    await applyIdentityMigrations(tenantB.id);

    const dbA = await getTenantDb(tenantA.id);
    const { owner } = await seedDefaultRoles(new DrizzleRoleRepository(), dbA);
    ownerRoleId = owner.id;
  });

  afterAll(async () => {
    const admin = postgres(process.env.TENANT_DATABASE_ADMIN_URL!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS "${dbNameA}" WITH (FORCE)`);
    await admin.unsafe(`DROP DATABASE IF EXISTS "${dbNameB}" WITH (FORCE)`);
    await admin.end();
    await closeControlPlaneDb();
  });

  it("registers via bootstrap and logs in successfully against the correct tenant", async () => {
    const { registerUser, DrizzleUserRepository } = await import("@erp/identity");
    const { getTenantDb } = await import("@erp/database");
    const tenantA = await tenantRepo.findBySlug(slugA);
    const dbA = await getTenantDb(tenantA!.id);
    await registerUser(new DrizzleUserRepository(), dbA, { email, password, name: "Owner", roleId: ownerRoleId });

    const { POST: login } = await import("../src/app/api/auth/login/route");
    const response = await login(
      requestFor(hostA, { method: "POST", body: JSON.stringify({ email, password }) }),
    );

    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toMatch(/erp_session=/);
  });

  it("rejects login with the wrong password without leaking account existence", async () => {
    const { POST: login } = await import("../src/app/api/auth/login/route");
    const response = await login(
      requestFor(hostA, { method: "POST", body: JSON.stringify({ email, password: "wrong-password" }) }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("INVALID_CREDENTIALS");
  });

  it("/api/auth/me returns the authenticated user for a valid session on its own tenant", async () => {
    const { POST: login } = await import("../src/app/api/auth/login/route");
    const loginResponse = await login(
      requestFor(hostA, { method: "POST", body: JSON.stringify({ email, password }) }),
    );
    const token = extractSessionToken(loginResponse);

    const { GET: me } = await import("../src/app/api/auth/me/route");
    const meResponse = await me(meRequestFor(hostA, token));
    const body = await meResponse.json();

    expect(meResponse.status).toBe(200);
    expect(body.tenant.slug).toBe(slugA);
    expect(body.user.email).toBe(email);
  });

  it("CRITICAL: a session issued for tenant A is rejected when presented against tenant B's host", async () => {
    const { POST: login } = await import("../src/app/api/auth/login/route");
    const loginResponse = await login(
      requestFor(hostA, { method: "POST", body: JSON.stringify({ email, password }) }),
    );
    const token = extractSessionToken(loginResponse);

    const { GET: me } = await import("../src/app/api/auth/me/route");
    const crossTenantResponse = await me(meRequestFor(hostB, token));
    const body = await crossTenantResponse.json();

    expect(crossTenantResponse.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
  });

  it("logout revokes the session — it can no longer be used", async () => {
    const { POST: login } = await import("../src/app/api/auth/login/route");
    const loginResponse = await login(
      requestFor(hostA, { method: "POST", body: JSON.stringify({ email, password }) }),
    );
    const token = extractSessionToken(loginResponse);

    const { POST: logout } = await import("../src/app/api/auth/logout/route");
    const logoutRequest = meRequestFor(hostA, token);
    await logout(logoutRequest);

    const { GET: me } = await import("../src/app/api/auth/me/route");
    const meResponse = await me(meRequestFor(hostA, token));
    expect(meResponse.status).toBe(401);
  });
});

function extractSessionToken(response: Response): string {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = /erp_session=([^;]+)/.exec(setCookie);
  if (!match) throw new Error("No session cookie set on login response");
  return match[1]!;
}

function meRequestFor(host: string, sessionToken: string): NextRequest {
  const headers = new Headers({
    host,
    "x-tenant-host-hint": host,
    cookie: `erp_session=${sessionToken}`,
  });
  return new NextRequest(`http://${host}/api/auth/me`, { headers });
}
