import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitState } from "../src/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimitState();
  });

  it("allows requests up to the limit within the window", () => {
    const key = "login:1.2.3.4";
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, { limit: 5, windowMs: 60_000 }, 1000).allowed).toBe(true);
    }
  });

  it("blocks the request that exceeds the limit within the window", () => {
    const key = "login:1.2.3.4";
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, { limit: 5, windowMs: 60_000 }, 1000);
    }
    const result = checkRateLimit(key, { limit: 5, windowMs: 60_000 }, 1000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const key = "login:1.2.3.4";
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, { limit: 5, windowMs: 60_000 }, 1000);
    }
    expect(checkRateLimit(key, { limit: 5, windowMs: 60_000 }, 1000).allowed).toBe(false);
    expect(checkRateLimit(key, { limit: 5, windowMs: 60_000 }, 62_000).allowed).toBe(true);
  });

  it("tracks separate keys independently", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("login:1.1.1.1", { limit: 5, windowMs: 60_000 }, 1000);
    }
    expect(checkRateLimit("login:1.1.1.1", { limit: 5, windowMs: 60_000 }, 1000).allowed).toBe(false);
    expect(checkRateLimit("login:2.2.2.2", { limit: 5, windowMs: 60_000 }, 1000).allowed).toBe(true);
  });
});
