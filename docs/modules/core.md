# Module: core

Status: module registry install/uninstall lifecycle implemented as of Phase 6 (`modules/core`); `identity` and `tenant` retrofitted with real manifests in Phase 7 (see their own docs). Feature flags, configuration definitions, and a persisted audit log are explicitly deferred (a Phase 6 scope decision, confirmed with the user before implementation) — `core` owns no tenant-DB tables yet.

## Domain ownership

`core` owns cross-cutting platform primitives used by every other module:

- Module registry entries (which modules a tenant has installed/active — control-plane `tenant_modules`/`module_versions`, implemented)
- The module *install/uninstall lifecycle* itself (implemented — see below)
- Feature flag definitions and evaluation (not yet implemented)
- Configuration definitions (not yet implemented)
- Audit log entries — currently a structured-log stream (`@erp/logging`'s `recordAuditEvent`), not a persisted/queryable tenant-DB table (deliberately deferred — see [SECURITY.md](../../SECURITY.md) §6)

`core` itself owns no tenant-DB tables — its manifest declares zero tenant-DB migrations. It is still real, live code: the manifest/registry/install/uninstall mechanism is this phase's deliverable, exercised against a module with nothing to migrate.

## Owned entities

- Control-plane `tenant_modules`/`module_versions` rows (not owned exclusively by `core` at the schema level — these are control-plane tables shared with every module's activation state — but `core`'s `ModuleRegistryRepository` is the only code that writes them).
- `FeatureFlag`, `ConfigurationDefinition` — not yet implemented.

## Implemented (`modules/core/src`)

- `module.manifest.ts` — `core`'s own `ModuleManifest` (no dependencies, two permissions: `CORE.MODULE.LIST`, `CORE.MODULE.MANAGE`, no tenant-DB migrations).
- `application/install-module.ts` / `uninstall-module.ts` — the per-tenant install/uninstall sequence from [MODULE-SYSTEM.md](../../MODULE-SYSTEM.md) §3/§6, against a `@erp/module-registry` `ModuleRegistry` (the static manifest graph) and the control-plane repository (per-tenant installed state).
- `application/list-modules.ts` — every registered manifest with this tenant's install status (`active` / `disabled` / `not_installed`).
- `infrastructure/drizzle-module-registry-repository.ts` — control-plane-backed `ModuleRegistryRepository`.

Exposed via `apps/web`: `GET /api/modules` (permission: `CORE.MODULE.LIST`), `POST /api/modules/[moduleId]/install` and `.../uninstall` (permission: `CORE.MODULE.MANAGE`).

## Dependencies

```text
core → (none — foundational, layer 0)
```

## Depended on by

`tenant` and `identity`, as of Phase 7 (both declare `dependencies: [{ moduleId: "core", versionRange: "*" }]` in their manifests — see [docs/modules/tenant.md](./tenant.md), [docs/modules/identity.md](./identity.md)). Remaining modules (`sales`, `purchasing`, `inventory`, `payments`, `pos`, `delivery`, `accounting`, `reporting`) get retrofitted the same way as each is implemented.

## Notes

**Where `@erp/module-registry` fits:** the `ModuleManifest` type and the static dependency-graph validator (cycle detection, unknown-dependency detection) live in a separate shared package, `@erp/module-registry`, not inside `modules/core` — following this codebase's established pattern of `packages/`\* owning generic mechanism and `modules/`\* owning the domain-specific application of it (the same split as `@erp/database`'s `createTenantDatabase` vs. `modules/tenant`'s `provisionTenantDatabase`). `core` was the first real consumer of it (Phase 6); `tenant` and `identity` followed in Phase 7.

**Two distinct dependency checks exist and must not be confused:** `@erp/module-registry`'s `validateGraph()` checks the *static* manifest set (do all declared dependencies exist as registered manifests, is the graph acyclic) — run once at boot. `modules/core`'s `installModule` checks the *per-tenant* state (is the dependency actually installed and active *for this tenant*) — run on every install call. See [MODULE-SYSTEM.md](../../MODULE-SYSTEM.md) §4.

See [MODULE-SYSTEM.md](../../MODULE-SYSTEM.md) for the full installation sequence and [DOMAIN-MODEL.md](../../DOMAIN-MODEL.md) for the module dependency graph.
