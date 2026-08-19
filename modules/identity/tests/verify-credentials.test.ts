import { hashPassword } from "@erp/auth";
import { describe, expect, it } from "vitest";
import { verifyCredentials } from "../src/application/verify-credentials";
import { InvalidCredentialsError, UserNotActiveError } from "../src/domain/user";
import { fakeDb, FakeUserRepository } from "./fakes";

describe("verifyCredentials", () => {
  it("returns the user when the password matches", async () => {
    const repo = new FakeUserRepository();
    const passwordHash = await hashPassword("correct-password");
    repo.seed({ email: "jane@example.com", passwordHash, name: "Jane", status: "active", roleId: "role-member" });

    const user = await verifyCredentials(repo, fakeDb, { email: "jane@example.com", password: "correct-password" });
    expect(user.email).toBe("jane@example.com");
  });

  it("throws InvalidCredentialsError for a wrong password", async () => {
    const repo = new FakeUserRepository();
    const passwordHash = await hashPassword("correct-password");
    repo.seed({ email: "jane@example.com", passwordHash, name: "Jane", status: "active", roleId: "role-member" });

    await expect(
      verifyCredentials(repo, fakeDb, { email: "jane@example.com", password: "wrong-password" }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("throws the same InvalidCredentialsError for a non-existent email (no account-existence leak)", async () => {
    const repo = new FakeUserRepository();
    await expect(
      verifyCredentials(repo, fakeDb, { email: "nobody@example.com", password: "whatever1" }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("throws UserNotActiveError for a disabled account with the correct password", async () => {
    const repo = new FakeUserRepository();
    const passwordHash = await hashPassword("correct-password");
    repo.seed({ email: "disabled@example.com", passwordHash, name: "Disabled", status: "disabled", roleId: "role-member" });

    await expect(
      verifyCredentials(repo, fakeDb, { email: "disabled@example.com", password: "correct-password" }),
    ).rejects.toThrow(UserNotActiveError);
  });
});
