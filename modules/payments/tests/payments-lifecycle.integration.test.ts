/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 * Provisions a real tenant, installs payments through the module registry
 * (proving applyPaymentsMigrations really creates the tables), and proves
 * the row-locking in DrizzlePaymentAttemptRepository.applyRefund actually
 * prevents double/over-refunding under genuine concurrent connections.
 */
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb, getTenantDb } from "@erp/database";
import { createTenant, DrizzleTenantRepository, provisionTenantDatabase, tenantManifest } from "@erp/tenant";
import { identityManifest } from "@erp/identity";
import { coreManifest, DrizzleModuleRegistryRepository, installModule } from "@erp/core";
import { ModuleRegistry } from "@erp/module-registry";
import { capturePayment } from "../src/application/capture-payment";
import { refundPayment } from "../src/application/refund-payment";
import { RefundExceedsCapturedAmountError } from "../src/domain/errors";
import { CashProvider } from "../src/infrastructure/cash-provider";
import { DrizzlePaymentAttemptRepository } from "../src/infrastructure/drizzle-payment-attempt-repository";
import { paymentsManifest } from "../src/module.manifest";

const hasDatabases = Boolean(process.env.CONTROL_PLANE_DATABASE_URL && process.env.TENANT_DATABASE_ADMIN_URL);

describe.skipIf(!hasDatabases)("payments lifecycle (integration)", () => {
  const slug = `payments-test-${Date.now()}`;
  const databaseName = `tenant_${slug.replace(/-/g, "_")}`;
  let tenantId: string;

  beforeAll(async () => {
    const tenantRepo = new DrizzleTenantRepository();
    const tenant = await createTenant(tenantRepo, { slug, name: "Payments Test Tenant" });
    tenantId = tenant.id;
    await provisionTenantDatabase(tenant);

    const registry = new ModuleRegistry();
    registry.register(coreManifest);
    registry.register(tenantManifest);
    registry.register(identityManifest);
    registry.register(paymentsManifest);
    registry.validateGraph();

    const moduleRepo = new DrizzleModuleRegistryRepository();
    await installModule(registry, moduleRepo, tenantId, "core", null);
    await installModule(registry, moduleRepo, tenantId, "tenant", null);
    await installModule(registry, moduleRepo, tenantId, "identity", null);
    await installModule(registry, moduleRepo, tenantId, "payments", null); // proves applyPaymentsMigrations really runs
  });

  afterAll(async () => {
    const admin = postgres(process.env.TENANT_DATABASE_ADMIN_URL!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.end();
    await closeControlPlaneDb();
  });

  it("captures then fully refunds against real tables", async () => {
    const db = await getTenantDb(tenantId);
    const paymentAttemptRepository = new DrizzlePaymentAttemptRepository();
    const cash = new CashProvider();
    const deps = { paymentAttemptRepository, providers: { cash } };

    const attempt = await capturePayment(deps, db, {
      reference: "order-real-1",
      method: "cash",
      amountCents: 2000,
      idempotencyKey: "POS-TERM-001-20260819-700001",
    });
    expect(attempt.status).toBe("succeeded");

    const { paymentAttempt } = await refundPayment(deps, db, { paymentAttemptId: attempt.id, amountCents: 2000 });
    expect(paymentAttempt.status).toBe("refunded");
  });

  it("prevents over-refunding under real concurrent refund requests", async () => {
    const db = await getTenantDb(tenantId);
    const paymentAttemptRepository = new DrizzlePaymentAttemptRepository();
    const cash = new CashProvider();
    const deps = { paymentAttemptRepository, providers: { cash } };

    const attempt = await capturePayment(deps, db, {
      reference: "order-real-2",
      method: "cash",
      amountCents: 1000,
      idempotencyKey: "POS-TERM-001-20260819-700002",
    });

    // Two concurrent 600-cent refunds against a 1000-cent capture — only one can fit.
    const results = await Promise.allSettled([
      refundPayment(deps, db, { paymentAttemptId: attempt.id, amountCents: 600 }),
      refundPayment(deps, db, { paymentAttemptId: attempt.id, amountCents: 600 }),
    ]);

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason).toBeInstanceOf(RefundExceedsCapturedAmountError);

    const final = await paymentAttemptRepository.findById(db, attempt.id);
    expect(final?.refundedAmountCents).toBe(600); // never both — never a refund exceeding the capture
  });
});
