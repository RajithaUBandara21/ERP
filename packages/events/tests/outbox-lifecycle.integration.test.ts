/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 * Provisions a real tenant, applies this package's own migration directly
 * (proving applyEventsMigrations itself creates the tables), and proves
 * the write-in-the-same-transaction guarantee (ADR-0004) against real
 * Postgres: an event written inside a transaction that then rolls back
 * never appears in the outbox.
 *
 * Deliberately does NOT go through modules/core's install flow (which is
 * what actually calls this in production — see modules/core/src/
 * apply-migrations.ts) — depending on @erp/core here to prove that would
 * create a real cyclic workspace dependency (core depends on events;
 * events' tests would then depend on core). That specific "core's install
 * really triggers this" proof lives in modules/core's own test suite
 * instead, where core already has a legitimate one-directional dependency
 * on @erp/events.
 */
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb, getTenantDb } from "@erp/database";
import { createTenant, DrizzleTenantRepository, provisionTenantDatabase } from "@erp/tenant";
import { applyEventsMigrations } from "../src/apply-migrations";
import { DOMAIN_EVENT_TYPES } from "../src/domain/domain-event";
import { publishPendingEvents } from "../src/application/publish-pending-events";
import { writeOutboxEvent } from "../src/application/write-outbox-event";
import { DrizzleOutboxRepository } from "../src/infrastructure/drizzle-outbox-repository";

const hasDatabases = Boolean(process.env.CONTROL_PLANE_DATABASE_URL && process.env.TENANT_DATABASE_ADMIN_URL);

describe.skipIf(!hasDatabases)("outbox lifecycle (integration)", () => {
  const slug = `outbox-test-${Date.now()}`;
  const databaseName = `tenant_${slug.replace(/-/g, "_")}`;
  let tenantId: string;

  beforeAll(async () => {
    const tenantRepo = new DrizzleTenantRepository();
    const tenant = await createTenant(tenantRepo, { slug, name: "Outbox Test Tenant" });
    tenantId = tenant.id;
    await provisionTenantDatabase(tenant);
    await applyEventsMigrations(tenantId); // proves this package's own migration runs correctly
  });

  afterAll(async () => {
    const admin = postgres(process.env.TENANT_DATABASE_ADMIN_URL!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.end();
    await closeControlPlaneDb();
  });

  it("writes and publishes an event against real tables", async () => {
    const db = await getTenantDb(tenantId);
    const repository = new DrizzleOutboxRepository();

    const event = await writeOutboxEvent(repository, db, {
      aggregateId: "aggregate-1",
      eventType: DOMAIN_EVENT_TYPES.ORDER_PAID,
      payload: { totalCents: 1000 },
    });

    const pendingBefore = await repository.findPending(db, 10);
    expect(pendingBefore.map((e) => e.eventId)).toContain(event.eventId);

    const calls: string[] = [];
    const result = await publishPendingEvents(repository, db, [
      { id: "test-consumer", eventType: DOMAIN_EVENT_TYPES.ORDER_PAID, async handle(e) { calls.push(e.eventId); } },
    ]);

    expect(result.deliveries).toBe(1);
    expect(calls).toContain(event.eventId);

    const pendingAfter = await repository.findPending(db, 10);
    expect(pendingAfter.map((e) => e.eventId)).not.toContain(event.eventId);
  });

  it("ADR-0004: an event written inside a transaction that rolls back never appears in the outbox", async () => {
    const db = await getTenantDb(tenantId);
    const repository = new DrizzleOutboxRepository();

    await expect(
      db.transaction(async (tx) => {
        await writeOutboxEvent(repository, tx, {
          aggregateId: "aggregate-rollback",
          eventType: DOMAIN_EVENT_TYPES.ORDER_PAID,
          payload: {},
        });
        throw new Error("simulated failure after the outbox write, before commit");
      }),
    ).rejects.toThrow("simulated failure");

    const pending = await repository.findPending(db, 50);
    expect(pending.some((e) => e.aggregateId === "aggregate-rollback")).toBe(false);
  });
});
