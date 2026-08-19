# packages/logging

Structured JSON logger (`createLogger`) — fields: `request_id`, `correlation_id`, `tenant_id`, `user_id`, `module`, `operation`, `duration_ms`, `status`. Supports `.child()` for binding context (e.g. per-request loggers) and redacts sensitive keys (password/token/secret/etc.) automatically.

No external dependency (e.g. pino) yet — a deliberate, documented choice (see `src/index.ts`); the `Logger`/`LogContext` shape is what call sites depend on, so the implementation can be swapped later without touching call sites. See [docs/architecture/observability.md](../../docs/architecture/observability.md).

`recordAuditEvent` (`src/audit.ts`) — CLAUDE.md §37's structured audit trail, shipped to the same log sink; moved here in Phase 6 once `modules/core` needed the same pattern `apps/web`'s auth routes already used (Phase 4), rather than duplicating it. See its doc comment for why the logger it uses is constructed lazily, not as a module-level constant.
