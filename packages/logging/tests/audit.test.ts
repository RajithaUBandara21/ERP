import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordAuditEvent } from "../src/audit";

describe("recordAuditEvent", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("emits the full CLAUDE.md §37 field set", () => {
    recordAuditEvent({
      module: "core",
      actor: "user-1",
      tenantId: "tenant-1",
      action: "module.install",
      resource: "module",
      resourceId: "core",
      requestId: "req-1",
      ip: "127.0.0.1",
    });

    const line = JSON.parse(logSpy.mock.calls[0]![0] as string);
    expect(line).toMatchObject({
      audit: true,
      module: "core",
      operation: "module.install",
      tenantId: "tenant-1",
      resource: "module",
      resourceId: "core",
      requestId: "req-1",
      userId: "user-1",
      ip: "127.0.0.1",
    });
  });

  it("omits userId when actor is null, rather than logging null", () => {
    recordAuditEvent({ module: "identity", actor: null, tenantId: "tenant-1", action: "auth.login_failed", resource: "session" });

    const line = JSON.parse(logSpy.mock.calls[0]![0] as string);
    expect("userId" in line).toBe(false);
  });

  it("generates a requestId when the caller doesn't have one (e.g. a script, not an HTTP request)", () => {
    recordAuditEvent({ module: "core", actor: null, tenantId: "tenant-1", action: "module.install", resource: "module" });

    const line = JSON.parse(logSpy.mock.calls[0]![0] as string);
    expect(typeof line.requestId).toBe("string");
    expect(line.requestId.length).toBeGreaterThan(0);
  });
});
