import * as api from "./api-client";
import { saveTerminalRecord, type TerminalRecord } from "./db";

export interface SetupTerminalInput {
  tenantHost: string;
  email: string;
  password: string;
  terminalName: string;
}

/**
 * One-time, online-only registration (CLAUDE.md §18: "Terminal identity
 * is established once (registration, online) and then used to scope
 * every offline-generated record"). Logs in (establishing the session
 * cookie the browser will carry on every later same-origin request) and
 * registers a real Terminal via modules/pos's existing API, then persists
 * the result locally so every later app launch skips straight to the POS
 * screen, online or not.
 */
export async function setupTerminal(input: SetupTerminalInput): Promise<TerminalRecord> {
  await api.login(input.tenantHost, input.email, input.password);
  const terminal = await api.registerTerminal(input.tenantHost, input.terminalName);

  const record: TerminalRecord = {
    id: "current",
    tenantHost: input.tenantHost,
    terminalId: terminal.id,
    deviceId: crypto.randomUUID(),
    terminalName: terminal.name,
    registeredAt: new Date().toISOString(),
    saleSequence: 0,
  };
  await saveTerminalRecord(record);
  return record;
}
