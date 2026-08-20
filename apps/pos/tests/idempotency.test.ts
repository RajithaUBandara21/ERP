import { describe, expect, it } from "vitest";
import { idempotencyKeySchema } from "@erp/validation";
import { generateIdempotencyKey } from "../src/lib/idempotency";

describe("generateIdempotencyKey", () => {
  it("produces a key that satisfies the shared idempotencyKeySchema", () => {
    const key = generateIdempotencyKey("f1bb4036-f32d-47d4-a7a4-c061911b41ce", 42, new Date("2026-08-19T12:00:00Z"));
    expect(() => idempotencyKeySchema.parse(key)).not.toThrow();
    expect(key).toBe("POS-F1BB4036-20260819-000042");
  });

  it("is stable for the same terminal/sequence/date (deterministic, not random)", () => {
    const now = new Date("2026-08-19T12:00:00Z");
    const first = generateIdempotencyKey("terminal-abc", 1, now);
    const second = generateIdempotencyKey("terminal-abc", 1, now);
    expect(first).toBe(second);
  });

  it("differs across sequence numbers", () => {
    const now = new Date("2026-08-19T12:00:00Z");
    const a = generateIdempotencyKey("terminal-abc", 1, now);
    const b = generateIdempotencyKey("terminal-abc", 2, now);
    expect(a).not.toBe(b);
  });
});
