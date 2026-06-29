# Zenvix API — Conventions & Foundations

> The shared contract every endpoint follows. Read this first; the per-module
> references assume everything here.

## Base URLs

| Environment | Frontend | Backend API |
|-------------|----------|-------------|
| Production VPS | `http://150.109.15.108:3010` | `http://150.109.15.108:3001` |

**All backend routes are versioned under `/v1`.** A controller declared as
`@Controller('finance')` with a `@Get('ledger')` handler is reachable at:

```
GET http://150.109.15.108:3001/v1/finance/ledger
```

The frontend calls the same paths through its `apiClient`, which prepends `/v1`.
(Some specs/tests use an `/api` prefix via a dev proxy — on the live server the
canonical prefix is `/v1`.)

## Authentication

Authentication is JWT bearer-token based. Obtain a token from the login endpoint:

```
POST /v1/auth/login
Body: { "email": "...", "password": "..." }
Response: { "token": "<jwt>", "user": {...}, ... }   // HTTP 201
```

Attach the token plus tenant-scoping headers on every authenticated request.

### Required Headers

| Header | Required | Purpose |
|--------|----------|---------|
| `Authorization: Bearer <jwt>` | yes (except public/auth routes) | Identifies the user |
| `Content-Type: application/json` | on POST/PUT/PATCH | Body encoding |
| `x-tenant-id` | yes | Tenant scope (e.g. `tnt-3rlhko`) |
| `x-company-id` | most core modules | Company scope within tenant |
| `x-location-id` | retail/inventory ops | Branch/store scope |
| `x-branch-id` | branch-gated tables | Stock/retail tables |

> **Identity is server-verified.** The `TenantInterceptor` re-derives the real
> tenant/user/role from the JWT and populates `request.tenantContext`. Headers
> are a scope hint, not a trust source — you cannot impersonate another tenant
> by changing `x-tenant-id` with someone else's token (returns 401/403/404).

### Routes excluded from the tenant middleware

These work without the tenant headers (see `app.module.ts` exclusions):

```
auth/*            v1/auth/*
retail/public/*   v1/retail/public/*
retail/events     monitoring/*
inventory/images/*
```

## Response Envelopes

Two shapes appear across the codebase:

**1. Success envelope (most core modules):**
```json
{ "success": true, "tenant_id": "...", "count": 12, "data": [ ... ] }
```

**2. Bare resource (some shared modules — comms mail, reporting):**
```json
{ "id": "...", "status": "PENDING", ... }
```

When asserting in tests, accept `body.data ?? body` and check the HTTP status
as the primary signal.

## Error Format (RFC 7807)

Every error flows through `Rfc7807ExceptionFilter` and looks like:

```json
{
  "type": "https://zenvix.io/errors/bad-request",
  "title": "Bad Request",
  "status": 400,
  "detail": "Validation failed",
  "instance": "/v1/finance/coa",
  "errors": [ { "field": "accountCode", "message": "accountCode should not be empty" } ],
  "timestamp": "2026-06-29T12:00:49.561Z"
}
```

### Status code mapping (Prisma → HTTP)

Service/repository code maps DB errors via `mapPrismaError`:

| Prisma code | Meaning | HTTP |
|-------------|---------|------|
| P2025 | record not found | 404 Not Found |
| P2002 | unique constraint | 409 Conflict |
| P2003 | foreign key violation | 400 Bad Request |
| P2000 | value too long | 400 Bad Request |
| (other) | unexpected | 500 (logged) |

`GlobalValidationPipe` (class-validator) produces `400` with an `errors[]` array
for DTO validation failures.

## Roles

`UserRole` values used by `@Roles(...)` guards:

```
SUPERADMIN  OWNER  COMPANY_ADMIN/ADMIN  FINANCE_ADMIN/FINANCE_HOD
MANAGER  MEMBER  STAFF  SPG (retail sales)
```

Role gating examples:
- `POST /v1/reporting/generate` → ADMIN, OWNER only
- `POST /v1/finance/coa` → ADMIN, OWNER
- `POST /v1/sales/leads` → ADMIN, MANAGER, MEMBER
- Retail operational (POS/shift) → SPG + above

## Pagination

List endpoints accept `?page=1&pageSize=20` (via `PaginationPipe`). Paginated
responses use either `{ data, total }` or `{ data, totalCount, currentPage,
pageSize, totalPages }`.

## Idempotency

Mutating retail/finance endpoints accept a correlation/idempotency key
(`correlationId` on the client → `x-request-id` / body field) so retried POSTs
(e.g. POS checkout) don't double-commit.

## Module activation

Most core modules are guarded by `ModuleStateGuard` + `@RequiredModule("<id>")`.
If a module isn't activated for the tenant, endpoints return **403**. Activate via:

```
POST /v1/license/toggle/<moduleCode>   Body: { "enabled": true }
```
