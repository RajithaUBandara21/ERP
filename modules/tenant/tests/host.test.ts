import { describe, expect, it } from "vitest";
import { extractSubdomainLabel, normalizeHost } from "../src/application/host";

describe("normalizeHost", () => {
  it("strips the port and lowercases", () => {
    expect(normalizeHost("Acme.Platform.example.com:3000")).toBe("acme.platform.example.com");
  });
});

describe("extractSubdomainLabel", () => {
  it("returns undefined for bare localhost", () => {
    expect(extractSubdomainLabel("localhost")).toBeUndefined();
  });

  it("returns the label for <slug>.localhost (local dev convention)", () => {
    expect(extractSubdomainLabel("acme.localhost")).toBe("acme");
  });

  it("returns undefined for a bare 2-label apex domain", () => {
    expect(extractSubdomainLabel("example.com")).toBeUndefined();
  });

  it("treats a 3-label host as having a subdomain label relative to its 2-label apex", () => {
    // e.g. if the platform's own base domain is "platform.example.com", then
    // "platform" here is itself the (non-tenant) apex label, not a tenant —
    // callers only treat this as a tenant slug if it doesn't match any
    // reserved/platform hostname, which is the repository lookup's job, not
    // this pure parsing function's.
    expect(extractSubdomainLabel("platform.example.com")).toBe("platform");
  });

  it("returns the first label for a tenant subdomain of the platform domain", () => {
    expect(extractSubdomainLabel("acme.platform.example.com")).toBe("acme");
  });

  it("returns undefined for a bare custom domain with no subdomain", () => {
    expect(extractSubdomainLabel("acme.com")).toBeUndefined();
  });
});
