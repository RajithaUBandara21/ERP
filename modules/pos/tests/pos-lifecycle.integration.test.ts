/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 * Provisions a real tenant, installs pos through the module registry
 * (proving applyPosMigrations really creates the tables), and exercises
 * the full terminal → cart → checkout flow against real Postgres.
 */
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb, getTenantDb } from "@erp/database";
import { DrizzleOutboxRepository, DOMAIN_EVENT_TYPES } from "@erp/events";
import { createTenant, DrizzleTenantRepository, provisionTenantDatabase, tenantManifest } from "@erp/tenant";
import { identityManifest } from "@erp/identity";
import { inventoryManifest } from "@erp/inventory";
import { paymentsManifest } from "@erp/payments";
import { coreManifest, DrizzleModuleRegistryRepository, installModule } from "@erp/core";
import { ModuleRegistry } from "@erp/module-registry";
import { addCartLine } from "../src/application/add-cart-line";
import { checkout } from "../src/application/checkout";
import { createCart } from "../src/application/create-cart";
import { registerTerminal } from "../src/application/register-terminal";
import { AlwaysSucceedsPaymentCapturePort } from "../src/infrastructure/always-succeeds-payment-capture-port";
import { DrizzleCartRepository } from "../src/infrastructure/drizzle-cart-repository";
import { DrizzlePosTransactionRepository } from "../src/infrastructure/drizzle-pos-transaction-repository";
import { DrizzleTerminalRepository } from "../src/infrastructure/drizzle-terminal-repository";
import { NoopStockReservationPort } from "../src/infrastructure/noop-stock-reservation-port";
import { posManifest } from "../src/module.manifest";

const hasDatabases = Boolean(process.env.CONTROL_PLANE_DATABASE_URL && process.env.TENANT_DATABASE_ADMIN_URL);

describe.skipIf(!hasDatabases)("pos lifecycle (integration)", () => {
  const slug = `pos-test-${Date.now()}`;
  const databaseName = `tenant_${slug.replace(/-/g, "_")}`;
  let tenantId: string;

  beforeAll(async () => {
    const tenantRepo = new DrizzleTenantRepository();
    const tenant = await createTenant(tenantRepo, { slug, name: "POS Test Tenant" });
    tenantId = tenant.id;
    await provisionTenantDatabase(tenant);

    const registry = new ModuleRegistry();
    registry.register(coreManifest);
    registry.register(tenantManifest);
    registry.register(identityManifest);
    registry.register(inventoryManifest);
    registry.register(paymentsManifest);
    registry.register(posManifest);
    registry.validateGraph();

    const moduleRepo = new DrizzleModuleRegistryRepository();
    await installModule(registry, moduleRepo, tenantId, "core", null);
    await installModule(registry, moduleRepo, tenantId, "tenant", null);
    await installModule(registry, moduleRepo, tenantId, "identity", null);
    await installModule(registry, moduleRepo, tenantId, "inventory", null);
    await installModule(registry, moduleRepo, tenantId, "payments", null);
    await installModule(registry, moduleRepo, tenantId, "pos", null); // proves applyPosMigrations really runs
  });

  afterAll(async () => {
    const admin = postgres(process.env.TENANT_DATABASE_ADMIN_URL!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.end();
    await closeControlPlaneDb();
  });

  it("runs the full terminal → cart → checkout flow against real tables", async () => {
    const db = await getTenantDb(tenantId);
    const terminalRepository = new DrizzleTerminalRepository();
    const cartRepository = new DrizzleCartRepository();
    const transactionRepository = new DrizzlePosTransactionRepository();

    const terminal = await registerTerminal(terminalRepository, db, { name: "Front Counter", deviceId: "device-1" });
    const cart = await createCart(cartRepository, terminalRepository, db, { terminalId: terminal.id });
    const updatedCart = await addCartLine(cartRepository, db, cart.id, { sku: "SKU-1", name: "Widget", quantity: 3, unitPriceCents: 250 });
    expect(updatedCart.lines).toHaveLength(1);

    const outboxRepository = new DrizzleOutboxRepository();
    const transaction = await checkout(
      {
        cartRepository,
        transactionRepository,
        stockReservationPort: new NoopStockReservationPort(),
        paymentCapturePort: new AlwaysSucceedsPaymentCapturePort(),
        outboxRepository,
      },
      db,
      tenantId,
      { cartId: cart.id, idempotencyKey: "POS-TERM-001-20260819-000456", paymentMethod: "cash" },
    );

    expect(transaction.subtotalCents).toBe(750);
    expect(transaction.totalCents).toBe(750);

    const closedCart = await cartRepository.findById(db, cart.id);
    expect(closedCart?.status).toBe("completed");

    // The outbox write really landed in the same transaction as the business writes — see checkout.ts's doc comment.
    const pending = await outboxRepository.findPending(db, 10);
    const orderPaid = pending.find((event) => event.aggregateId === transaction.id);
    expect(orderPaid?.eventType).toBe(DOMAIN_EVENT_TYPES.ORDER_PAID);
  });

  it("retrying checkout with the same idempotency key against real Postgres returns the original row, never a duplicate", async () => {
    const db = await getTenantDb(tenantId);
    const terminalRepository = new DrizzleTerminalRepository();
    const cartRepository = new DrizzleCartRepository();
    const transactionRepository = new DrizzlePosTransactionRepository();
    const key = "POS-TERM-001-20260819-000789";

    const terminal = await registerTerminal(terminalRepository, db, { name: "Kiosk" });
    const cart = await createCart(cartRepository, terminalRepository, db, { terminalId: terminal.id });
    await addCartLine(cartRepository, db, cart.id, { sku: "SKU-2", name: "Gadget", quantity: 1, unitPriceCents: 999 });

    const deps = {
      cartRepository,
      transactionRepository,
      stockReservationPort: new NoopStockReservationPort(),
      paymentCapturePort: new AlwaysSucceedsPaymentCapturePort(),
      outboxRepository: new DrizzleOutboxRepository(),
    };

    const first = await checkout(deps, db, tenantId, { cartId: cart.id, idempotencyKey: key, paymentMethod: "card" });
    const second = await checkout(deps, db, tenantId, { cartId: cart.id, idempotencyKey: key, paymentMethod: "card" });

    expect(second.id).toBe(first.id);
  });
});
