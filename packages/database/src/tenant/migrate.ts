import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { getControlPlaneDb, schema } from "../control-plane/client";
import { eq } from "drizzle-orm";

/**
 * Applies a pre-generated SQL migration set to one tenant's database.
 *
 * This is a deliberately minimal, module-agnostic primitive — it knows
 * nothing about which module owns which migrations folder. Phase 6's module
 * registry will generalize this into "run every installed module's
 * migrations for this tenant, in dependency order, as one of the module
 * installation steps" (MODULE-SYSTEM.md §3); until then, callers (module
 * bootstrap code, e.g. modules/identity) invoke this directly per module.
 *
 * `migrationsTable` MUST be unique per module (e.g.
 * "__drizzle_migrations_identity") — see Phase 9's discovery: drizzle's
 * migrator tracks "already applied" by comparing each local journal entry's
 * generation timestamp against the single highest timestamp recorded in
 * the tracking table, not by folder identity. With every module sharing
 * drizzle's default "__drizzle_migrations" table, a module whose migration
 * file happened to be *generated* (via `drizzle-kit generate`) earlier
 * than another module's — regardless of install order — got silently
 * skipped as "already applied" the moment it ran after that other module,
 * because its journal timestamp was older than the shared watermark.
 * Concretely: identity's migrations were generated in Phase 4/5, pos's in
 * Phase 8, inventory's in Phase 9 — so once Phase 9 wired POS to depend on
 * (and install after) inventory, `applyPosMigrations` silently did
 * nothing, and POS's tables never got created, because pos's Phase-8
 * timestamp was older than inventory's Phase-9 one. A per-module tracking
 * table removes the shared watermark entirely, so each module's install
 * order and generation timestamp are independent of every other module's.
 *
 * Uses a short-lived connection, not the shared tenant connection registry —
 * migrations are an infrequent administrative operation, not request-path
 * traffic.
 */
export async function runTenantMigrations(tenantId: string, migrationsFolder: string, migrationsTable: string): Promise<void> {
  const controlPlaneDb = getControlPlaneDb();
  const [registration] = await controlPlaneDb
    .select({ connectionString: schema.tenantDatabaseRegistry.connectionString })
    .from(schema.tenantDatabaseRegistry)
    .where(eq(schema.tenantDatabaseRegistry.tenantId, tenantId))
    .limit(1);

  if (!registration) {
    throw new Error(`No tenant database registered for tenant ${tenantId}`);
  }

  const sql = postgres(registration.connectionString, { max: 1 });
  try {
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder, migrationsTable });
  } finally {
    await sql.end();
  }
}
