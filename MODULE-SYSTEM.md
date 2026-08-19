# Module System

Status: the manifest contract, dependency-graph validation, and per-tenant install/uninstall lifecycle are implemented as of Phase 6 (`packages/module-registry`, `modules/core`); `tenant` and `identity` were retrofitted with real manifests in Phase 7, including a real, working tenant-DB migration hook (`identity`'s `users`/`roles` tables are now created purely by installing it through the registry, not by a direct function call — see §3). Steps 4–7 of §3's installation sequence (register permissions/routes/configuration/event handlers) are still no-ops — see §3's note. See [DOMAIN-MODEL.md](./DOMAIN-MODEL.md) for the current module dependency graph and [docs/modules/core.md](./docs/modules/core.md) for `core`'s own detail.

## 1. Module internal structure

Every business module conceptually contains (CLAUDE.md §6):

```text
module/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── domain-services/
│   ├── domain-events/
│   └── repositories/        (interfaces only — implementations live in infrastructure/)
├── application/
│   ├── commands/
│   ├── queries/
│   ├── services/
│   └── use-cases/
├── infrastructure/
│   ├── repositories/        (Drizzle-backed implementations of domain repository interfaces)
│   ├── persistence/         (Drizzle schema + migrations for this module's tables)
│   └── integrations/        (outbound calls to external systems, e.g. payment gateways)
├── interfaces/
│   ├── api/                 (Route Handlers / Server Actions — thin, delegate to application/)
│   └── ui/                  (React components specific to this module)
├── permissions/             (this module's PermissionDefinition list)
├── migrations/               (or colocated under infrastructure/persistence — decided per-module)
├── tests/
└── module.manifest.ts
```

Only `interfaces/` and the module's declared public exports (typically re-exported from `application/`) are importable by other modules or by `apps/*`. `domain/` and `infrastructure/` are private to the module — enforced by the boundary lint rule described in [ARCHITECTURE.md](./ARCHITECTURE.md#4-module-boundaries).

## 2. Module manifest

```typescript
interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description: string;

  dependencies: ModuleDependency[];
  permissions: PermissionDefinition[];
  routes: RouteDefinition[];
  eventsPublished: EventDefinition[];
  eventsConsumed: EventDefinition[];
  configuration: ConfigurationDefinition[];
}

interface ModuleDependency {
  moduleId: string;
  versionRange: string; // semver range
}
```

The manifest is authored as TypeScript (not JSON), matching `@erp/module-registry`'s `ModuleManifest` type. `@erp/module-registry`'s `ModuleRegistry` class holds the set of manifests the application knows about (currently just `core`'s — see `apps/web/src/lib/module-registry.ts`) and validates the *static* graph (cycles, unknown dependencies) via `validateGraph()`. `modules/core`'s `installModule`/`uninstallModule` (§3 below) perform the *per-tenant* checks (is a dependency actually installed and active for this specific tenant) against the control-plane `tenant_modules`/`module_versions` tables — a distinct concern from the static graph check.

## 3. Module installation sequence (CLAUDE.md §7)

```text
1. Validate dependencies      — every declared dependency is installed and version-compatible, FOR THIS TENANT
2. Validate compatibility     — dependency version satisfies the declared range (minimal: "*" or exact match — see @erp/module-registry's version.ts)
3. Run migrations             — WIRED (Phase 7): calls manifest.applyMigrations(tenantId) if present; core/tenant have none, identity's users/roles tables are created this way
4. Register permissions       — NOT YET WIRED: no per-tenant permission-catalog table exists (Phase 5 uses a static exported constant per module)
5. Register routes            — NOT YET WIRED: no route/nav registry exists
6. Register configuration     — NOT YET WIRED: no per-tenant configuration store exists
7. Register event handlers    — NOT YET WIRED: no event bus exists (Phase 13)
8. Activate the module        — control-plane tenant_modules.status = 'active'
9. Record installation state  — control-plane module_versions row (version, installedAt)
10. Audit the operation       — recordAuditEvent (@erp/logging) — actor, tenant, action, resource, requestId
```

Implemented in `modules/core/src/application/{install-module,uninstall-module}.ts`, exposed via `apps/web`'s `POST /api/modules/[moduleId]/{install,uninstall}` (permission-gated: `CORE.MODULE.MANAGE`). Steps 4–7 are left as visible, commented steps in the code — not silently skipped — so the sequence stays honest about current scope; each gets wired up once the system it registers into exists. Step 3's `applyMigrations` hook lives on `ModuleManifest` itself (`@erp/module-registry`'s `types.ts`) — a function reference each module's own manifest sets (or omits), so the module-agnostic `installModule` never needs to import any specific module. `apps/web/scripts/bootstrap-tenant.ts` demonstrates the full retrofit: it installs `core` → `tenant` → `identity` through the registry rather than calling `applyIdentityMigrations` directly, and `apps/web/tests/module-installation-retrofit.integration.test.ts` proves a real login works against tables created purely by that install call. No outbox/transactional-write-ordering machinery is used yet for steps 8–10 (a single control-plane database write, not a cross-database concern) — revisit only if a concrete failure mode is observed (CLAUDE.md §56).

## 4. Dependency validation and cycle detection

Two distinct checks, both implemented:

- **Static graph validation** (`@erp/module-registry`'s `ModuleRegistry.validateGraph()`): confirms every registered manifest's dependencies resolve to another registered manifest, and that the graph is acyclic (DFS with cycle detection). Runs once, at application/registry boot — not per-request. Proven with a deliberately circular dummy-manifest pair in `packages/module-registry/tests/cycle-detection.test.ts`.
- **Per-tenant runtime validation** (`modules/core`'s `installModule`): confirms every dependency resolves to an installed, version-compatible module, *for the tenant being installed into* — separate from whether the dependency exists in the static graph at all.

Before installation, the module registry builds a dependency graph from all manifests referenced (directly or transitively) by the module being installed, and:

1. Confirms every dependency resolves to an installed, version-compatible module (or is included in the same installation batch).
2. Performs a topological sort; any back-edge is reported as a circular dependency and installation is rejected.
3. Confirms the resulting graph matches the platform-level graph declared in [DOMAIN-MODEL.md](./DOMAIN-MODEL.md) — a module manifest may not declare a dependency the platform's own module catalog doesn't expect, preventing accidental spaghetti dependencies from being introduced module-by-module.

This validation is exercised by an automated test using a deliberately circular dummy manifest pair (Phase 6 exit criterion).

## 5. Module activation model (CLAUDE.md §8)

All official modules ship as part of the deployed application — **no dynamic code download or execution**. "Installing" a module for a tenant is a configuration + migration + registration operation against that tenant's data, not a code deployment:

```text
Tenant A: POS ACTIVE, Inventory ACTIVE, Delivery DISABLED
Tenant B: POS ACTIVE, Inventory ACTIVE, Delivery ACTIVE, Accounting ACTIVE
```

Module *code* is always present in the deployed application; module *activation* is per-tenant state in the control plane (`tenant_modules`) plus tenant-database state (installed migrations, registered permissions).

## 6. Module uninstallation (CLAUDE.md §46)

```text
1. Validate dependent modules   — refuse if another active module declares this one as a dependency
2. Disable module               — flip activation state, stop routing new requests to it
3. Stop new operations          — reject new writes through the module's application layer
4. Preserve/archive data        — never DELETE business/financial data; retain for recoverability
5. Record module state          — control plane records DISABLED with timestamp/actor
```

Steps 1, 2, 5 are implemented (`modules/core`'s `uninstallModule`) — proven with a test-only dummy dependent manifest showing uninstall is refused while it's active, and succeeds once that dependent is itself uninstalled first (`modules/core/tests/module-lifecycle.integration.test.ts`). Step 3 ("stop new operations") has nothing to enforce yet — `core` has no application-layer writes of its own; this becomes concrete once a module with real tenant-DB writes exists and needs to check its own activation state before writing. Step 4 is satisfied trivially for `core` (it owns no tenant-DB tables to preserve); the record itself (control-plane `tenant_modules` row) is always disabled, never deleted.

Uninstallation never runs a destructive migration against existing business data. Physical archival/retention policy is defined per module in its own documentation once implemented.

## 7. Feature flags vs module installation (CLAUDE.md §47)

These are deliberately separate concepts:

```text
Inventory installed = true       (module activation — coarse, tenant-level)
AdvancedForecasting  = false     (feature flag — fine-grained, tenant/user/environment/% rollout)
```

Feature flags are owned by `core` and can gate behavior *within* an installed module without requiring a new module installation/uninstallation cycle.
