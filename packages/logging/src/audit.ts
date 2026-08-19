import { randomUUID } from "node:crypto";
import { createLogger } from "./index";

/**
 * Structured audit trail — CLAUDE.md §37's field set, shipped to the same
 * structured-log sink as everything else (see docs/architecture/observability.md).
 * A persisted, queryable audit_log table (tenant-side, owned by `core`) was
 * considered for Phase 6 and explicitly deferred (kept as a minimal stub —
 * see docs/modules/core.md); this remains a legitimate audit trail on its
 * own — see SECURITY.md §6. Originally lived in apps/web (Phase 4); moved
 * here once modules/core needed the same pattern for install/uninstall
 * (Phase 6), rather than duplicating it.
 *
 * The logger is created lazily (on first use), not as a module-level
 * constant — a module-level `createLogger()` call here caused
 * `TypeError: __name is not a function` under tsx (esbuild's keep-names
 * helper not landing correctly for eagerly-evaluated cross-package object
 * literals). Lazy construction sidesteps it entirely.
 */
let auditLogger: ReturnType<typeof createLogger> | undefined;
function getAuditLogger(): ReturnType<typeof createLogger> {
  auditLogger ??= createLogger({ bindings: { audit: true } });
  return auditLogger;
}

export interface AuditEvent {
  module: string;
  actor: string | null;
  tenantId: string;
  action: string;
  resource: string;
  resourceId?: string;
  requestId?: string;
  ip?: string;
}

export function recordAuditEvent(event: AuditEvent): void {
  getAuditLogger().info(`audit: ${event.action}`, {
    module: event.module,
    operation: event.action,
    tenantId: event.tenantId,
    resource: event.resource,
    requestId: event.requestId ?? randomUUID(),
    ...(event.actor ? { userId: event.actor } : {}),
    ...(event.resourceId ? { resourceId: event.resourceId } : {}),
    ...(event.ip ? { ip: event.ip } : {}),
  });
}
