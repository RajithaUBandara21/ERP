# packages/validation

Re-exports `zod` plus shared primitives used at module `interfaces/` boundaries: `tenantSlugSchema`, `uuidSchema`, `emailSchema`, `idempotencyKeySchema` (see [OFFLINE-POS.md](../../OFFLINE-POS.md) §4), `paginationCursorSchema`, and the consistent `apiErrorSchema` (see [ARCHITECTURE.md](../../ARCHITECTURE.md) §6).

Grows as modules need shared primitives — module-specific schemas stay in that module's own `interfaces/` layer, not here.
