import { describe, expect, it } from "vitest";
import { registerUser } from "../src/application/register-user";
import { EmailAlreadyRegisteredError } from "../src/domain/user";
import { fakeDb, FakeUserRepository } from "./fakes";

const roleId = "role-member";

describe("registerUser", () => {
  it("creates a user with a hashed password (never the plaintext)", async () => {
    const repo = new FakeUserRepository();
    const user = await registerUser(repo, fakeDb, { email: "Jane@Example.com", password: "hunter22", name: "Jane", roleId });

    expect(user.email).toBe("jane@example.com"); // normalized lowercase
    expect(user.roleId).toBe(roleId);
    expect("passwordHash" in user).toBe(false);
  });

  it("rejects a duplicate email", async () => {
    const repo = new FakeUserRepository();
    await registerUser(repo, fakeDb, { email: "jane@example.com", password: "hunter22", name: "Jane", roleId });

    await expect(
      registerUser(repo, fakeDb, { email: "jane@example.com", password: "different1", name: "Jane 2", roleId }),
    ).rejects.toThrow(EmailAlreadyRegisteredError);
  });

  it("rejects an invalid email", async () => {
    const repo = new FakeUserRepository();
    await expect(
      registerUser(repo, fakeDb, { email: "not-an-email", password: "hunter22", name: "Jane", roleId }),
    ).rejects.toThrow();
  });

  it("rejects a too-short password", async () => {
    const repo = new FakeUserRepository();
    await expect(
      registerUser(repo, fakeDb, { email: "jane@example.com", password: "short", name: "Jane", roleId }),
    ).rejects.toThrow(/password/i);
  });
});
