import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/password";

describe("password hashing", () => {
  it("round-trips: a hash verifies against its original plaintext", async () => {
    const hashed = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hashed, "correct horse battery staple")).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hashed = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hashed, "wrong password")).resolves.toBe(false);
  });

  it("never stores the plaintext in the hash output", async () => {
    const plaintext = "correct horse battery staple";
    const hashed = await hashPassword(plaintext);
    expect(hashed).not.toContain(plaintext);
  });

  it("produces a different hash each time (random salt)", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
  });
});
