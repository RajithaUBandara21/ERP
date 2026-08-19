export { closeControlPlaneDb, getControlPlaneDb, schema } from "./control-plane/client";
export type { ControlPlaneDb } from "./control-plane/client";
export * as controlPlaneSchema from "./control-plane/schema";

export { TenantConnectionRegistry } from "./tenant/connection-registry";
export type { TenantConnection, TenantConnectionRegistryOptions } from "./tenant/connection-registry";

export { getTenantConnectionRegistry, getTenantDb } from "./tenant/registry";
export type { TenantDb } from "./tenant/registry";

export { createTenantDatabase, provisionTenant, registerTenantDatabase } from "./tenant/provisioning";
export type { ProvisionTenantInput, ProvisionTenantResult } from "./tenant/provisioning";

export { runTenantMigrations } from "./tenant/migrate";
