import type { TenantDb } from "@erp/database";
import { eq } from "drizzle-orm";
import type { Role } from "../domain/role";
import type { RoleRepository } from "../application/role-repository";
import { roles } from "./persistence/schema";

function toDomainRole(row: typeof roles.$inferSelect): Role {
  return {
    id: row.id,
    name: row.name,
    permissions: row.permissions,
    isSystemRole: row.isSystemRole,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleRoleRepository implements RoleRepository {
  async findById(db: TenantDb, id: string): Promise<Role | undefined> {
    const [row] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    return row ? toDomainRole(row) : undefined;
  }

  async findByName(db: TenantDb, name: string): Promise<Role | undefined> {
    const [row] = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
    return row ? toDomainRole(row) : undefined;
  }

  async create(
    db: TenantDb,
    input: { name: string; permissions: string[]; isSystemRole: boolean },
  ): Promise<Role> {
    const [row] = await db
      .insert(roles)
      .values(input)
      .onConflictDoNothing({ target: roles.name })
      .returning();

    if (row) return toDomainRole(row);

    const existing = await this.findByName(db, input.name);
    if (!existing) {
      throw new Error(`Failed to create or load role with name ${input.name}`);
    }
    return existing;
  }
}
