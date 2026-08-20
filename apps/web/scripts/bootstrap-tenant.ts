#!/usr/bin/env node
/**
 * Ops/demo script: provisions a tenant, installs core/tenant/identity/
 * billing through the module registry (which applies identity's tenant-DB
 * migrations as part of installation — see ModuleManifest.applyMigrations),
 * subscribes the tenant to the "starter" plan (Phase 15 — CLAUDE.md §48),
 * and registers a demo user. See apply-migrations.ts's doc comment for why
 * this must stay a standalone script, not a Route Handler.
 */
import { closeControlPlaneDb, getTenantConnectionRegistry, getTenantDb } from "@erp/database";
import { createTenant, DrizzleTenantRepository, provisionTenantDatabase, tenantManifest } from "@erp/tenant";
import {
  DrizzleRoleRepository,
  DrizzleUserRepository,
  identityManifest,
  registerUser,
  seedDefaultRoles,
} from "@erp/identity";
import { coreManifest, DrizzleModuleRegistryRepository, installModule } from "@erp/core";
import {
  billingManifest,
  createSubscription,
  DrizzlePlanRepository,
  DrizzleSubscriptionRepository,
  seedDefaultPlans,
} from "@erp/billing";
import { ModuleRegistry } from "@erp/module-registry";
import { createLogger } from "@erp/logging";

function parseArgs(argv: string[]): { slug: string; name: string; email: string; password: string } {
  const args = Object.fromEntries(
    argv
      .filter((arg) => arg.startsWith("--"))
      .map((arg) => {
        const [key, ...rest] = arg.replace(/^--/, "").split("=");
        return [key, rest.join("=")];
      }),
  );

  const slug = args["slug"];
  const email = args["email"];
  const password = args["password"];
  if (!slug || !email || !password) {
    throw new Error("Usage: bootstrap-tenant --slug=<slug> --email=<email> --password=<password> [--name=<name>]");
  }
  return { slug, name: args["name"] ?? slug, email, password };
}

async function main(): Promise<void> {
  const logger = createLogger({ bindings: { module: "identity", operation: "bootstrap-tenant" } });
  const { slug, name, email, password } = parseArgs(process.argv.slice(2));

  try {
    const tenantRepository = new DrizzleTenantRepository();
    const tenant = await createTenant(tenantRepository, { slug, name });
    await provisionTenantDatabase(tenant);

    const moduleRegistry = new ModuleRegistry();
    moduleRegistry.register(coreManifest);
    moduleRegistry.register(tenantManifest);
    moduleRegistry.register(identityManifest);
    moduleRegistry.register(billingManifest);
    moduleRegistry.validateGraph();

    const moduleRepository = new DrizzleModuleRegistryRepository();
    // core first (everything depends on it), then tenant/identity/billing — their
    // relative order doesn't matter, none of them depend on each other.
    await installModule(moduleRegistry, moduleRepository, tenant.id, "core", null);
    await installModule(moduleRegistry, moduleRepository, tenant.id, "tenant", null);
    await installModule(moduleRegistry, moduleRepository, tenant.id, "identity", null); // applies identity's tenant-DB migrations
    await installModule(moduleRegistry, moduleRepository, tenant.id, "billing", null);

    const planRepository = new DrizzlePlanRepository();
    const subscriptionRepository = new DrizzleSubscriptionRepository();
    await seedDefaultPlans(planRepository); // idempotent — plans are global, not tenant-scoped
    await createSubscription({ planRepository, subscriptionRepository }, { tenantId: tenant.id, planCode: "starter" });

    const tenantDb = await getTenantDb(tenant.id);
    const { owner } = await seedDefaultRoles(new DrizzleRoleRepository(), tenantDb);

    const userRepository = new DrizzleUserRepository();
    const user = await registerUser(userRepository, tenantDb, {
      email,
      password,
      name: "Demo Admin",
      roleId: owner.id,
    });

    logger.info("tenant bootstrapped", { tenantId: tenant.id, status: "ok" });
    // eslint-disable-next-line no-console -- CLI output, not a log line
    console.log(JSON.stringify({ tenant, user }, null, 2));
  } finally {
    // getTenantDb() opens a pooled connection via the shared tenant
    // connection registry — a short-lived script must close it explicitly
    // or the process hangs on the open socket instead of exiting.
    await getTenantConnectionRegistry().closeAll();
    await closeControlPlaneDb();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
