import { describe, expect, it, vi } from "vitest";
import { TenantConnectionRegistry } from "../src/tenant/connection-registry";

interface FakeDb {
  tenantId: string;
}

function createFakeRegistry(overrides: Partial<{ maxSize: number; idleTtlMs: number; now: () => number }> = {}) {
  const closeCalls: string[] = [];
  const opened: string[] = [];

  const registry = new TenantConnectionRegistry<FakeDb>({
    resolveConnectionString: async (tenantId) => `postgres://fake/${tenantId}`,
    createConnection: (connectionString) => {
      const tenantId = connectionString.split("/").pop()!;
      opened.push(tenantId);
      return {
        db: { tenantId },
        close: async () => {
          closeCalls.push(tenantId);
        },
      };
    },
    maxSize: overrides.maxSize ?? 2,
    ...(overrides.idleTtlMs !== undefined ? { idleTtlMs: overrides.idleTtlMs } : {}),
    ...(overrides.now !== undefined ? { now: overrides.now } : {}),
  });

  return { registry, closeCalls, opened };
}

describe("TenantConnectionRegistry", () => {
  it("opens a connection lazily on first access and reuses it on subsequent access", async () => {
    const { registry, opened } = createFakeRegistry();

    const first = await registry.get("tenant-a");
    const second = await registry.get("tenant-a");

    expect(first).toBe(second);
    expect(opened).toEqual(["tenant-a"]);
    expect(registry.size).toBe(1);
  });

  it("evicts the least recently used entry once maxSize is exceeded", async () => {
    const { registry, closeCalls } = createFakeRegistry({ maxSize: 2 });

    await registry.get("tenant-a");
    await registry.get("tenant-b");
    // touch tenant-a again so tenant-b becomes the least recently used
    await registry.get("tenant-a");
    await registry.get("tenant-c");

    expect(closeCalls).toEqual(["tenant-b"]);
    expect(registry.size).toBe(2);
  });

  it("never opens two connections for concurrent requests for the same tenant", async () => {
    const { registry, opened } = createFakeRegistry();

    const [a, b] = await Promise.all([registry.get("tenant-a"), registry.get("tenant-a")]);

    expect(a).toBe(b);
    expect(opened).toEqual(["tenant-a"]);
  });

  it("evictIdle closes only entries past the idle TTL", async () => {
    let currentTime = 0;
    const { registry, closeCalls } = createFakeRegistry({ idleTtlMs: 1000, now: () => currentTime });

    await registry.get("tenant-a");
    currentTime = 1000;
    await registry.get("tenant-b");
    currentTime = 1600; // cutoff = 600: tenant-a (last used at 0) is idle past the TTL, tenant-b (last used at 1000) is not

    await registry.evictIdle();

    expect(closeCalls).toEqual(["tenant-a"]);
    expect(registry.size).toBe(1);
  });

  it("resolveConnectionString and createConnection are only invoked once per tenant even under repeated get() calls", async () => {
    const resolve = vi.fn(async (tenantId: string) => `postgres://fake/${tenantId}`);
    const create = vi.fn((connectionString: string) => ({
      db: { tenantId: connectionString },
      close: async () => undefined,
    }));

    const registry = new TenantConnectionRegistry<{ tenantId: string }>({
      resolveConnectionString: resolve,
      createConnection: create,
    });

    await registry.get("tenant-a");
    await registry.get("tenant-a");
    await registry.get("tenant-a");

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
