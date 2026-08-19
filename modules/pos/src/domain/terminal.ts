export type TerminalStatus = "active" | "inactive";

/**
 * CLAUDE.md §18 also lists branch_id, last_sync, sync_version — omitted
 * here: branch_id needs a Branch entity (tenant module, not yet
 * implemented — see docs/modules/tenant.md), and last_sync/sync_version are
 * inherently offline-sync concerns (Phase 12). id/deviceId/status are this
 * phase's real scope: a terminal must exist and be identifiable before
 * anything else about it matters.
 */
export interface Terminal {
  id: string;
  name: string;
  deviceId: string | null;
  status: TerminalStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class TerminalNotFoundError extends Error {
  constructor(id: string) {
    super(`Terminal not found: ${id}`);
    this.name = "TerminalNotFoundError";
  }
}

export class TerminalNotActiveError extends Error {
  constructor(id: string) {
    super(`Terminal is not active: ${id}`);
    this.name = "TerminalNotActiveError";
  }
}
