# packages/module-registry

The `ModuleManifest` contract and static dependency-graph validation — pure, no database/framework dependency (see [MODULE-SYSTEM.md](../../MODULE-SYSTEM.md)).

- `types.ts` — `ModuleManifest`, `ModuleDependency`, `PermissionDefinition`, `RouteDefinition`, `EventDefinition`, `ConfigurationDefinition`, and `applyMigrations?` (Phase 7 — the install-time tenant-DB migration hook; see its doc comment).
- `ModuleRegistry` — `register(manifest)`, `get(id)`, `getAll()`, `validateGraph()` (cycle + unknown-dependency detection via DFS, run once at boot).
- `satisfiesVersionRange(version, range)` — minimal: `"*"` or exact match only; see its doc comment for why full semver ranges aren't supported yet.

Consumed by `modules/core`, `modules/tenant`, and `modules/identity` (Phase 6/7). Does *not* check per-tenant installed state — that's `modules/core`'s job (see its doc comment on the two distinct dependency checks).
