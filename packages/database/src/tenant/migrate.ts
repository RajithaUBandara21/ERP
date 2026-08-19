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
 * Uses a short-lived connection, not the shared tenant connection registry —
 * migrations are an infrequent administrative operation, not request-path
 * traffic.
 */
export async function runTenantMigrations(tenantId: string, migrationsFolder: string): Promise<void> {
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
    await migrate(db, { migrationsFolder });
  } finally {
    await sql.end();
  }
}
