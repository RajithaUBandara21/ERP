export { TenantNotActiveError, TenantNotFoundError } from "./domain/tenant";
export type { Tenant, TenantStatus } from "./domain/tenant";

export type { TenantRepository } from "./application/tenant-repository";
export { DrizzleTenantRepository } from "./infrastructure/drizzle-tenant-repository";

export { createTenant } from "./application/create-tenant";
export type { CreateTenantInput } from "./application/create-tenant";

export { getTenantBySlug } from "./application/get-tenant-by-slug";

export { provisionTenantDatabase } from "./application/provision-tenant-database";

export { resolveTenantContext } from "./application/resolve-tenant-context";
export type { TenantContext } from "./application/resolve-tenant-context";

export { extractSubdomainLabel, normalizeHost } from "./application/host";

export { tenantManifest } from "./module.manifest";
