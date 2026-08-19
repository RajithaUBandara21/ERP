export interface Session {
  id: string;
  tenantId: string;
  userId: string;
  expiresAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export class SessionInvalidError extends Error {
  constructor(reason: "not_found" | "expired" | "revoked") {
    super(`Session invalid: ${reason}`);
    this.name = "SessionInvalidError";
  }
}
