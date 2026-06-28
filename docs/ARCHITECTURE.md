# Architecture Reference

## System Design

Zenvix follows a modular monolith pattern with clear separation between:

- **Core Platform** — Always-available departments (Finance, HR, Procurement, Inventory, Warehouse, IT, Sales, Marketing)
- **Industry Modules** — Domain-specific extensions (Retail Operations)
- **Shared Infrastructure** — Auth, permissions, notifications, audit logging

## Frontend Architecture

### Routing

```
/auth/login          → Login page
/auth/register       → Registration
/auth/onboarding     → Company provisioning wizard

/core/*              → CoreLayout (main sidebar + department workspaces)
/core/dashboard      → Main dashboard
/core/finance/*      → Finance workspace
/core/hr/*           → HR workspace
/core/procurement/*  → Procurement workspace
/core/inventory/*    → Inventory workspace
/core/warehouse/*    → Warehouse workspace
/core/it/*           → IT workspace
/core/sales/*        → Sales workspace
/core/marketing/*    → Marketing workspace
/core/tools/*        → WorkSuite tools
/core/settings/*     → System settings

/m/retail/*          → RetailRootLayout (dual-mode: management + operational)
/m/retail/workspace              → Retail home (app grid)
/m/retail/management/*           → Store governance, staff, pricing
/m/retail/operational/*          → POS, scanners, shift terminals
```

### Module System

Modules are registered at bootstrap in `src/modules/moduleBundle.ts`. Each module implements the `ModuleContract` interface defined in `src/modules/shared/contract.ts`:

```typescript
interface ModuleContract {
  id: ModuleId;
  name: string;
  category: "core" | "industry";
  getPages(config): ModulePageDefinition[];
  getDefaultConfig(): ModuleConfig;
  validateConfig(config): ModuleConfigValidationResult;
}
```

Key files:
- `src/core/runtime/moduleRegistry.ts` — Static registry (immutable after bootstrap)
- `src/core/runtime/moduleRoutes.tsx` — Derives `<Route>` elements from module contracts
- `src/core/runtime/moduleResolver.ts` — Resolves visible pages per tenant context
- `src/core/runtime/navigationResolver.ts` — Builds navigation tree with permission enforcement

### Retail Module (Always Active)

The retail module (`src/modules/retail/index.tsx`) declares 30+ pages split into:
- **Management Plane** — Dashboards, store profiles, staff, pricing, fulfillment
- **Operational Plane** — POS cashier, refund desk, stock opname, shift terminals

It uses `RetailRootLayout` which detects the URL path to switch between management and operational shells.

### Warehouse (Under Retail)

Warehouse pages live under `/core/warehouse/*` (standard core routing) but are navigable from:
- Main sidebar → "Retail & Warehouse" section
- Retail management shell → "WAREHOUSE" sidebar section
- Retail home workspace → "Warehouse" app grid

### Layouts

| Layout | Path | Purpose |
|--------|------|---------|
| `CoreLayout` | `/core/*` | Main sidebar + header + outlet |
| `ModuleLayout` | `/m/:moduleId/*` | Minimal shell for industry modules |
| `RetailRootLayout` | `/m/retail/*` | Dual-mode (management/operational) |
| Department workspace layouts | `/core/<dept>/*` | Secondary nav for each department |

### State Management

- **AuthContext** — JWT token, user profile, session (tenant/company/location)
- **AppContext** — Cart, shift, settings, theme, online status
- **RetailContext** — Active store, channel, retail mode (management/operational)

### Security

- JWT auth stored in localStorage (`ZENVIX_TOKEN`, `ZENVIX_SESSION`)
- Permission-based route protection via `<ProtectedRoute>` wrapper
- Role hierarchy: SUPERADMIN > OWNER > ADMIN > MANAGER > STAFF > SPG

## Backend Architecture

### Stack

- NestJS 11 (modular, with decorators and DI)
- Prisma ORM with PostgreSQL 16
- JWT authentication with bcrypt password hashing
- WebSocket support (Socket.IO) for real-time features
- Scheduled tasks via `@nestjs/schedule`

### API Design

- All endpoints under `/api/` prefix
- Multi-tenant: every service method accepts `tenant_id`
- DTO validation via `class-validator`
- Error responses follow RFC 7807 (Problem Details)

### Key Backend Modules

| Module | Purpose |
|--------|---------|
| Auth | Login, register, company provisioning, routing info |
| License | Module activation/deactivation per tenant |
| Retail | Stores, shifts, POS transactions, stock opname |
| HR | Staff, departments, scheduling, attendance |
| Finance | Ledger, receivables, payables, treasury |
| Inventory | Stock, receiving, adjustments, transfers |
| Warehouse | Storage zones, picking, packing, occupancy |
| Procurement | Suppliers, contracts, purchase orders |

## Data Flow

```
Browser → Nginx (port 3010) → Static files (frontend)
Browser → Nginx → Backend API (port 3001) → PostgreSQL (port 5432)
```

## Docker Architecture

```yaml
services:
  frontend:   # Nginx serving built React app
  backend:    # NestJS API server
  db:         # PostgreSQL 16
```

Network: Docker default bridge (`bfs_default`)
