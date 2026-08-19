import { describe, expect, it, vi } from "vitest";

vi.mock("@erp/database", () => ({
  getControlPlaneDb: vi.fn(),
}));

describe("checkHealth", () => {
  it("reports ok when the control-plane database query succeeds", async () => {
    const { getControlPlaneDb } = await import("@erp/database");
    vi.mocked(getControlPlaneDb).mockReturnValue({
      execute: vi.fn().mockResolvedValue(undefined),
    } as never);

    const { checkHealth } = await import("../src/lib/health");
    const result = await checkHealth();

    expect(result.status).toBe("ok");
    expect(result.database).toBe("ok");
  });

  it("reports error without throwing when the database query fails", async () => {
    const { getControlPlaneDb } = await import("@erp/database");
    vi.mocked(getControlPlaneDb).mockReturnValue({
      execute: vi.fn().mockRejectedValue(new Error("connection refused")),
    } as never);

    const { checkHealth } = await import("../src/lib/health");
    const result = await checkHealth();

    expect(result.status).toBe("error");
    expect(result.database).toBe("error");
  });
});
