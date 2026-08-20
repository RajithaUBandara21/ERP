/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 *
 * Phase 10 exit proof: refund of a captured payment through the real HTTP
 * route, plus permission gating. Capture itself is only ever reachable
 * through POS checkout (see pos-flow.integration.test.ts) — payments has
 * no standalone "capture" route, so this seeds a captured attempt directly
 * through the application layer before exercising the refund route.
 */
import postgres from "postgres";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb, getTenantDb } from "@erp/database";
import { createTenant, DrizzleTenantRepository, provisionTenantDatabase } from "@erp/tenant";
import { applyIdentityMigrations, DrizzleRoleRepository, DrizzleUserRepository, registerUser, seedDefaultRoles } from "@erp/identity";
import { applyPaymentsMigrations, capturePayment, CashProvider, DrizzlePaymentAttemptRepository } from "@erp/payments";

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

describe.skipIf(!hasDatabases)("payments flow (integration)", () => {
  const runId = Date.now();
  const slug = `pay-flow-${runId}`;
  const host = `${slug}.platform.example.com`;
  const databaseName = `tenant_${slug.replace(/-/g, "_")}`;
  const ownerPassword = "owner-password1";
  const memberPassword = "member-password1";
  let tenantId: string;

  beforeAll(async () => {
    const tenantRepo = new DrizzleTenantRepository();
    const tenant = await createTenant(tenantRepo, { slug, name: "Payments Flow Test Tenant" });
    tenantId = tenant.id;
    await provisionTenantDatabase(tenant);
    await applyIdentityMigrations(tenant.id);
    await applyPaymentsMigrations(tenant.id);

    const db = await getTenantDb(tenant.id);
    const { owner, member } = await seedDefaultRoles(new DrizzleRoleRepository(), db);
    const userRepository = new DrizzleUserRepository();
    await registerUser(userRepository, db, { email: "owner@pay-flow.example", password: ownerPassword, name: "Owner", roleId: owner.id });
    await registerUser(userRepository, db, { email: "member@pay-flow.example", password: memberPassword, name: "Member", roleId: member.id });
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

  it("member cannot refund", async () => {
    const db = await getTenantDb(tenantId);
    const paymentAttemptRepository = new DrizzlePaymentAttemptRepository();
    const attempt = await capturePayment(
      { paymentAttemptRepository, providers: { cash: new CashProvider() } },
      db,
      { reference: "seed-1", method: "cash", amountCents: 500, idempotencyKey: "POS-TERM-001-20260819-800001" },
    );

    const token = await loginAs("member@pay-flow.example", memberPassword);
    const { POST: refund } = await import("../src/app/api/payments/attempts/[attemptId]/refund/route");
    const response = await refund(jsonRequestFor(host, `/api/payments/attempts/${attempt.id}/refund`, token, "POST", { amountCents: 500 }), {
      params: Promise.resolve({ attemptId: attempt.id }),
    });
    expect(response.status).toBe(403);
  });

  it("owner fully refunds a captured payment, then a second refund attempt is rejected", async () => {
    const db = await getTenantDb(tenantId);
    const paymentAttemptRepository = new DrizzlePaymentAttemptRepository();
    const attempt = await capturePayment(
      { paymentAttemptRepository, providers: { cash: new CashProvider() } },
      db,
      { reference: "seed-2", method: "cash", amountCents: 1200, idempotencyKey: "POS-TERM-001-20260819-800002" },
    );

    const token = await loginAs("owner@pay-flow.example", ownerPassword);
    const { GET: getAttempt } = await import("../src/app/api/payments/attempts/[attemptId]/route");
    const beforeResponse = await getAttempt(
      new NextRequest(`http://${host}/api/payments/attempts/${attempt.id}`, {
        headers: new Headers({ host, "x-tenant-host-hint": host, cookie: `erp_session=${token}` }),
      }),
      { params: Promise.resolve({ attemptId: attempt.id }) },
    );
    expect((await beforeResponse.json()).status).toBe("succeeded");

    const { POST: refund } = await import("../src/app/api/payments/attempts/[attemptId]/refund/route");
    const refundResponse = await refund(
      jsonRequestFor(host, `/api/payments/attempts/${attempt.id}/refund`, token, "POST", { amountCents: 1200, reason: "customer request" }),
      { params: Promise.resolve({ attemptId: attempt.id }) },
    );
    expect(refundResponse.status).toBe(200);
    const body = await refundResponse.json();
    expect(body.paymentAttempt.status).toBe("refunded");
    expect(body.refund.amountCents).toBe(1200);

    // Nothing left to refund — a fully-refunded attempt is no longer
    // refundable at all (409), not a 422 "amount exceeds remaining"
    // (that 422 is for a partially-refunded attempt with some, but not
    // enough, remaining — see refund-payment.ts's status check order).
    const secondRefund = await refund(
      jsonRequestFor(host, `/api/payments/attempts/${attempt.id}/refund`, token, "POST", { amountCents: 1 }),
      { params: Promise.resolve({ attemptId: attempt.id }) },
    );
    expect(secondRefund.status).toBe(409);
    const secondBody = await secondRefund.json();
    expect(secondBody.code).toBe("PAYMENT_NOT_REFUNDABLE");
  });

  it("rejects a partial refund that exceeds the remaining refundable amount with 422", async () => {
    const db = await getTenantDb(tenantId);
    const paymentAttemptRepository = new DrizzlePaymentAttemptRepository();
    const attempt = await capturePayment(
      { paymentAttemptRepository, providers: { cash: new CashProvider() } },
      db,
      { reference: "seed-3", method: "cash", amountCents: 1000, idempotencyKey: "POS-TERM-001-20260819-800003" },
    );

    const token = await loginAs("owner@pay-flow.example", ownerPassword);
    const { POST: refund } = await import("../src/app/api/payments/attempts/[attemptId]/refund/route");

    // Refund 700 of 1000, leaving 300 remaining.
    const partial = await refund(
      jsonRequestFor(host, `/api/payments/attempts/${attempt.id}/refund`, token, "POST", { amountCents: 700 }),
      { params: Promise.resolve({ attemptId: attempt.id }) },
    );
    expect(partial.status).toBe(200);
    expect((await partial.json()).paymentAttempt.status).toBe("partially_refunded");

    // Asking for 400 more than the 300 remaining must be rejected, not clamped.
    const overRefund = await refund(
      jsonRequestFor(host, `/api/payments/attempts/${attempt.id}/refund`, token, "POST", { amountCents: 400 }),
      { params: Promise.resolve({ attemptId: attempt.id }) },
    );
    expect(overRefund.status).toBe(422);
    expect((await overRefund.json()).code).toBe("REFUND_EXCEEDS_CAPTURED_AMOUNT");
  });

  it("returns 404 for an unknown payment attempt id", async () => {
    const token = await loginAs("owner@pay-flow.example", ownerPassword);
    const { GET: getAttempt } = await import("../src/app/api/payments/attempts/[attemptId]/route");
    const response = await getAttempt(
      new NextRequest(`http://${host}/api/payments/attempts/00000000-0000-0000-0000-000000000000`, {
        headers: new Headers({ host, "x-tenant-host-hint": host, cookie: `erp_session=${token}` }),
      }),
      { params: Promise.resolve({ attemptId: "00000000-0000-0000-0000-000000000000" }) },
    );
    expect(response.status).toBe(404);
  });
});
