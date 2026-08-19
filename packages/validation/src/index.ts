import { z } from "zod";

export { z };

/** Tenant slugs are the subdomain label used for tenant hinting — see MULTI-TENANCY.md §6. */
export const tenantSlugSchema = z
  .string()
  .min(2)
  .max(63)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be a lowercase, hyphen-separated slug");

export const uuidSchema = z.string().uuid();

export const emailSchema = z.string().trim().toLowerCase().email();

/**
 * POS idempotency key format, e.g. "POS-TERM-001-20260819-000123" — see OFFLINE-POS.md §4.
 */
export const idempotencyKeySchema = z
  .string()
  .regex(/^[A-Z0-9]+-[A-Z0-9-]+-\d{8}-\d{6}$/, "must match TERMINAL-YYYYMMDD-sequence format");

export const paginationCursorSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** Consistent API error shape — see ARCHITECTURE.md §6 and CLAUDE.md §31. */
export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
});

export type TenantSlug = z.infer<typeof tenantSlugSchema>;
export type PaginationCursor = z.infer<typeof paginationCursorSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;

/**
 * Zod's `.optional()` types a parsed field as `T | undefined`, but under
 * `exactOptionalPropertyTypes` (tsconfig.base.json), passing an object with
 * an explicit `key: undefined` doesn't satisfy an interface declaring
 * `key?: T` — the key must be *absent*, not present-with-undefined. This
 * strips undefined-valued keys so a zod-parsed object can be spread
 * directly into a call expecting an optional-property interface, instead
 * of every call site hand-rolling `...(x ? { key: x } : {})`.
 *
 * The return type is a mapped type, not just `T` — a `T` alone would keep
 * `key: X | undefined` in the static type even though the value is removed
 * at runtime, which doesn't actually fix the exactOptionalPropertyTypes
 * error at call sites. This maps `{ key: X | undefined }` to `{ key?: X }`.
 */
type StripUndefined<T> = { [K in keyof T as undefined extends T[K] ? never : K]: T[K] } & {
  [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined>;
};

export function stripUndefined<T extends Record<string, unknown>>(input: T): StripUndefined<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as StripUndefined<T>;
}
