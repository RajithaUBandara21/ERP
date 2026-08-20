import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTenantMigrations } from "@erp/database";

/**
 * Applies this module's tenant-DB schema (the `users` table) to one
 * tenant's database. Stand-in for Phase 6's module-installation migration
 * step (MODULE-SYSTEM.md §3) — see the comment on runTenantMigrations.
 *
 * Caution: resolves the migrations folder relative to this file's runtime
 * location — works against real source files (tsx scripts, vitest,
 * `next dev`), but a `next build` **production** bundle does not
 * automatically copy non-imported files like *.sql into its output, so
 * this would still break in a deployed production build. Not yet solved —
 * tracked as a known gap for Phase 6/7's "proper migration-asset
 * packaging" follow-up, not silently forgotten.
 *
 * Path resolution went through three attempts before this one worked,
 * verified against a live `next dev` HTTP request each time (not just
 * `next build` or tests, which don't exercise this the same way — CLAUDE.md
 * §56, don't claim something works without evidence):
 *   1. `path.join(import.meta.dirname, ...)` — `import.meta.dirname` is
 *      `undefined` under Turbopack's runtime (a Node-only convenience
 *      property, inconsistently polyfilled by bundlers).
 *   2. `fileURLToPath(new URL("../migrations", import.meta.url))` —
 *      Turbopack statically intercepts the `new URL(relative-literal,
 *      import.meta.url)` syntax specifically as an asset-bundling
 *      directive and tries to resolve "../migrations" as an importable
 *      module, which fails ("Module not found").
 *   3. (this one) Resolve *this file's own* path with `fileURLToPath`
 *      first, as a standalone expression — not the special two-argument
 *      `new URL(...)` pattern — then do the "../migrations" relative math
 *      afterward with plain `path.join`, entirely outside anything
 *      Turbopack pattern-matches on.
 */
export async function applyIdentityMigrations(tenantId: string): Promise<void> {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = path.join(currentDir, "..", "migrations");
  await runTenantMigrations(tenantId, migrationsFolder, "__drizzle_migrations_identity");
}
