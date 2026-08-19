/** Seeded, non-deletable roles every tenant gets — see ADR-0007 and the Phase 5 scope decision on branch/warehouse scoping. */
export const SYSTEM_ROLE_NAMES = {
  OWNER: "owner",
  MEMBER: "member",
} as const;

export interface Role {
  id: string;
  name: string;
  permissions: string[];
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class RoleNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Role not found: ${identifier}`);
    this.name = "RoleNotFoundError";
  }
}
