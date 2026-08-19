/**
 * Bounded, lazily-populated tenant database connection registry.
 * See MULTI-TENANCY.md §3 and DATABASE.md §4 — this is what keeps a
 * serverless function instance from accumulating unbounded open
 * connections as more tenants are served, and is deliberately decoupled
 * from the real Postgres driver so it can be unit-tested without a
 * database (see tests/connection-registry.test.ts).
 */

export interface TenantConnection<TDb> {
  db: TDb;
  close(): Promise<void>;
}

interface RegistryEntry<TDb> {
  connection: TenantConnection<TDb>;
  lastUsedAt: number;
}

export interface TenantConnectionRegistryOptions<TDb> {
  /** Resolves a tenant's connection string — normally a control-plane lookup. */
  resolveConnectionString: (tenantId: string) => Promise<string>;
  /** Opens a new connection for a resolved connection string. */
  createConnection: (connectionString: string) => TenantConnection<TDb>;
  /** Maximum number of resident tenant connections per process (LRU-evicted beyond this). */
  maxSize?: number;
  /** Idle time (ms) after which an entry is eligible for proactive eviction via evictIdle(). */
  idleTtlMs?: number;
  now?: () => number;
}

export class TenantConnectionRegistry<TDb> {
  private readonly entries = new Map<string, RegistryEntry<TDb>>();
  private readonly inflight = new Map<string, Promise<TenantConnection<TDb>>>();
  private readonly maxSize: number;
  private readonly idleTtlMs: number;
  private readonly now: () => number;

  constructor(private readonly options: TenantConnectionRegistryOptions<TDb>) {
    this.maxSize = options.maxSize ?? 20;
    this.idleTtlMs = options.idleTtlMs ?? 5 * 60 * 1000;
    this.now = options.now ?? Date.now;
  }

  get size(): number {
    return this.entries.size;
  }

  async get(tenantId: string): Promise<TDb> {
    const existing = this.entries.get(tenantId);
    if (existing) {
      existing.lastUsedAt = this.now();
      // Refresh recency for LRU ordering (Map preserves insertion order).
      this.entries.delete(tenantId);
      this.entries.set(tenantId, existing);
      return existing.connection.db;
    }

    const pending = this.inflight.get(tenantId);
    if (pending) return (await pending).db;

    const openPromise = this.open(tenantId);
    this.inflight.set(tenantId, openPromise);
    try {
      const connection = await openPromise;
      return connection.db;
    } finally {
      this.inflight.delete(tenantId);
    }
  }

  private async open(tenantId: string): Promise<TenantConnection<TDb>> {
    const connectionString = await this.options.resolveConnectionString(tenantId);
    const connection = this.options.createConnection(connectionString);

    if (this.entries.size >= this.maxSize) {
      await this.evictLeastRecentlyUsed();
    }

    this.entries.set(tenantId, { connection, lastUsedAt: this.now() });
    return connection;
  }

  private async evictLeastRecentlyUsed(): Promise<void> {
    const oldestKey = this.entries.keys().next().value;
    if (oldestKey === undefined) return;
    await this.evict(oldestKey);
  }

  async evict(tenantId: string): Promise<void> {
    const entry = this.entries.get(tenantId);
    if (!entry) return;
    this.entries.delete(tenantId);
    await entry.connection.close();
  }

  /** Closes and removes entries idle longer than idleTtlMs — call periodically. */
  async evictIdle(): Promise<void> {
    const cutoff = this.now() - this.idleTtlMs;
    const idleKeys = [...this.entries.entries()]
      .filter(([, entry]) => entry.lastUsedAt < cutoff)
      .map(([tenantId]) => tenantId);

    for (const tenantId of idleKeys) {
      await this.evict(tenantId);
    }
  }

  async closeAll(): Promise<void> {
    const tenantIds = [...this.entries.keys()];
    for (const tenantId of tenantIds) {
      await this.evict(tenantId);
    }
  }
}
