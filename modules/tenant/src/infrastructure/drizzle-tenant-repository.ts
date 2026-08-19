import { getControlPlaneDb, schema } from "@erp/database";
import { and, eq, isNotNull } from "drizzle-orm";
import type { Tenant, TenantStatus } from "../domain/tenant";
import type { TenantRepository } from "../application/tenant-repository";

function toDomainTenant(row: typeof schema.tenants.$inferSelect): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status as TenantStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleTenantRepository implements TenantRepository {
  async findBySlug(slug: string): Promise<Tenant | undefined> {
    const db = getControlPlaneDb();
    const [row] = await db.select().from(schema.tenants).where(eq(schema.tenants.slug, slug)).limit(1);
    return row ? toDomainTenant(row) : undefined;
  }

  async findById(id: string): Promise<Tenant | undefined> {
    const db = getControlPlaneDb();
    const [row] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, id)).limit(1);
    return row ? toDomainTenant(row) : undefined;
  }

  /** Only resolves *verified* custom domains — an unverified domain claim must never grant tenant resolution. */
  async findByHostname(hostname: string): Promise<Tenant | undefined> {
    const db = getControlPlaneDb();
    const [row] = await db
      .select({ tenant: schema.tenants })
      .from(schema.domains)
      .innerJoin(schema.tenants, eq(schema.tenants.id, schema.domains.tenantId))
      .where(and(eq(schema.domains.hostname, hostname), isNotNull(schema.domains.verifiedAt)))
      .limit(1);
    return row ? toDomainTenant(row.tenant) : undefined;
  }

  /** Idempotent under concurrent callers: relies on the DB-level unique slug index, not a check-then-insert race. */
  async create(input: { slug: string; name: string }): Promise<Tenant> {
    const db = getControlPlaneDb();
    const [row] = await db
      .insert(schema.tenants)
      .values(input)
      .onConflictDoNothing({ target: schema.tenants.slug })
      .returning();

    if (row) return toDomainTenant(row);

    // Lost the race to a concurrent insert (or the row already existed) — read it back.
    const existing = await this.findBySlug(input.slug);
    if (!existing) {
      throw new Error(`Failed to create or load tenant with slug ${input.slug}`);
    }
    return existing;
  }
}
