# infrastructure/scripts

Reserved for ops-level shell/CLI wrappers (not business/domain logic — that lives in the owning module or package).

The Phase 2 tenant-provisioning CLI lives in [packages/database](../../packages/database) instead (`pnpm provision:tenant -- --slug=<slug>`), since provisioning is domain logic owned by that package, not a standalone ops script. This directory stays empty until a genuinely ops-only need (e.g. a backup/restore wrapper) arises.
