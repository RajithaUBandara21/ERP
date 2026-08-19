# Observability

Not duplicated at the top level — see [ARCHITECTURE.md](../../ARCHITECTURE.md) for the overall system design this document instruments.

## Structured logging (CLAUDE.md §38)

Every request log entry includes:

```text
request_id, correlation_id, tenant_id, user_id (where appropriate),
module, operation, duration, status
```

`correlation_id` threads through synchronous application-interface calls and asynchronous event consumption for the same logical workflow (e.g. a POS sale and the accounting ledger entry it triggers share a `correlation_id` even though they run in different transactions/processes).

## Metrics

```text
request latency, error rate, database latency, queue latency,
job failures, sync failures, POS sync lag, payment failures, inventory conflicts
```

Metrics are tenant-labeled where cardinality permits (aggregated/sampled otherwise, to avoid unbounded label cardinality at 1,000+ tenants).

## Target stack

The architecture is prepared for **OpenTelemetry** instrumentation feeding **Prometheus** metrics and **Grafana** dashboards — introduced starting Phase 16 (Observability) once there is real request/job traffic to instrument. Application code is written with this in mind from Phase 2 onward (structured logger interface in `packages/logging`, request context propagation) even though the metrics backend itself is not wired up until Phase 16.

## Health/readiness/liveness

Every deployable app exposes:

- **Liveness** — process is up and able to serve (no dependency checks).
- **Readiness** — process can serve real traffic (control-plane DB reachable at minimum; tenant DB reachability is not a global readiness gate, since one unreachable tenant database must not take down the whole application).
- **Health** — a fuller diagnostic endpoint for operator/monitoring use (not exposed publicly with implementation detail — CLAUDE.md §31 "never expose stack traces to users" applies here too).

## Relationship to resilience

Observability exists to make the resilience behaviors described in [ARCHITECTURE.md](../../ARCHITECTURE.md) (timeouts, retries, circuit breakers, dead-letter handling) *verifiable* — e.g. "payment failures" and "sync failures" metrics are what would surface a circuit breaker tripping, rather than that being discovered only via customer reports.
