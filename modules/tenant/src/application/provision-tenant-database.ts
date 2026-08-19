import { createTenantDatabase, registerTenantDatabase } from "@erp/database";
import type { Logger } from "@erp/logging";
import type { Tenant } from "../domain/tenant";

/**
 * Idempotent: creates the tenant's physical database (if it doesn't already
 * exist) and (re-)registers its connection string in the control plane.
 * Delegates the actual mechanics to @erp/database — see DATABASE.md §3 and
 * ADR-0009. This use case is the domain-level entry point a tenant-signup
 * flow calls; @erp/database's functions remain usable directly by ops
 * tooling (the provision-tenant CLI) without going through this module.
 */
export async function provisionTenantDatabase(tenant: Tenant, logger?: Logger): Promise<void> {
  logger?.info("provisioning tenant database", { tenantId: tenant.id, module: "tenant", operation: "provisionTenantDatabase" });

  const connectionString = await createTenantDatabase(tenant.slug);
  await registerTenantDatabase(tenant.id, connectionString);

  logger?.info("tenant database provisioned", {
    tenantId: tenant.id,
    module: "tenant",
    operation: "provisionTenantDatabase",
    status: "ok",
  });
}
