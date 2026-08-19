import { describe, expect, it } from "vitest";
import { getUserPermissions } from "../src/application/get-user-permissions";
import { RoleNotFoundError } from "../src/domain/role";
import { UserNotActiveError, UserNotFoundError } from "../src/domain/user";
import { fakeDb, FakeRoleRepository, FakeUserRepository } from "./fakes";

describe("getUserPermissions", () => {
  it("returns the permissions of the user's role", async () => {
    const userRepo = new FakeUserRepository();
    const roleRepo = new FakeRoleRepository();
    const role = roleRepo.seed({ name: "owner", permissions: ["*"], isSystemRole: true });
    const user = userRepo.seed({
      email: "owner@example.com",
      passwordHash: "hash",
      name: "Owner",
      status: "active",
      roleId: role.id,
    });

    const permissions = await getUserPermissions(userRepo, roleRepo, fakeDb, user.id);
    expect(permissions).toEqual(["*"]);
  });

  it("throws UserNotFoundError for an unknown user id", async () => {
    const userRepo = new FakeUserRepository();
    const roleRepo = new FakeRoleRepository();
    await expect(getUserPermissions(userRepo, roleRepo, fakeDb, "no-such-user")).rejects.toThrow(UserNotFoundError);
  });

  it("throws UserNotActiveError for a disabled user, even with a valid role", async () => {
    const userRepo = new FakeUserRepository();
    const roleRepo = new FakeRoleRepository();
    const role = roleRepo.seed({ name: "member", permissions: [], isSystemRole: true });
    const user = userRepo.seed({
      email: "disabled@example.com",
      passwordHash: "hash",
      name: "Disabled",
      status: "disabled",
      roleId: role.id,
    });

    await expect(getUserPermissions(userRepo, roleRepo, fakeDb, user.id)).rejects.toThrow(UserNotActiveError);
  });

  it("throws RoleNotFoundError when the user's role no longer exists", async () => {
    const userRepo = new FakeUserRepository();
    const roleRepo = new FakeRoleRepository();
    const user = userRepo.seed({
      email: "orphan@example.com",
      passwordHash: "hash",
      name: "Orphan",
      status: "active",
      roleId: "deleted-role",
    });

    await expect(getUserPermissions(userRepo, roleRepo, fakeDb, user.id)).rejects.toThrow(RoleNotFoundError);
  });
});
