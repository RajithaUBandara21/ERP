/**
 * Minimal structured JSON logger. No external dependency (e.g. pino) yet —
 * evaluated and deferred per CLAUDE.md §62 ("before adding a dependency"):
 * current needs are satisfied by leveled JSON-to-stdout logging, and this
 * module's public shape (Logger, LogContext) is what call sites depend on,
 * so swapping the implementation later does not touch call sites.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Fields every log line should carry when available — see docs/architecture/observability.md. */
export interface LogContext {
  requestId?: string;
  correlationId?: string;
  tenantId?: string;
  userId?: string;
  module?: string;
  operation?: string;
  durationMs?: number;
  status?: string | number;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(bindings: LogContext): Logger;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Fields that must never be logged, even if present on the context — see SECURITY.md §4. */
const REDACTED_KEYS = new Set([
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "cardNumber",
  "cvv",
]);

function redact(context: LogContext): LogContext {
  const result: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    result[key] = REDACTED_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : value;
  }
  return result;
}

function write(level: LogLevel, minLevel: LogLevel, message: string, context: LogContext): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;

  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    msg: message,
    ...redact(context),
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  // eslint-disable-next-line no-console -- this module IS the logging sink
  else console.log(line);
}

function createLoggerWithBindings(bindings: LogContext, minLevel: LogLevel): Logger {
  return {
    debug: (message, context) => write("debug", minLevel, message, { ...bindings, ...context }),
    info: (message, context) => write("info", minLevel, message, { ...bindings, ...context }),
    warn: (message, context) => write("warn", minLevel, message, { ...bindings, ...context }),
    error: (message, context) => write("error", minLevel, message, { ...bindings, ...context }),
    child: (childBindings) => createLoggerWithBindings({ ...bindings, ...childBindings }, minLevel),
  };
}

export function createLogger(options: { level?: LogLevel; bindings?: LogContext } = {}): Logger {
  return createLoggerWithBindings(options.bindings ?? {}, options.level ?? "info");
}

export { recordAuditEvent } from "./audit";
export type { AuditEvent } from "./audit";
