/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 *
 * Phase 14 exit proof: GET /api/reporting/sales-summary through the real
 * HTTP route handler — permission gating (owner can read, member is
 * denied) and cursor pagination against real rows, independent of any
 * particular event producer (unlike events-flow.integration.test.ts, which
 * proves the OrderPaid → sales-summary wiring end to end).
 */
import postgres from "postgres";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb, getTenantDb } from "@erp/database";
import { createTenant, DrizzleTenantRepository, provisionTenantDatabase } from "@erp/tenant";
import { applyIdentityMigrations, DrizzleRoleRepository, DrizzleUserRepository, registerUser, seedDefaultRoles } from "@erp/identity";
import { applyReportingMigrations, DrizzleSalesSummaryRepository } from "@erp/reporting";

const hasDatabases = Boolean(process.env.CONTROL_PLANE_DATABASE_URL && process.env.TENANT_DATABASE_ADMIN_URL);

function loginRequestFor(host: string, body: { email: string; password: string }): NextRequest {
  const headers = new Headers({ host, "x-tenant-host-hint": host, "content-type": "application/json" });
  return new NextRequest(`http://${host}/api/auth/login`, { method: "POST", body: JSON.stringify(body), headers });
}

function extractSessionToken(response: Response): string {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = /erp_session=([^;]+)/.exec(setCookie);
  if (!match) throw new Error("No session cookie set on login response");
  return match[1]!;
}

function summaryRequestFor(host: string, sessionToken: string, query = ""): NextRequest {
  const headers = new Headers({ host, "x-tenant-host-hint": host, cookie: `erp_session=${sessionToken}` });
  return new NextRequest(`http://${host}/api/reporting/sales-summary${query}`, { headers });
}

describe.skipIf(!hasDatabases)("reporting flow (integration)", () => {
  const runId = Date.now();
  const slug = `report-flow-${runId}`;
  const host = `${slug}.platform.example.com`;
  const databaseName = `tenant_${slug.replace(/-/g, "_")}`;
  const ownerPassword = "owner-password1";
  const memberPassword = "member-password1";

  beforeAll(async () => {
    const tenantRepo = new DrizzleTenantRepository();
    const tenant = await createTenant(tenantRepo, { slug, name: "Reporting Flow Test Tenant" });
    await provisionTenantDatabase(tenant);
    await applyIdentityMigrations(tenant.id);
    await applyReportingMigrations(tenant.id);

    const db = await getTenantDb(tenant.id);
    const { owner, member } = await seedDefaultRoles(new DrizzleRoleRepository(), db);
    const userRepository = new DrizzleUserRepository();
    await registerUser(userRepository, db, { email: "owner@report-flow.example", password: ownerPassword, name: "Owner", roleId: owner.id });
    await registerUser(userRepository, db, { email: "member@report-flow.example", password: memberPassword, name: "Member", roleId: member.id });

    const summaryRepository = new DrizzleSalesSummaryRepository();
    for (const date of ["2026-08-17", "2026-08-18", "2026-08-19"]) {
      await summaryRepository.incrementForDate(db, date, 1, 1000);
    }
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

  it("member cannot read the sales summary", async () => {
    const token = await loginAs("member@report-flow.example", memberPassword);
    const { GET: getSalesSummary } = await import("../src/app/api/reporting/sales-summary/route");
    const response = await getSalesSummary(summaryRequestFor(host, token));
    expect(response.status).toBe(403);
  });

  it("owner reads the sales summary newest-date-first with cursor pagination", async () => {
    const token = await loginAs("owner@report-flow.example", ownerPassword);
    const { GET: getSalesSummary } = await import("../src/app/api/reporting/sales-summary/route");

    const firstResponse = await getSalesSummary(summaryRequestFor(host, token, "?limit=2"));
    expect(firstResponse.status).toBe(200);
    const firstPage = await firstResponse.json();
    expect(firstPage.items.map((row: { date: string }) => row.date)).toEqual(["2026-08-19", "2026-08-18"]);
    expect(firstPage.nextCursor).toBe("2026-08-18");

    const secondResponse = await getSalesSummary(summaryRequestFor(host, token, `?limit=2&cursor=${firstPage.nextCursor}`));
    expect(secondResponse.status).toBe(200);
    const secondPage = await secondResponse.json();
    expect(secondPage.items.map((row: { date: string }) => row.date)).toEqual(["2026-08-17"]);
    expect(secondPage.nextCursor).toBeUndefined();
  });

  it("rejects a limit outside the schema's bounds with 400", async () => {
    const token = await loginAs("owner@report-flow.example", ownerPassword);
    const { GET: getSalesSummary } = await import("../src/app/api/reporting/sales-summary/route");
    const response = await getSalesSummary(summaryRequestFor(host, token, "?limit=0"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("INVALID_REQUEST");
  });
});
