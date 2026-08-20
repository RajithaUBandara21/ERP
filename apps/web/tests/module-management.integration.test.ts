/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 *
 * Phase 6 exit criterion: install/uninstall of "core" demonstrated end-to-end
 * (through the real HTTP route handlers, not mocked) with an audit trail,
 * plus the permission chain (owner can manage, member is denied).
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
import { createSubscription, DrizzlePlanRepository, DrizzleSubscriptionRepository, seedDefaultPlans } from "@erp/billing";

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

describe.skipIf(!hasDatabases)("module management (integration)", () => {
  const runId = Date.now();
  const slug = `modmgmt-${runId}`;
  const host = `${slug}.platform.example.com`;
  const databaseName = `tenant_${slug.replace(/-/g, "_")}`;
  const ownerPassword = "owner-password1";
  const memberPassword = "member-password1";

  beforeAll(async () => {
    const tenantRepo = new DrizzleTenantRepository();
    const tenant = await createTenant(tenantRepo, { slug, name: "Module Management Test Tenant" });
    await provisionTenantDatabase(tenant);
    await applyIdentityMigrations(tenant.id);

    // A real tenant always has a subscription by the time it reaches the
    // install HTTP route (see apps/web/scripts/bootstrap-tenant.ts) — the
    // route now entitlement-gates installation (Phase 15), so this test's
    // tenant needs one too, even though it only ever installs "core" (the
    // starter plan includes it, same as every plan — see
    // modules/billing/src/domain/plan.ts's doc comment).
    const planRepository = new DrizzlePlanRepository();
    const subscriptionRepository = new DrizzleSubscriptionRepository();
    await seedDefaultPlans(planRepository);
    await createSubscription({ planRepository, subscriptionRepository }, { tenantId: tenant.id, planCode: "starter" });

    const db = await getTenantDb(tenant.id);
    const { owner, member } = await seedDefaultRoles(new DrizzleRoleRepository(), db);
    const userRepository = new DrizzleUserRepository();
    await registerUser(userRepository, db, { email: "owner@modmgmt.example", password: ownerPassword, name: "Owner", roleId: owner.id });
    await registerUser(userRepository, db, { email: "member@modmgmt.example", password: memberPassword, name: "Member", roleId: member.id });
  });

  afterAll(async () => {
    const admin = postgres(process.env.TENANT_DATABASE_ADMIN_URL!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.end();
    await closeControlPlaneDb();
  });

  async function ownerToken(): Promise<string> {
    const { POST: login } = await import("../src/app/api/auth/login/route");
    const response = await login(loginRequestFor(host, { email: "owner@modmgmt.example", password: ownerPassword }));
    return extractSessionToken(response);
  }

  it("lists core as not_installed before installation", async () => {
    const token = await ownerToken();
    const { GET: listModules } = await import("../src/app/api/modules/route");
    const response = await listModules(requestFor(host, "/api/modules", token));
    const body = await response.json();

    expect(response.status).toBe(200);
    const core = body.modules.find((m: { id: string }) => m.id === "core");
    expect(core.status).toBe("not_installed");
  });

  it("member (no permissions) cannot install modules", async () => {
    const { POST: login } = await import("../src/app/api/auth/login/route");
    const loginResponse = await login(loginRequestFor(host, { email: "member@modmgmt.example", password: memberPassword }));
    const token = extractSessionToken(loginResponse);

    const { POST: install } = await import("../src/app/api/modules/[moduleId]/install/route");
    const response = await install(
      requestFor(host, "/api/modules/core/install", token, "POST"),
      { params: Promise.resolve({ moduleId: "core" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("PERMISSION_DENIED");
  });

  it("owner installs core end-to-end, then it shows active in the listing", async () => {
    const token = await ownerToken();
    const { POST: install } = await import("../src/app/api/modules/[moduleId]/install/route");
    const installResponse = await install(
      requestFor(host, "/api/modules/core/install", token, "POST"),
      { params: Promise.resolve({ moduleId: "core" }) },
    );
    expect(installResponse.status).toBe(200);

    const { GET: listModules } = await import("../src/app/api/modules/route");
    const listResponse = await listModules(requestFor(host, "/api/modules", token));
    const body = await listResponse.json();
    const core = body.modules.find((m: { id: string }) => m.id === "core");
    expect(core.status).toBe("active");
  });

  it("rejects installing an already-active module", async () => {
    const token = await ownerToken();
    const { POST: install } = await import("../src/app/api/modules/[moduleId]/install/route");
    const response = await install(
      requestFor(host, "/api/modules/core/install", token, "POST"),
      { params: Promise.resolve({ moduleId: "core" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("MODULE_ALREADY_INSTALLED");
  });

  it("rejects installing an unknown module id", async () => {
    const token = await ownerToken();
    const { POST: install } = await import("../src/app/api/modules/[moduleId]/install/route");
    const response = await install(
      requestFor(host, "/api/modules/nonexistent-module/install", token, "POST"),
      { params: Promise.resolve({ moduleId: "nonexistent-module" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("MODULE_NOT_FOUND");
  });

  it("owner uninstalls core end-to-end, then it shows disabled (not deleted) in the listing", async () => {
    const token = await ownerToken();
    const { POST: uninstall } = await import("../src/app/api/modules/[moduleId]/uninstall/route");
    const uninstallResponse = await uninstall(
      requestFor(host, "/api/modules/core/uninstall", token, "POST"),
      { params: Promise.resolve({ moduleId: "core" }) },
    );
    expect(uninstallResponse.status).toBe(200);

    const { GET: listModules } = await import("../src/app/api/modules/route");
    const listResponse = await listModules(requestFor(host, "/api/modules", token));
    const body = await listResponse.json();
    const core = body.modules.find((m: { id: string }) => m.id === "core");
    expect(core.status).toBe("disabled");
  });
});
