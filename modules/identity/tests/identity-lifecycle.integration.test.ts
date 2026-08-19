/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 * Provisions a real tenant database and applies this module's migrations to it.
 */
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb, getTenantDb } from "@erp/database";
import { createTenant, DrizzleTenantRepository, provisionTenantDatabase } from "@erp/tenant";
import { applyIdentityMigrations } from "../src/apply-migrations";
import { DrizzleRoleRepository } from "../src/infrastructure/drizzle-role-repository";
import { DrizzleUserRepository } from "../src/infrastructure/drizzle-user-repository";
import { registerUser } from "../src/application/register-user";
import { seedDefaultRoles } from "../src/application/seed-default-roles";
import { verifyCredentials } from "../src/application/verify-credentials";
import { EmailAlreadyRegisteredError, InvalidCredentialsError } from "../src/domain/user";

const hasDatabases = Boolean(process.env.CONTROL_PLANE_DATABASE_URL && process.env.TENANT_DATABASE_ADMIN_URL);

describe.skipIf(!hasDatabases)("identity lifecycle (integration)", () => {
  const slug = `identity-test-${Date.now()}`;
  const databaseName = `tenant_${slug.replace(/-/g, "_")}`;
  const tenantRepo = new DrizzleTenantRepository();
  const userRepo = new DrizzleUserRepository();
  const roleRepo = new DrizzleRoleRepository();
  let tenantId: string;
  let ownerRoleId: string;

  beforeAll(async () => {
    const tenant = await createTenant(tenantRepo, { slug, name: "Identity Test Tenant" });
    tenantId = tenant.id;
    await provisionTenantDatabase(tenant);
    await applyIdentityMigrations(tenantId);

    const db = await getTenantDb(tenantId);
    const { owner } = await seedDefaultRoles(roleRepo, db);
    ownerRoleId = owner.id;
  });

  afterAll(async () => {
    const admin = postgres(process.env.TENANT_DATABASE_ADMIN_URL!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.end();
    await closeControlPlaneDb();
  });

  it("registers a user and verifies correct credentials against the tenant's own database", async () => {
    const db = await getTenantDb(tenantId);
    await registerUser(userRepo, db, { email: "owner@acme.test", password: "supersecret1", name: "Owner", roleId: ownerRoleId });

    const verified = await verifyCredentials(userRepo, db, { email: "owner@acme.test", password: "supersecret1" });
    expect(verified.email).toBe("owner@acme.test");
    expect(verified.roleId).toBe(ownerRoleId);
  });

  it("rejects a duplicate registration", async () => {
    const db = await getTenantDb(tenantId);
    await expect(
      registerUser(userRepo, db, { email: "owner@acme.test", password: "anotherpassword", name: "Owner 2", roleId: ownerRoleId }),
    ).rejects.toThrow(EmailAlreadyRegisteredError);
  });

  it("rejects an incorrect password against real stored hash", async () => {
    const db = await getTenantDb(tenantId);
    await expect(
      verifyCredentials(userRepo, db, { email: "owner@acme.test", password: "wrong-password" }),
    ).rejects.toThrow(InvalidCredentialsError);
  });
});
