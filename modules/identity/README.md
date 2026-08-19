# modules/identity

Owns: users, credentials, roles/permissions (tenant-DB side). Has a real `module.manifest.ts` (Phase 7) — installing it through `modules/core`'s registry runs its migrations. Branch/warehouse-scoped grants and a per-tenant permission-catalog table remain deferred.

Full domain ownership and dependency detail, including the session-ownership correction made during Phase 4: [docs/modules/identity.md](../../docs/modules/identity.md).

```bash
pnpm --filter @erp/identity db:generate   # regenerate tenant-DB migrations after a schema change
```
