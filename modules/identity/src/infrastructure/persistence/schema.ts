/**
 * Tenant-DB-side schema — applied to each tenant's own database (see
 * DOMAIN-MODEL.md §6, docs/modules/tenant.md, and DATABASE.md §5: "one
 * schema, many physical databases"). Applied via
 * @erp/database's runTenantMigrations, invoked by applyIdentityMigrations
 * (src/index.ts) — a stand-in for Phase 6's general module-installation
 * migration step (MODULE-SYSTEM.md §3).
 */
import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Flat permission strings, e.g. "IDENTITY.USER.LIST", or "*" for all — see packages/authorization.
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  isSystemRole: boolean("is_system_role").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("roles_name_idx").on(table.name)]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  // 'active' | 'disabled'
  status: text("status").notNull().default("active"),
  roleId: uuid("role_id").notNull().references(() => roles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("users_email_idx").on(table.email)]);
