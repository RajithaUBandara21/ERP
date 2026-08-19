import { describe, expect, it } from "vitest";
import { satisfiesVersionRange } from "../src/version";

describe("satisfiesVersionRange", () => {
  it("the wildcard accepts any version", () => {
    expect(satisfiesVersionRange("1.0.0", "*")).toBe(true);
    expect(satisfiesVersionRange("2.5.1", "*")).toBe(true);
  });

  it("matches only an exact version otherwise", () => {
    expect(satisfiesVersionRange("1.0.0", "1.0.0")).toBe(true);
    expect(satisfiesVersionRange("1.0.1", "1.0.0")).toBe(false);
  });
});
