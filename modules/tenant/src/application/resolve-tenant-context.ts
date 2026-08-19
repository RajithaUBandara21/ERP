import { getTenantDb, type TenantDb } from "@erp/database";
import { TenantNotActiveError, TenantNotFoundError, type Tenant } from "../domain/tenant";
import { extractSubdomainLabel, normalizeHost } from "./host";
import type { TenantRepository } from "./tenant-repository";

export interface TenantContext {
  tenant: Tenant;
  tenantDb: TenantDb;
}

/**
 * Resolves tenant identity from a request's Host header — the only
 * legitimate way to know "which tenant" before a session exists (e.g. to
 * render a tenant-branded login page). See MULTI-TENANCY.md §2 and §6.
 *
 * Trust boundary (interim, until Phase 4 auth lands): this derives tenant
 * identity from the Host header, which is appropriate for anonymous,
 * pre-authentication resolution — Postgres routing that follows is scoped
 * to whatever tenant the *server* looked up, never to any client-supplied
 * tenant id/slug in a body, query string, or custom header (none is ever
 * read here). Once sessions exist, callers must additionally cross-check
 * this result against session.tenantId and reject on mismatch — see
 * MULTI-TENANCY.md §2's full request-flow diagram.
 */
export async function resolveTenantContext(repository: TenantRepository, host: string): Promise<TenantContext> {
  const hostname = normalizeHost(host);

  let tenant = await repository.findByHostname(hostname);

  if (!tenant) {
    const slugCandidate = extractSubdomainLabel(hostname);
    if (slugCandidate) {
      tenant = await repository.findBySlug(slugCandidate);
    }
  }

  if (!tenant) {
    throw new TenantNotFoundError(hostname);
  }
  if (tenant.status !== "active") {
    throw new TenantNotActiveError(tenant.slug, tenant.status);
  }

  const tenantDb = await getTenantDb(tenant.id);
  return { tenant, tenantDb };
}
