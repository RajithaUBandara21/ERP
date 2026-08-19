import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../src/index";

describe("createLogger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("emits structured JSON with bound context merged in", () => {
    const logger = createLogger({ bindings: { module: "core" } });
    logger.info("hello", { tenantId: "tenant-1" });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(logSpy.mock.calls[0]![0] as string);
    expect(line).toMatchObject({ level: "info", msg: "hello", module: "core", tenantId: "tenant-1" });
  });

  it("redacts sensitive fields", () => {
    const logger = createLogger();
    logger.info("login attempt", { password: "hunter2" });

    const line = JSON.parse(logSpy.mock.calls[0]![0] as string);
    expect(line.password).toBe("[REDACTED]");
  });

  it("suppresses levels below the configured minimum", () => {
    const logger = createLogger({ level: "warn" });
    logger.info("should not appear");

    expect(logSpy).not.toHaveBeenCalled();
  });

  it("child() merges bindings without mutating the parent logger", () => {
    const parent = createLogger({ bindings: { module: "core" } });
    const child = parent.child({ operation: "install" });

    child.info("child log");
    parent.info("parent log");

    const childLine = JSON.parse(logSpy.mock.calls[0]![0] as string);
    const parentLine = JSON.parse(logSpy.mock.calls[1]![0] as string);
    expect(childLine).toMatchObject({ module: "core", operation: "install" });
    expect(parentLine.operation).toBeUndefined();
  });
});
