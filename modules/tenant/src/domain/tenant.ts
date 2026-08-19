/**
 * Tenant lifecycle domain — see docs/modules/tenant.md.
 *
 * Note on ownership (refined during Phase 3 implementation from the Phase 1
 * docs): tenant *existence* is inherently a control-plane fact — it is what
 * DATABASE.md §2's control-plane `tenants` table already models, and this
 * module's lifecycle use cases operate on that record. What will live
 * *inside* each tenant's own database under this module's ownership is
 * tenant-scoped organizational structure (branches, warehouses, settings),
 * introduced once the module registry (Phase 6) can install per-tenant
 * schemas. DOMAIN-MODEL.md and docs/modules/tenant.md are updated to match.
 */

export type TenantStatus = "active" | "suspended" | "archived";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class TenantNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Tenant not found: ${identifier}`);
    this.name = "TenantNotFoundError";
  }
}

export class TenantNotActiveError extends Error {
  constructor(slug: string, status: TenantStatus) {
    super(`Tenant '${slug}' is not active (status: ${status})`);
    this.name = "TenantNotActiveError";
  }
}
