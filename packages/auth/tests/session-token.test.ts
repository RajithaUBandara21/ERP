import { describe, expect, it } from "vitest";
import { generateSessionToken, hashSessionToken } from "../src/session-token";

describe("session tokens", () => {
  it("generates distinct tokens across calls", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateSessionToken()));
    expect(tokens.size).toBe(50);
  });

  it("hashes deterministically — the same token always hashes to the same value", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it("hashes different tokens to different values", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(hashSessionToken(a)).not.toBe(hashSessionToken(b));
  });

  it("the hash never contains the raw token", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).not.toContain(token);
  });
});
