import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTenantMigrations } from "@erp/database";

/**
 * Applies this module's tenant-DB schema (payment_attempts/refunds) to one
 * tenant's database. Same pattern and caveats as
 * modules/identity/src/apply-migrations.ts — see its doc comment — and
 * uses its own migrations tracking table, per Phase 9's discovery
 * documented in packages/database/src/tenant/migrate.ts.
 */
export async function applyPaymentsMigrations(tenantId: string): Promise<void> {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = path.join(currentDir, "..", "migrations");
  await runTenantMigrations(tenantId, migrationsFolder, "__drizzle_migrations_payments");
}
