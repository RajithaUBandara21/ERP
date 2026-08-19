import type { TenantDb } from "@erp/database";
import { eq } from "drizzle-orm";
import type { User, UserStatus } from "../domain/user";
import type { UserRepository } from "../application/user-repository";
import { users } from "./persistence/schema";

function toDomainUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    name: row.name,
    status: row.status as UserStatus,
    roleId: row.roleId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleUserRepository implements UserRepository {
  async findByEmail(db: TenantDb, email: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return row ? toDomainUser(row) : undefined;
  }

  async findById(db: TenantDb, id: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ? toDomainUser(row) : undefined;
  }

  async create(
    db: TenantDb,
    input: { email: string; passwordHash: string; name: string; roleId: string },
  ): Promise<User> {
    const [row] = await db.insert(users).values(input).returning();
    if (!row) {
      throw new Error(`Failed to create user with email ${input.email}`);
    }
    return toDomainUser(row);
  }

  async listAll(db: TenantDb): Promise<User[]> {
    const rows = await db.select().from(users);
    return rows.map(toDomainUser);
  }
}
