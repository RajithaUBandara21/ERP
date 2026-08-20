# modules/core

Owns: the module install/uninstall lifecycle (per-tenant), and (not yet implemented) feature flags/configuration. Owns no *business* tenant-DB tables of its own — but since Phase 13 its `applyMigrations` hook runs `packages/events`' outbox migration (the outbox must exist before any module might publish an event, and core is the one module every tenant always installs first — see [ADR-0004](../../docs/adr/0004-outbox-pattern.md)'s Update).

Full detail, including the Phase 6 "minimal stub" scope decision: [docs/modules/core.md](../../docs/modules/core.md).
