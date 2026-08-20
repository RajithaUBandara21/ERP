/**
 * Control-plane schema — see DATABASE.md §2. Owned by the platform itself,
 * not by any business module (CLAUDE.md §11). Never mixed with tenant-plane
 * tables in the same database.
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  // 'active' | 'suspended' | 'archived'
  status: text("status").notNull().default("active"),
  ...timestamps,
}, (table) => [uniqueIndex("tenants_slug_idx").on(table.slug)]);

/**
 * Authoritative connection info per tenant. connectionString is a secret —
 * see DATABASE.md §2 and SECURITY.md §4: never logged, access is audited.
 */
export const tenantDatabaseRegistry = pgTable("tenant_database_registry", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  connectionString: text("connection_string").notNull(),
  // Physical placement metadata — see ADR-0009. e.g. 'local-dev' | 'shared-demo' | 'dedicated'
  placement: text("placement").notNull().default("local-dev"),
  ...timestamps,
}, (table) => [uniqueIndex("tenant_database_registry_tenant_id_idx").on(table.tenantId)]);

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  includedModules: jsonb("included_modules").$type<string[]>().notNull().default([]),
  userLimit: integer("user_limit"),
  priceCents: integer("price_cents").notNull().default(0),
  // 'monthly' | 'yearly'
  billingInterval: text("billing_interval").notNull().default("monthly"),
  ...timestamps,
}, (table) => [uniqueIndex("plans_code_idx").on(table.code)]);

/**
 * One row per tenant (uniqueIndex below) — a tenant's subscription is
 * mutated in place (status transitions, plan changes) rather than
 * superseded by a new row, the same "single perpetual record" choice as
 * tenantDatabaseRegistry. See modules/billing's createSubscription for the
 * idempotent-create use case this enables.
 */
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  planId: uuid("plan_id").notNull().references(() => plans.id),
  // 'trialing' | 'active' | 'past_due' | 'canceled'
  status: text("status").notNull().default("trialing"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("subscriptions_tenant_id_idx").on(table.tenantId)]);

/** Per-tenant module activation state — see MODULE-SYSTEM.md §5. */
export const tenantModules = pgTable("tenant_modules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  moduleId: text("module_id").notNull(),
  // 'active' | 'disabled'
  status: text("status").notNull().default("disabled"),
  installedAt: timestamp("installed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("tenant_modules_tenant_module_idx").on(table.tenantId, table.moduleId)]);

export const moduleVersions = pgTable("module_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  moduleId: text("module_id").notNull(),
  version: text("version").notNull(),
  installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
}, (table) => [uniqueIndex("module_versions_tenant_module_idx").on(table.tenantId, table.moduleId)]);

export const billing = pgTable("billing", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  // 'pending' | 'paid' | 'failed' | 'refunded'
  status: text("status").notNull().default("pending"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  ...timestamps,
});

export const featureFlags = pgTable("feature_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(),
  description: text("description"),
  defaultEnabled: boolean("default_enabled").notNull().default(false),
  // Tenant/user/environment/percentage targeting rules — see MODULE-SYSTEM.md §7.
  targeting: jsonb("targeting").$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
}, (table) => [uniqueIndex("feature_flags_key_idx").on(table.key)]);

export const domains = pgTable("domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  hostname: text("hostname").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("domains_hostname_idx").on(table.hostname)]);

/** Platform-operator accounts — distinct from tenant business users owned by the identity module. */
export const platformUsers = pgTable("platform_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  // 'support' | 'admin' | 'owner'
  role: text("role").notNull().default("support"),
  ...timestamps,
}, (table) => [uniqueIndex("platform_users_email_idx").on(table.email)]);

/**
 * Web sessions — see ADR-0006 and DATABASE.md §2. Deliberately control-plane
 * (not tenant-DB), so a session resolves before any tenant database
 * connection is opened. userId references a user row inside the tenant's
 * own database — no cross-database foreign key is possible (or desired;
 * see DATABASE.md §1), so it is stored unenforced and resolved by the
 * identity module when needed.
 */
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  // SHA-256 hash of the opaque session token — the raw token is never stored, only held by the client cookie.
  tokenHash: text("token_hash").notNull(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  userId: uuid("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
  index("sessions_user_id_idx").on(table.userId),
]);
