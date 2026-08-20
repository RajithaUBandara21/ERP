import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTenantMigrations } from "@erp/database";

/**
 * Applies the outbox/processed_events tables to one tenant's database.
 * Same path-resolution pattern as modules/identity/src/apply-migrations.ts
 * — see its doc comment — and its own migrations tracking table, per
 * Phase 9's discovery documented in packages/database/src/tenant/migrate.ts.
 *
 * Unlike a business module, packages/events isn't registered in the
 * ModuleRegistry — the outbox table needs to exist for ANY module to
 * publish events, not conditionally on some module being installed, so
 * this is called from modules/core's own applyMigrations hook (core is
 * the always-installed foundational module) rather than having its own
 * manifest entry — see modules/core/src/apply-migrations.ts.
 */
export async function applyEventsMigrations(tenantId: string): Promise<void> {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = path.join(currentDir, "..", "migrations");
  await runTenantMigrations(tenantId, migrationsFolder, "__drizzle_migrations_events");
}
