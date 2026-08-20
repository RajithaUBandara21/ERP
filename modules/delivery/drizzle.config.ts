import { defineConfig } from "drizzle-kit";

/** Same rationale as modules/identity/drizzle.config.ts — no live DB needed for `generate`. */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/infrastructure/persistence/schema.ts",
  out: "./migrations",
  dbCredentials: { url: "postgres://placeholder/placeholder" },
});
