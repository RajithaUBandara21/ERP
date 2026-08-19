import { describe, expect, it } from "vitest";
import { registerTerminal } from "../src/application/register-terminal";
import { fakeDb, FakeTerminalRepository } from "./fakes";

describe("registerTerminal", () => {
  it("registers a terminal", async () => {
    const repo = new FakeTerminalRepository();
    const terminal = await registerTerminal(repo, fakeDb, { name: "Front Counter", deviceId: "device-1" });

    expect(terminal.name).toBe("Front Counter");
    expect(terminal.deviceId).toBe("device-1");
    expect(terminal.status).toBe("active");
  });

  it("allows omitting the device id", async () => {
    const repo = new FakeTerminalRepository();
    const terminal = await registerTerminal(repo, fakeDb, { name: "Kiosk" });
    expect(terminal.deviceId).toBeNull();
  });

  it("rejects an empty name", async () => {
    const repo = new FakeTerminalRepository();
    await expect(registerTerminal(repo, fakeDb, { name: "   " })).rejects.toThrow(/name/i);
  });
});
