import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTenantMigrations } from "@erp/database";

/**
 * Applies this module's tenant-DB schema (terminals/carts/pos_transactions)
 * to one tenant's database. Same pattern and caveats as
 * modules/identity/src/apply-migrations.ts — see its doc comment,
 * including the still-open production-bundle asset-packaging gap and why
 * `fileURLToPath(import.meta.url)` is resolved as a standalone expression
 * (then joined with plain `path.join`) instead of `import.meta.dirname`
 * (undefined under Turbopack) or `new URL("../migrations", import.meta.url)`
 * (Turbopack statically intercepts that two-argument form as an asset
 * import and fails to resolve a non-JS directory).
 */
export async function applyPosMigrations(tenantId: string): Promise<void> {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = path.join(currentDir, "..", "migrations");
  await runTenantMigrations(tenantId, migrationsFolder);
}
