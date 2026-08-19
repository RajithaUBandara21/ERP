import { beforeEach, describe, expect, it } from "vitest";
import { loadConfig, resetConfigCache } from "../src/index";

describe("loadConfig", () => {
  beforeEach(() => {
    resetConfigCache();
  });

  it("parses required database URLs and applies defaults", () => {
    const config = loadConfig({
      CONTROL_PLANE_DATABASE_URL: "postgres://u:p@localhost:5432/control",
      TENANT_DATABASE_ADMIN_URL: "postgres://u:p@localhost:5432/postgres",
    } as NodeJS.ProcessEnv);

    expect(config.NODE_ENV).toBe("development");
    expect(config.LOG_LEVEL).toBe("info");
    expect(config.CONTROL_PLANE_DATABASE_URL).toContain("control");
  });

  it("throws a descriptive error without leaking values when required vars are missing", () => {
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrowError(/CONTROL_PLANE_DATABASE_URL/);
  });

  it("memoizes the result across calls until reset", () => {
    const env = {
      CONTROL_PLANE_DATABASE_URL: "postgres://u:p@localhost:5432/control",
      TENANT_DATABASE_ADMIN_URL: "postgres://u:p@localhost:5432/postgres",
    } as NodeJS.ProcessEnv;

    const first = loadConfig(env);
    const second = loadConfig({} as NodeJS.ProcessEnv);
    expect(second).toBe(first);
  });
});
