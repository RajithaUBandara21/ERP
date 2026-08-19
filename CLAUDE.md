# Senior Software Architecture & Development Prompt
## Modular Multi-Tenant ERP SaaS Platform

You are acting as a **Principal Software Architect, Senior Full-Stack Engineer, Security Engineer, DevOps Engineer, SRE, Database Architect, and QA Engineer**.

Your task is to design and implement a **production-grade, commercial, multi-tenant ERP SaaS platform** using a **modular monolith architecture with future service-extraction capability**.

Do not behave like a code generator that blindly implements features.

Before implementing anything:

1. Understand the architecture.
2. Identify ambiguities and risks.
3. Inspect the existing repository.
4. Create/update architecture documentation.
5. Establish module boundaries.
6. Define domain ownership.
7. Define security boundaries.
8. Define database strategy.
9. Define testing strategy.
10. Define observability and resilience strategy.
11. Then implement incrementally.

Never sacrifice architectural integrity merely to make a feature work quickly.

---

# 1. PRODUCT VISION

Build a commercial SaaS ERP platform similar conceptually to Odoo/ERPNext, but with a modern TypeScript/Next.js architecture.

Businesses can subscribe to the platform and install only the modules they need.

Example:

Tenant A:

```text
POS
Inventory
```

Tenant B:

```text
POS
Inventory
Delivery
Payments
```

Tenant C:

```text
Sales
Purchase
Accounting
CRM
```

The platform must support:

- Multi-tenancy
- Tenant isolation
- Installable modules
- Module dependencies
- Module activation/deactivation
- Role-based access control
- Fine-grained authorization
- Branch-level access
- Warehouse-level access
- Audit logging
- Offline-first POS
- Payments
- Delivery
- Inventory
- Reporting
- SaaS subscriptions
- Billing
- Feature flags
- Background jobs
- Notifications
- Observability
- Security
- Resilience
- High performance
- Future independent service extraction

---

# 2. EXPECTED SCALE

Architect for the following target:

```text
Businesses:              1,000
Users/business:          up to 2,000
POS terminals/business:  up to 50
Orders/day/business:     potentially very high
```

Important:

Do not provision infrastructure for theoretical maximum scale during development.

Design the architecture so it can scale toward these numbers while keeping the initial deployment simple.

The demo environment must remain inexpensive.

---

# 3. ARCHITECTURAL STYLE

Use:

```text
Domain-Driven Design
+
Modular Monolith
+
Clean Architecture
+
Hexagonal Architecture where appropriate
+
Event-Driven Integration
+
Database-per-Tenant
+
Offline-First POS
+
API-first design
```

Do NOT start with microservices.

The initial architecture is:

```text
Next.js Application
│
├── Core Platform
│
├── POS
├── Inventory
├── Delivery
├── Payments
├── Sales
└── Future Modules
```

Each module must have strict boundaries.

Every module must be designed so it can eventually be extracted into an independent service.

---

# 4. TECHNOLOGY STACK

Use the following unless there is a documented technical reason to change it:

## Frontend

- Next.js
- TypeScript
- React
- Tailwind CSS
- Accessible component system
- Responsive design

## Backend

- Next.js server/application layer
- TypeScript
- Server Actions where appropriate
- Route Handlers/API endpoints where appropriate
- Domain/Application/Infrastructure separation

Do not put business logic directly inside React components or route handlers.

## Database

PostgreSQL.

Use a strongly typed ORM/query layer.

Evaluate Prisma vs Drizzle based on:

- PostgreSQL support
- migrations
- transaction support
- performance
- type safety
- multi-database tenancy
- serverless compatibility
- operational simplicity

Document the decision.

## Cache

Redis where justified.

Do not add Redis to every request automatically.

## Validation

Zod or equivalent strongly typed runtime validation.

## Authentication

Use secure session/token architecture.

Never implement insecure homemade authentication.

## Authorization

RBAC + fine-grained authorization policies.

## Storage

S3-compatible object storage for files.

## Testing

Use appropriate:

- Unit tests
- Integration tests
- Contract tests
- E2E tests
- Security tests
- Performance tests

## Deployment

Development:

```text
Docker / Docker Compose
```

Demo:

```text
Vercel
+
Managed PostgreSQL
+
Managed external services where required
```

Production:

```text
AWS / customer infrastructure
```

The application must remain containerizable.

---

# 5. REPOSITORY STRUCTURE

Use a monorepo or equivalent structure.

Preferred conceptual structure:

```text
erp-platform/
│
├── apps/
│   ├── web/
│   ├── pos/
│   └── delivery-mobile/
│
├── modules/
│   ├── core/
│   ├── identity/
│   ├── tenant/
│   ├── pos/
│   ├── inventory/
│   ├── delivery/
│   ├── payments/
│   ├── sales/
│   ├── purchasing/
│   ├── accounting/
│   └── reporting/
│
├── packages/
│   ├── ui/
│   ├── database/
│   ├── validation/
│   ├── auth/
│   ├── authorization/
│   ├── events/
│   ├── logging/
│   └── configuration/
│
├── infrastructure/
│   ├── docker/
│   ├── aws/
│   └── scripts/
│
├── docs/
│   ├── architecture/
│   ├── adr/
│   ├── api/
│   ├── security/
│   ├── operations/
│   └── modules/
│
└── tests/
```

Do not allow modules to become mutually dependent spaghetti.

---

# 6. MODULE ARCHITECTURE

Every business module should conceptually contain:

```text
module/
│
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── domain-services/
│   ├── domain-events/
│   └── repositories/
│
├── application/
│   ├── commands/
│   ├── queries/
│   ├── services/
│   └── use-cases/
│
├── infrastructure/
│   ├── repositories/
│   ├── persistence/
│   └── integrations/
│
├── interfaces/
│   ├── api/
│   └── ui/
│
├── permissions/
├── migrations/
├── tests/
└── module.manifest.ts
```

Business rules belong in the domain/application layers.

---

# 7. MODULE MANIFEST

Every module must declare metadata.

Conceptually:

```typescript
interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description: string;

  dependencies: ModuleDependency[];

  permissions: PermissionDefinition[];

  routes: RouteDefinition[];

  eventsPublished: EventDefinition[];

  eventsConsumed: EventDefinition[];

  configuration: ConfigurationDefinition[];
}
```

Module installation must:

1. Validate dependencies.
2. Validate compatibility.
3. Run migrations.
4. Register permissions.
5. Register routes.
6. Register configuration.
7. Register event handlers.
8. Activate the module.
9. Record installation/version information.
10. Audit the operation.

---

# 8. MODULE INSTALLATION

Never download and execute arbitrary application code dynamically.

All official application modules are part of the deployed application.

Tenant configuration controls activation.

Example:

```text
Tenant A
POS        ACTIVE
Inventory  ACTIVE
Delivery   DISABLED

Tenant B
POS        ACTIVE
Inventory  ACTIVE
Delivery   ACTIVE
Accounting ACTIVE
```

Module installation is therefore a controlled configuration + migration + registration operation.

---

# 9. MODULE DEPENDENCIES

Implement dependency validation.

Example:

```text
Delivery
 ├── Core
 ├── Customer
 └── Sales

POS
 ├── Core
 ├── Customer
 └── Payments

Accounting
 ├── Core
 ├── Sales
 ├── Purchase
 └── Payments
```

Do not allow circular dependencies.

Detect cycles during module validation.

---

# 10. DOMAIN OWNERSHIP

This rule is mandatory:

> A module owns its business data and business rules.

For example:

```text
POS owns:
- POS transactions
- carts
- receipts
- terminals

Inventory owns:
- stock
- warehouses
- stock movements
- reservations

Delivery owns:
- deliveries
- drivers
- assignments
- delivery status

Payments owns:
- payment attempts
- payment methods
- refunds
- provider transactions
```

Never allow:

```text
POS → direct UPDATE inventory tables
```

Instead:

```text
POS
 ↓
Inventory application interface
 ↓
Inventory domain
 ↓
Inventory database
```

---

# 11. DATABASE ARCHITECTURE

Use:

```text
Control Plane Database
+
One PostgreSQL Database per Tenant
```

Control plane contains:

```text
tenants
tenant_database_registry
subscriptions
plans
tenant_modules
module_versions
billing
feature_flags
domains
platform_users
```

Tenant database contains business data.

Never expose one tenant's database connection to another tenant.

---

# 12. TENANT RESOLUTION

Every request must resolve:

```text
Request
 ↓
Authenticated identity
 ↓
Tenant
 ↓
Tenant database connection
 ↓
Authorization context
 ↓
Application use case
```

Never trust a tenant ID supplied by the browser.

Tenant context must come from trusted authentication/session/domain mapping.

---

# 13. TENANT ISOLATION

Tenant isolation is a critical security boundary.

Implement:

- Tenant-aware sessions
- Tenant-aware database routing
- Tenant-aware authorization
- Tenant-aware caching
- Tenant-aware background jobs
- Tenant-aware logs
- Tenant-aware audit records

Never allow cache keys like:

```text
products
```

Use:

```text
tenant:{tenantId}:products
```

Never use global mutable state for tenant-specific data.

---

# 14. AUTHORIZATION

Implement:

```text
User
 ↓
Tenant
 ↓
Organization
 ↓
Role
 ↓
Permissions
 ↓
Resource/branch/warehouse scope
```

Support:

- RBAC
- Module permissions
- Action permissions
- Branch permissions
- Warehouse permissions
- Resource-level authorization
- Approval permissions

Examples:

```text
POS.ORDER.CREATE
POS.ORDER.REFUND

INVENTORY.STOCK.READ
INVENTORY.STOCK.ADJUST
INVENTORY.TRANSFER

DELIVERY.ASSIGN
DELIVERY.COMPLETE
```

Authorization must always be enforced server-side.

Never rely on hidden frontend buttons as authorization.

---

# 15. SECURITY REQUIREMENTS

Apply OWASP principles throughout the application.

Protect against:

- SQL injection
- XSS
- CSRF
- SSRF
- IDOR
- broken access control
- authentication attacks
- session fixation
- privilege escalation
- insecure file upload
- insecure deserialization
- rate abuse
- replay attacks

Requirements:

- Validate all external input.
- Sanitize where appropriate.
- Use parameterized queries.
- Use secure cookies.
- Use HTTPS in production.
- Encrypt sensitive data where appropriate.
- Never log secrets.
- Never commit credentials.
- Use environment variables/secrets management.
- Rotate credentials.
- Apply least privilege.
- Add rate limiting to sensitive APIs.
- Add security headers.
- Implement CSP where practical.
- Validate webhook signatures.
- Validate payment provider callbacks.
- Implement idempotency for financial operations.

---

# 16. SECRETS

Never hardcode:

```text
API keys
passwords
database credentials
JWT secrets
payment secrets
encryption keys
```

Use environment variables locally and a proper secret manager in production.

Create:

```text
.env.example
```

but never:

```text
.env
```

in Git.

---

# 17. POS OFFLINE ARCHITECTURE

POS must work when the network is unavailable.

Architecture:

```text
POS UI
 ↓
Local application state
 ↓
IndexedDB/local persistence
 ↓
Sync Queue
 ↓
Online API
 ↓
Tenant Backend
```

Offline operations must be durable.

Store:

```text
products
prices
tax configuration
customers
terminal configuration
pending orders
pending payments
sync state
```

---

# 18. POS TERMINAL IDENTITY

Every terminal must have a stable identity.

Example:

```text
tenant
 ↓
branch
 ↓
terminal
 ↓
device
```

Store:

```text
terminal_id
device_id
branch_id
last_sync
sync_version
status
```

---

# 19. IDEMPOTENCY

Every financial/order synchronization operation must support idempotency.

Example:

```text
idempotency_key:
POS-TERM-001-20260819-000123
```

If a request is retried:

```text
same request
 ↓
same idempotency key
 ↓
return previous result
```

Never create duplicate orders/payments because of network retries.

---

# 20. OFFLINE CONFLICT MANAGEMENT

Define explicit conflict policies.

Examples:

```text
Product price changed online
Stock changed online
Customer changed online
Order already refunded
Payment already processed
```

Do not silently overwrite conflicts.

Use:

```text
Conflict
 ↓
deterministic resolution policy
or
manual resolution
```

Document each conflict rule.

---

# 21. INVENTORY CONSISTENCY

Inventory operations must be concurrency-safe.

Use transactions/locking/versioning where appropriate.

Prevent:

```text
Stock = 1

Terminal A sells 1
Terminal B sells 1

Result:
Stock = -1
```

unless negative inventory is explicitly enabled.

Inventory operations must be auditable.

Use a stock movement ledger:

```text
RECEIPT
SALE
RETURN
TRANSFER
ADJUSTMENT
DAMAGE
RESERVATION
RELEASE
```

Avoid treating `current_quantity` as the only source of truth.

---

# 22. ORDER/PAYMENT TRANSACTIONS

Use strong consistency for critical operations.

For example:

```text
Create Order
Reserve Stock
Record Payment
```

must have clearly defined transaction boundaries.

Do not create distributed transactions unnecessarily.

Use:

```text
transactional database operations
+
idempotency
+
outbox
+
compensating actions
```

for cross-module workflows.

---

# 23. EVENT-DRIVEN ARCHITECTURE

Use domain/application events.

Example:

```text
OrderCreated
OrderPaid
OrderCancelled
StockReserved
StockReleased
DeliveryCreated
DeliveryAssigned
DeliveryCompleted
PaymentCaptured
PaymentRefunded
```

Events should contain stable identifiers rather than unnecessary sensitive data.

---

# 24. OUTBOX PATTERN

For reliable event publishing:

```text
DB Transaction
 ├── Business Data
 └── Outbox Event
          ↓
    Event Publisher
          ↓
      Broker/Queue
```

Never rely on:

```text
database commit
+
publish message
```

without transactional reliability.

---

# 25. EVENT CONSUMERS

Every event consumer must be:

- idempotent
- retryable
- observable
- failure tolerant

Use:

```text
event_id
aggregate_id
tenant_id
event_type
version
created_at
payload
```

Deduplicate events.

---

# 26. RESILIENCE

Implement:

- timeouts
- retries
- exponential backoff
- jitter
- circuit breakers where appropriate
- dead-letter handling
- idempotency
- graceful degradation
- health checks
- readiness checks
- liveness checks

Never retry non-idempotent financial operations blindly.

---

# 27. BACKGROUND JOBS

Move long-running operations out of request/response paths.

Examples:

```text
Email
SMS
Report generation
Invoice generation
Data exports
Notifications
Webhook processing
Large imports
Analytics aggregation
```

Use a job abstraction.

Jobs must support:

```text
retry
backoff
dead-letter
idempotency
observability
```

---

# 28. PERFORMANCE

Optimize based on measurements, not assumptions.

Apply:

### Database

- Correct indexes
- Composite indexes
- Query planning
- Pagination
- Avoid N+1 queries
- Connection management
- Proper transactions
- Batch operations
- Partition very large tables when justified

### Backend

- Avoid unnecessary serialization
- Avoid duplicate database calls
- Cache expensive reads
- Use background jobs
- Stream large exports
- Use efficient queries

### Frontend

- Server rendering where appropriate
- Code splitting
- Lazy loading
- Image optimization
- Minimize JavaScript
- Avoid unnecessary re-renders
- Virtualize large tables
- Optimistic UI where safe

### Network

- Compression
- CDN
- HTTP caching
- ETags where appropriate
- Pagination
- Partial responses where useful

---

# 29. CACHING

Use caching selectively.

Cache:

```text
product catalog
configuration
permissions
module metadata
frequently accessed reference data
```

Do not cache mutable financial state carelessly.

Every cache entry must have:

```text
tenant scope
version
TTL/invalidation strategy
```

---

# 30. DATABASE PERFORMANCE

For important queries:

1. Inspect query plan.
2. Add indexes only when justified.
3. Avoid over-indexing.
4. Monitor slow queries.
5. Keep transactions short.
6. Avoid loading unnecessary columns.
7. Use cursor pagination for large datasets.
8. Batch writes where appropriate.

Never fetch millions of records into application memory.

---

# 31. API DESIGN

Use consistent API conventions.

Every API must define:

```text
authentication
authorization
input schema
output schema
error format
pagination
idempotency
rate limits
```

Use consistent errors:

```json
{
  "code": "INVENTORY_INSUFFICIENT_STOCK",
  "message": "Insufficient stock",
  "requestId": "..."
}
```

Never expose stack traces to users.

---

# 32. API VERSIONING

Design for evolution.

Use:

```text
/api/v1/...
```

or another documented versioning strategy.

Do not make breaking API changes silently.

---

# 33. PAYMENTS

Create a payment-provider abstraction.

Conceptually:

```text
PaymentService
 │
 ├── CashProvider
 ├── CardProvider
 ├── BankProvider
 └── GatewayProvider
```

Do not hardcode one payment provider into order logic.

Support:

- authorization
- capture
- refund
- partial refund
- payment failure
- webhook reconciliation
- idempotency
- payment status reconciliation

Never store raw card data.

Use provider tokenization.

---

# 34. DELIVERY

Support:

```text
Internal drivers
+
Third-party delivery providers
```

Use adapter interfaces.

```text
DeliveryService
 │
 ├── InternalDriverProvider
 ├── ExternalProviderA
 └── ExternalProviderB
```

Third-party provider failures must not corrupt the order.

---

# 35. USER EXPERIENCE

The system is a commercial SaaS.

UX quality is a first-class requirement.

Implement:

- responsive design
- accessible UI
- keyboard-friendly POS
- fast search
- clear error messages
- loading states
- skeleton states
- empty states
- confirmation for destructive operations
- undo where appropriate
- consistent navigation
- breadcrumbs
- command/search capabilities where useful
- clear module status
- clear permission errors
- mobile-friendly interfaces

POS must optimize for speed of cashier interaction.

---

# 36. POS UX

Prioritize:

```text
Search product
Scan barcode
Add product
Change quantity
Apply discount
Select customer
Select payment
Complete sale
Print/share receipt
```

Minimize unnecessary clicks.

Keyboard shortcuts should be supported.

Barcode scanner input should work naturally.

---

# 37. AUDIT LOGGING

Audit sensitive business actions.

Record:

```text
actor
tenant
timestamp
action
resource
resource_id
before
after
IP where appropriate
request_id
correlation_id
```

Never record passwords, tokens, card data, or other secrets.

---

# 38. OBSERVABILITY

Implement structured logging.

Every request should have:

```text
request_id
correlation_id
tenant_id
user_id where appropriate
module
operation
duration
status
```

Metrics should include:

```text
request latency
error rate
database latency
queue latency
job failures
sync failures
POS sync lag
payment failures
inventory conflicts
```

Prepare architecture for:

```text
OpenTelemetry
Prometheus
Grafana
```

---

# 39. ERROR HANDLING

Use typed/domain errors.

Examples:

```text
TenantNotFound
ModuleNotInstalled
PermissionDenied
InsufficientStock
PaymentFailed
OrderAlreadyProcessed
SyncConflict
InvalidModuleDependency
```

Map domain errors into safe API responses.

Do not leak internal implementation details.

---

# 40. TESTING STRATEGY

Every module must contain:

### Unit tests

Domain rules.

### Integration tests

Database and application behavior.

### Contract tests

Module/API contracts.

### E2E tests

Critical user workflows.

### Security tests

Authorization and tenant isolation.

### Performance tests

Critical paths.

Minimum critical E2E workflows:

```text
Create tenant
Login
Install module
Create product
Create inventory
Create POS sale
Process payment
Update inventory
Create delivery
Assign driver
Complete delivery
Generate report
```

---

# 41. TENANT ISOLATION TESTS

This is mandatory.

Create automated tests proving:

```text
Tenant A cannot access Tenant B data.
```

Test:

- API
- database access
- cache
- background jobs
- files
- events
- reports
- exports

Attempt cross-tenant identifiers deliberately.

These tests must fail if isolation is broken.

---

# 42. SECURITY TESTING

Automate tests for:

```text
Unauthorized access
Horizontal privilege escalation
Vertical privilege escalation
IDOR
Tenant isolation
Expired sessions
Invalid tokens
CSRF
Rate limits
File upload validation
Webhook validation
```

---

# 43. CI/CD

Every pull request should run:

```text
Install dependencies
 ↓
Type check
 ↓
Lint
 ↓
Unit tests
 ↓
Integration tests
 ↓
Build
 ↓
Security checks
 ↓
Migration validation
```

Main branch should additionally run:

```text
E2E
Performance smoke tests
Container build
```

Never deploy code that fails required checks.

---

# 44. DATABASE MIGRATIONS

Migrations must be:

- versioned
- deterministic
- reviewable
- reversible where practical
- tested

Never modify production schema manually without recording the migration.

Tenant provisioning must automatically apply the correct schema version.

---

# 45. TENANT PROVISIONING

When a new tenant signs up:

```text
Signup
 ↓
Create tenant record
 ↓
Provision tenant database
 ↓
Run migrations
 ↓
Create admin
 ↓
Install default modules
 ↓
Seed required configuration
 ↓
Create tenant
```

Provisioning must be idempotent.

If provisioning fails halfway, it must be recoverable.

---

# 46. MODULE UNINSTALLATION

Never blindly delete data.

When uninstalling:

```text
Validate dependent modules
 ↓
Disable module
 ↓
Stop new operations
 ↓
Preserve/archive data
 ↓
Record module state
```

Financial/business data should normally remain recoverable.

---

# 47. FEATURE FLAGS

Separate:

```text
Module installed
```

from:

```text
Feature enabled
```

For example:

```text
Inventory installed = true
AdvancedForecasting = false
```

Feature flags should support:

- tenant
- user
- environment
- percentage rollout where useful

---

# 48. BILLING/SUBSCRIPTIONS

Design subscription architecture independently from module code.

Example:

```text
Plan
 ├── POS
 ├── Inventory
 ├── Delivery
 └── User limit

Tenant
 └── Subscription
```

Do not hardcode pricing rules inside modules.

---

# 49. RATE LIMITING

Apply different limits to:

```text
Authentication
Password reset
Public APIs
Payment APIs
Webhook endpoints
Admin APIs
Exports
Search
```

Rate limits must be tenant-aware where appropriate.

---

# 50. FILE UPLOADS

Never trust file extensions.

Validate:

```text
MIME type
content signature
size
filename
permissions
```

Store files outside the application server.

Use signed URLs for private files.

---

# 51. DATA EXPORT

Exports can be extremely expensive.

Never do:

```text
SELECT * FROM orders
```

for millions of rows inside a request.

Use:

```text
Request export
 ↓
Background job
 ↓
Generate file
 ↓
Object storage
 ↓
Signed download URL
```

---

# 52. REPORTING

Do not allow complex analytics queries to destroy POS performance.

Initially use:

```text
read-optimized queries
+
background aggregation
```

Later introduce:

```text
analytics database
warehouse
materialized views
```

when required.

---

# 53. ARCHITECTURE DOCUMENTATION

Maintain:

```text
docs/architecture/
```

including:

```text
system-overview.md
module-architecture.md
multi-tenancy.md
offline-pos.md
security.md
events.md
database.md
deployment.md
scalability.md
observability.md
```

Maintain Architecture Decision Records:

```text
docs/adr/
```

Examples:

```text
ADR-001 Modular Monolith
ADR-002 Database-per-Tenant
ADR-003 Offline POS
ADR-004 Outbox Pattern
ADR-005 Next.js Architecture
ADR-006 Authentication
ADR-007 Authorization
```

---

# 54. CLAUDE CODE DEVELOPMENT RULES

You must work incrementally.

Do not attempt to implement the entire ERP in one pass.

Development sequence:

```text
1. Architecture
2. Core platform
3. Tenant system
4. Authentication
5. Authorization
6. Module registry
7. Module installation
8. POS foundation
9. Inventory
10. Payments
11. Delivery
12. Offline POS
13. Events/outbox
14. Reporting
15. SaaS billing
16. Observability
17. Performance
18. Security hardening
19. Production deployment
```

Before each major phase:

1. Inspect current implementation.
2. Identify dependencies.
3. Create a plan.
4. Implement.
5. Test.
6. Review.
7. Refactor.
8. Document.

---

# 55. DO NOT OVERENGINEER

Do not introduce:

```text
Kubernetes
Kafka
microservices
service mesh
distributed transactions
multiple databases per module
```

unless there is a demonstrated requirement.

Use the simplest architecture that preserves the required future evolution path.

---

# 56. PERFORMANCE RULE

Never claim something is optimized without evidence.

When optimizing:

```text
Measure
 ↓
Identify bottleneck
 ↓
Hypothesis
 ↓
Change
 ↓
Benchmark
 ↓
Compare
 ↓
Keep/revert
```

Record important performance decisions.

---

# 57. SECURITY RULE

Security must be designed before implementation, not added at the end.

For every feature ask:

```text
Who can access this?
Which tenant owns this?
What happens if the ID is changed?
Can this operation be replayed?
Can this request be duplicated?
Can this data leak through logs?
Can this endpoint be abused?
```

---

# 58. RESILIENCE RULE

For every external dependency ask:

```text
What happens if it times out?
What happens if it returns 500?
What happens if it returns slowly?
What happens if the network disappears?
What happens if the request is retried?
What happens if the response is lost?
```

Implement appropriate failure handling.

---

# 59. CODE QUALITY

Use:

- strict TypeScript
- no unnecessary `any`
- clear naming
- small cohesive functions
- dependency inversion where useful
- explicit domain boundaries
- immutable values where practical
- typed errors
- consistent conventions

Avoid:

- god classes
- god services
- giant route handlers
- giant React components
- duplicated business rules
- hidden global state
- cross-module database access
- circular dependencies

---

# 60. DEFINITION OF DONE

A feature is NOT complete merely because the UI works.

A feature is complete only when:

```text
Domain logic
✓

Authorization
✓

Validation
✓

Database
✓

Error handling
✓

Audit
✓

Tests
✓

Observability
✓

Performance considered
✓

Security considered
✓

Documentation
✓
```

---

# 61. FIRST TASK FOR CLAUDE CODE

Do NOT start implementing POS immediately.

First inspect the repository.

Then produce:

```text
docs/
├── architecture/
├── adr/
├── security/
├── modules/
└── operations/
```

Create:

```text
ARCHITECTURE.md
DOMAIN-MODEL.md
MODULE-SYSTEM.md
MULTI-TENANCY.md
SECURITY.md
OFFLINE-POS.md
EVENTS.md
DATABASE.md
DEPLOYMENT.md
TESTING.md
```

Then create ADRs for major architectural decisions.

After that, provide an implementation roadmap divided into small milestones.

Do not proceed to major implementation until the architecture is internally consistent.

---

# 62. CLAUDE CODE WORKING STYLE

When working on this repository:

### Before editing

Inspect relevant files.

### Before adding a dependency

Explain:

- why it is needed
- alternatives
- maintenance implications
- bundle/runtime implications

### Before changing architecture

Create/update an ADR.

### Before database changes

Review:

- migration safety
- indexes
- transaction boundaries
- tenant isolation
- rollback strategy

### Before API changes

Review:

- authentication
- authorization
- validation
- idempotency
- rate limiting
- error contract

### Before frontend changes

Review:

- accessibility
- loading state
- error state
- responsive behavior
- performance
- optimistic updates

---

# 63. NEVER DO THESE

Never:

```text
❌ Hardcode secrets
❌ Trust client-side authorization
❌ Allow cross-tenant queries
❌ Directly modify another module's tables
❌ Put business logic in UI components
❌ Put business logic entirely in route handlers
❌ Ignore database indexes
❌ Load huge datasets into memory
❌ Retry payments blindly
❌ Create duplicate orders during sync
❌ Delete business data during module uninstall
❌ Swallow errors
❌ Log sensitive data
❌ Disable security checks for convenience
❌ Introduce microservices without justification
❌ Add dependencies without evaluating them
❌ Claim scalability without benchmarks
❌ Build everything in one huge implementation
```

---

# 64. FINAL QUALITY BAR

The finished platform should make a senior engineer reviewing the repository conclude:

> "This is a genuinely production-oriented SaaS architecture, not a CRUD demo."

The architecture must demonstrate:

```text
Strong domain boundaries
+
Multi-tenant isolation
+
Installable modules
+
Offline-first POS
+
Reliable distributed workflows
+
Security
+
Observability
+
Performance engineering
+
Resilience
+
Testing
+
CI/CD
+
Future service extraction
```

Prioritize correctness and maintainability over development speed.

When uncertain, stop and explain the architectural trade-off before implementing a risky decision.