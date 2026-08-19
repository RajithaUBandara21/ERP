/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 *
 * Phase 5 exit criterion: a sample protected endpoint (GET /api/identity/users)
 * demonstrates the full session → tenant → role → permission chain, with
 * denial tests for both "no session" and "wrong role."
 */
import postgres from "postgres";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb, getTenantDb } from "@erp/database";
import { createTenant, DrizzleTenantRepository, provisionTenantDatabase } from "@erp/tenant";
import {
  applyIdentityMigrations,
  DrizzleRoleRepository,
  DrizzleUserRepository,
  registerUser,
  seedDefaultRoles,
} from "@erp/identity";

const hasDatabases = Boolean(process.env.CONTROL_PLANE_DATABASE_URL && process.env.TENANT_DATABASE_ADMIN_URL);

function loginRequestFor(host: string, body: { email: string; password: string }): NextRequest {
  const headers = new Headers({ host, "x-tenant-host-hint": host, "content-type": "application/json" });
  return new NextRequest(`http://${host}/api/auth/login`, { method: "POST", body: JSON.stringify(body), headers });
}

function usersRequestFor(host: string, sessionToken?: string): NextRequest {
  const headers = new Headers({ host, "x-tenant-host-hint": host });
  if (sessionToken) headers.set("cookie", `erp_session=${sessionToken}`);
  return new NextRequest(`http://${host}/api/identity/users`, { headers });
}

function extractSessionToken(response: Response): string {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = /erp_session=([^;]+)/.exec(setCookie);
  if (!match) throw new Error("No session cookie set on login response");
  return match[1]!;
}

describe.skipIf(!hasDatabases)("permission flow (integration)", () => {
  const runId = Date.now();
  const slug = `perm-${runId}`;
  const host = `${slug}.platform.example.com`;
  const databaseName = `tenant_${slug.replace(/-/g, "_")}`;
  const ownerPassword = "owner-password1";
  const memberPassword = "member-password1";

  beforeAll(async () => {
    const tenantRepo = new DrizzleTenantRepository();
    const tenant = await createTenant(tenantRepo, { slug, name: "Permission Test Tenant" });
    await provisionTenantDatabase(tenant);
    await applyIdentityMigrations(tenant.id);

    const db = await getTenantDb(tenant.id);
    const { owner, member } = await seedDefaultRoles(new DrizzleRoleRepository(), db);
    const userRepository = new DrizzleUserRepository();
    await registerUser(userRepository, db, {
      email: "owner@perm-test.example",
      password: ownerPassword,
      name: "Owner",
      roleId: owner.id,
    });
    await registerUser(userRepository, db, {
      email: "member@perm-test.example",
      password: memberPassword,
      name: "Member",
      roleId: member.id,
    });
  });

  afterAll(async () => {
    const admin = postgres(process.env.TENANT_DATABASE_ADMIN_URL!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.end();
    await closeControlPlaneDb();
  });

  it("owner (wildcard permission) can list users", async () => {
    const { POST: login } = await import("../src/app/api/auth/login/route");
    const loginResponse = await login(loginRequestFor(host, { email: "owner@perm-test.example", password: ownerPassword }));
    const token = extractSessionToken(loginResponse);

    const { GET: listUsers } = await import("../src/app/api/identity/users/route");
    const response = await listUsers(usersRequestFor(host, token));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.users).toHaveLength(2);
  });

  it("member (no permissions) is denied with 403 PERMISSION_DENIED", async () => {
    const { POST: login } = await import("../src/app/api/auth/login/route");
    const loginResponse = await login(loginRequestFor(host, { email: "member@perm-test.example", password: memberPassword }));
    const token = extractSessionToken(loginResponse);

    const { GET: listUsers } = await import("../src/app/api/identity/users/route");
    const response = await listUsers(usersRequestFor(host, token));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("PERMISSION_DENIED");
  });

  it("an unauthenticated request is denied with 401, before any permission check runs", async () => {
    const { GET: listUsers } = await import("../src/app/api/identity/users/route");
    const response = await listUsers(usersRequestFor(host));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
  });
});
