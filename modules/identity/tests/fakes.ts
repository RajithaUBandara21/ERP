import type { TenantDb } from "@erp/database";
import type { Role } from "../src/domain/role";
import type { User } from "../src/domain/user";
import type { RoleRepository } from "../src/application/role-repository";
import type { UserRepository } from "../src/application/user-repository";

/** A fake TenantDb is fine here — the fake repositories never actually touch it. */
export const fakeDb = {} as TenantDb;

export class FakeUserRepository implements UserRepository {
  private readonly byId = new Map<string, User>();
  private nextId = 1;

  async findByEmail(_db: TenantDb, email: string): Promise<User | undefined> {
    return [...this.byId.values()].find((u) => u.email === email);
  }

  async findById(_db: TenantDb, id: string): Promise<User | undefined> {
    return this.byId.get(id);
  }

  async create(
    _db: TenantDb,
    input: { email: string; passwordHash: string; name: string; roleId: string },
  ): Promise<User> {
    const now = new Date();
    const user: User = {
      id: `user-${this.nextId++}`,
      email: input.email,
      passwordHash: input.passwordHash,
      name: input.name,
      status: "active",
      roleId: input.roleId,
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(user.id, user);
    return user;
  }

  async listAll(_db: TenantDb): Promise<User[]> {
    return [...this.byId.values()];
  }

  seed(user: Omit<User, "id" | "createdAt" | "updatedAt">): User {
    const now = new Date();
    const full: User = { id: `user-${this.nextId++}`, createdAt: now, updatedAt: now, ...user };
    this.byId.set(full.id, full);
    return full;
  }
}

export class FakeRoleRepository implements RoleRepository {
  private readonly byId = new Map<string, Role>();
  private nextId = 1;

  async findById(_db: TenantDb, id: string): Promise<Role | undefined> {
    return this.byId.get(id);
  }

  async findByName(_db: TenantDb, name: string): Promise<Role | undefined> {
    return [...this.byId.values()].find((r) => r.name === name);
  }

  async create(
    _db: TenantDb,
    input: { name: string; permissions: string[]; isSystemRole: boolean },
  ): Promise<Role> {
    const existing = await this.findByName(_db, input.name);
    if (existing) return existing;
    return this.seed(input);
  }

  seed(role: Omit<Role, "id" | "createdAt" | "updatedAt">): Role {
    const now = new Date();
    const full: Role = { id: `role-${this.nextId++}`, createdAt: now, updatedAt: now, ...role };
    this.byId.set(full.id, full);
    return full;
  }
}
