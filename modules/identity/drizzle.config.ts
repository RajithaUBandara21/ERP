import { defineConfig } from "drizzle-kit";

/**
 * There is no single "the" tenant database to point this at — this schema
 * is applied identically to every tenant's database at runtime via
 * @erp/database's runTenantMigrations (see src/index.ts). `drizzle-kit
 * generate` only diffs the TS schema against the local migration journal;
 * it never opens this connection, so a placeholder is fine here.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/infrastructure/persistence/schema.ts",
  out: "./migrations",
  dbCredentials: { url: "postgres://placeholder/placeholder" },
});
