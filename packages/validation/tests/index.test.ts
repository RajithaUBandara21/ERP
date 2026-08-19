import { describe, expect, it } from "vitest";
import { idempotencyKeySchema, stripUndefined, tenantSlugSchema } from "../src/index";

describe("tenantSlugSchema", () => {
  it("accepts a lowercase hyphenated slug", () => {
    expect(tenantSlugSchema.safeParse("acme-retail").success).toBe(true);
  });

  it("rejects uppercase and spaces", () => {
    expect(tenantSlugSchema.safeParse("Acme Retail").success).toBe(false);
  });
});

describe("idempotencyKeySchema", () => {
  it("accepts the documented POS format", () => {
    expect(idempotencyKeySchema.safeParse("POS-TERM-001-20260819-000123").success).toBe(true);
  });

  it("rejects a key missing the date/sequence segments", () => {
    expect(idempotencyKeySchema.safeParse("POS-TERM-001").success).toBe(false);
  });
});

describe("stripUndefined", () => {
  it("removes keys whose value is undefined", () => {
    expect(stripUndefined({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it("keeps falsy-but-defined values (0, '', false, null)", () => {
    expect(stripUndefined({ a: 0, b: "", c: false, d: null })).toEqual({ a: 0, b: "", c: false, d: null });
  });

  it("returns an equivalent object when nothing is undefined", () => {
    expect(stripUndefined({ a: 1, b: "x" })).toEqual({ a: 1, b: "x" });
  });
});
