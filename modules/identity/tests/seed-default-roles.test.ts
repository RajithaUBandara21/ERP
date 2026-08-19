import { describe, expect, it } from "vitest";
import { seedDefaultRoles } from "../src/application/seed-default-roles";
import { fakeDb, FakeRoleRepository } from "./fakes";

describe("seedDefaultRoles", () => {
  it("creates an owner role with the wildcard permission", async () => {
    const repo = new FakeRoleRepository();
    const { owner } = await seedDefaultRoles(repo, fakeDb);

    expect(owner.name).toBe("owner");
    expect(owner.permissions).toEqual(["*"]);
    expect(owner.isSystemRole).toBe(true);
  });

  it("creates a member role with no permissions (default-deny)", async () => {
    const repo = new FakeRoleRepository();
    const { member } = await seedDefaultRoles(repo, fakeDb);

    expect(member.name).toBe("member");
    expect(member.permissions).toEqual([]);
  });

  it("is idempotent — calling it twice returns the same roles, not duplicates", async () => {
    const repo = new FakeRoleRepository();
    const first = await seedDefaultRoles(repo, fakeDb);
    const second = await seedDefaultRoles(repo, fakeDb);

    expect(second.owner.id).toBe(first.owner.id);
    expect(second.member.id).toBe(first.member.id);
  });
});
