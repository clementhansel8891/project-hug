# Retail Module — Complete Interaction Catalog

> Retail is the largest module: **two navigation shells** (Management +
> Operational) spanning 30+ pages, served by **6 backend controllers**.
> `03_INTERACTION_CATALOG.md` only covered the POS/shift core — this document is
> the exhaustive retail surface.

## Shell architecture

```
/m/retail/workspace                  → RetailWorkspace (mode chooser)
/m/retail/management/*                → RetailManagementShell (back-office)
/m/retail/operational/*              → RetailOperationalShell (store floor)
retail/public/*                       → customer storefront (channel-credential auth)
```

`RetailRootLayout` wraps both; `RetailModeSwitchControl` toggles between
Management and Operational. Operational pages are device/role gated (SPG runs
the floor; Admin/Owner run Management).

## Backend controllers feeding retail

| Controller | Prefix | Concern |
|------------|--------|---------|
| retail.controller | `retail` | stores, products, orders, checkout, shifts, promotions, devices, inventory ops |
| retail-operations.controller | `retail` | order archive/batch-pick, verification, staff ops, exports, analytics, CCTV footage |
| retail-governance.controller | `retail` | thresholds, violations, crisis management |
| retail-infrastructure.controller | `retail/infrastructure` | edge nodes, load balancers, heartbeat |
| ecommerce-hub.controller | `retail/ecommerce-hub` | connectors, channels, channel products/categories |
| retail-public-*.controller | `retail/public` | storefront catalog/cart/auth |

---

## A. OPERATIONAL SHELL (store floor — SPG)

Entry: **OperationalGateway** (`/m/retail/operational/gateway`) — a launcher of
8 apps. Apps marked `requireShift` are locked until a shift is open (fiscal gate).

| # | Gateway App | Route | requireShift | Primary interactions | API | Surfaces in |
|---|-------------|-------|:---:|----------------------|-----|-------------|
| 1 | **POS Terminal** | `/operational/pos` | ✅ | scan/add to cart, qty±, discount, cash/card checkout | POST /retail/checkout | ⮕ stock↓, orders, finance, audit |
| 2 | **Refund Desk** | `/operational/refund` | ✅ | look up order, select items, process refund/return | POST /retail/orders/:id/return | ⮕ stock↑, finance refund |
| 3 | **Cash Movement** | `/operational/cash-movement` | ✅ | record CASH_IN / CASH_OUT + reason | POST /retail/shifts/:id/cash-movement | ⮕ shift expected cash, reconciliation |
| 4 | **Stock Opname** | `/operational/opname` | ✅ | scan items, enter counted qty, submit count | POST /retail/inventory/opname | ⮕ inventory adjustments, variance |
| 5 | **Stock Intake** | `/operational/receiving` | ✅ | scan SKU, enter qty/cost, confirm receipt | POST /retail/inventory/receive | ⮕ inventory balances↑ |
| 6 | **Self-Service Kiosk** | `/operational/kiosk` | ✅ | guest browses + self-checkout | POST /retail/checkout (guest) | ⮕ same as POS |
| 7 | **Shift Open** | `/operational/shift-open` | — | enter opening cash, acknowledge, initialize | POST /retail/shifts/open | ⮕ unlocks gated apps |
| 8 | **Shift Close** | `/operational/shift-close` | — | enter tender, notes, seal & commit | PUT /retail/shifts/:id/close | ⮕ finance reconciliation, audit |

### Operational sub-pages
| Page | Route | Interactions | API |
|------|-------|--------------|-----|
| Sales / History | `/operational/sales`, `/sales/history` | view transactions, filter, reprint | GET /retail/orders, GET /retail/orders/:id/print |
| Staff Shifts | `/operational/staff/shifts` | view own shift history | GET /retail/shifts |

### POS internal interactions (CashierPOS + pos/* components)
| Control | Component | Effect |
|---------|-----------|--------|
| Search header / barcode scan | ScannerSearchHeader | GET /retail/products?q= → add to cart |
| Category filter | CategoryGrid | GET /retail/products?category_id= |
| Product tile click | ProductGrid | add to cart (local) |
| Qty +/−, remove, line discount | CartPanel | local cart totals |
| Modifiers (tax/cart discount) | CartPanel modifier modal | local totals |
| Cash payment keypad → Finalize | CashPaymentModal | POST /retail/checkout (cash) |
| Electronic payment → confirm | ElectronicPaymentModal | POST /retail/checkout (card/QRIS/wallet) |

**Edge cases to test:** access any requireShift app with no open shift → redirected
to gateway with "Fiscal Gate Active"; checkout qty > stock; insufficient cash;
duplicate `correlationId` (idempotency); shift close variance > Rp10k → mandatory
explanation; close with missing compliance note → blocked.

---

## B. MANAGEMENT SHELL (back-office — Admin/Owner)

Six nav groups. Routes under `/m/retail/management/*`.

### B1. GOVERNANCE
| Page | Route | Interactions | API | Surfaces in |
|------|-------|--------------|-----|-------------|
| Retail Home | `/workspace` | mode switch, KPIs | — | — |
| **Command Center** (StoreDashboard/NexusCommand) | `/management/dashboard` | location switch, time-range filter, view KPIs/revenue/workforce/risk panels | GET /retail/inventory/stats, /analytics/ecommerce, governance/* | reads all retail telemetry |
| Store Profile | `/management/profile` | edit store details, operational config, tax zone, governance | PUT /retail/stores/:id | ⮕ POS store config, tax on checkout |
| Audit Ledger (ComplianceAuditLedger) | `/management/audit` | view immutable retail audit, export | GET /retail/governance/audit-log, /audit/export | compliance |

### B2. FULFILMENT
| Page | Route | Interactions | API | Surfaces in |
|------|-------|--------------|-----|-------------|
| **Fulfillment Hub** (OrderFulfillment) | `/management/orders` | view order racetrack, batch-pick, archive, logistics radar, buffer health | GET /retail/orders, POST /retail/orders/batch-pick, /orders/archive | ⮕ logistics, finance invoice |
| Inventory Visibility | `/management/inventory` | view stock across locations, search/filter, item detail, transfer tracking | GET /retail/products, /inventory/stats | ⮕ POS catalog |
| **Pricing Desk** (PricingPromoDesk) | `/management/pricing` | create/edit promotions, pricing rules | PUT /retail/promotions/:id, GET /pricing/quote | ⮕ POS auto-discount |
| Stock Request | `/management/prs?dept=RETAIL` | raise purchase requisition | POST /procurement/requisitions | ⮕ Procurement pipeline |
| Stock Intake | `/operational/receiving` | (shared with operational) | POST /retail/inventory/receive | ⮕ inventory |
| Stock Opname | `/operational/opname` | (shared) | POST /retail/inventory/opname | ⮕ adjustments |

### B3. E-COMMERCE
| Page | Route | Interactions | API | Surfaces in |
|------|-------|--------------|-----|-------------|
| **Commerce Channels** (EcommerceConnector) | `/management/ecommerce` | create/edit/delete connector & channel, rotate/revoke creds, test connector, map products/categories | /retail/ecommerce-hub/connectors/*, /channels/* | ⮕ external marketplace sync |
| E-Commerce Analytics | `/management/ecommerce-analytics` | view channel performance | GET /retail/analytics/ecommerce | dashboards |
| Customer Activity | `/management/customers` | view customers, sessions, segmentation | GET /retail/customers, POST /retail/staff/segmentation | ⮕ marketing |

### B4. WAREHOUSE (links into core/warehouse)
| Page | Route | Interactions | API |
|------|-------|--------------|-----|
| Warehouse Hub | `/core/warehouse` | view bins | GET /warehouse/bins |
| Storage Hierarchy | `/core/warehouse/hierarchy` | create bins/zones | POST /warehouse/bins |
| WH Receiving | `/core/warehouse/receiving` | receive into bins | warehouse receiving |
| Picking / Packing | `/core/warehouse/picking`,`/packing` | pick/pack orders | warehouse ops |
| Occupancy Trends | `/core/warehouse/analytics` | view utilization | analytics |
| WH Audit | `/core/warehouse/audit` | warehouse audit | audit |

### B5. WORKFORCE
| Page | Route | Interactions | API | Surfaces in |
|------|-------|--------------|-----|-------------|
| **Shift Control** (management ShiftControl) | `/management/shifts` | oversee all shifts, force-close, view variances | GET /retail/shifts, PUT /shifts/:id/close | ⮕ finance |
| Staff Assignments | `/management/staff` | assign staff to stores, segmentation, reminders | POST /retail/staff/segmentation, /staff/reminders | ⮕ scheduling |
| Staff Schedule | `/management/schedule` | (HR scheduling embed) | hr/scheduling | ⮕ HR |
| Attendance Tracker | `/management/attendance` | (HR attendance embed) | hr/attendance | ⮕ HR payroll |
| Staff Portal | `/management/portal` | staff self-service (MyPulse) | portal | HR |

### B6. INFRASTRUCTURE
| Page | Route | Interactions | API | Surfaces in |
|------|-------|--------------|-----|-------------|
| **Device Control** (DeviceControlCenter) | `/management/devices` | register/ping devices, CCTV register + validate + request footage, sensors | /retail/devices, /cctvs, /sensors, POST /retail/cctv/:id/footage | ⮕ IT topology |
| **Infra Control** (InfrastructureControl/Map) | `/management/infrastructure` | manage edge nodes, set node status, load balancers, heartbeat | /retail/infrastructure/nodes, /load-balancers, /heartbeat | ⮕ system health |
| Administrative (Settings) | `/management/admin` | retail settings, discovery scan | POST /retail/settings/discovery | config |
| System Logs | `/management/logs?scope=RETAIL` | view retail logs | GET /logs | ops |
| Workflow Inbox | `/management/workflow?scope=RETAIL` | approve retail workflows | workflow | ⮕ FlowGate |

### Governance & crisis (RiskCompliancePanel, crisis tools)
| Interaction | API | Role | Surfaces in |
|-------------|-----|------|-------------|
| View/edit thresholds | GET /retail/governance/thresholds, PATCH /:id | MANAGER+ | ⮕ violation detection |
| View violations / resolve | GET /retail/governance/violations, POST /:id/resolve | MANAGER+ | compliance |
| Crisis alerts | GET /retail/crisis/alerts | any | command center |
| Deploy resources | POST /retail/crisis/deploy | MANAGER+ | ⮕ task tracking |
| Trigger replenishment | POST /retail/crisis/replenish | MANAGER+ | ⮕ procurement/inventory |
| Verification scan | POST /retail/verification/scan | any | RetailVerification page |
| Fleet serialize / strategic yield | POST /retail/analytics/fleet-serialize, /strategic-yield | any | analytics |
| Inventory export | POST /retail/inventory/export | any | download |

---

## C. PUBLIC STOREFRONT (`retail/public/*` — no tenant header)

| Interaction | API | Auth |
|-------------|-----|------|
| Customer browse catalog | GET /retail/public/products | channel credentials |
| Customer login/register | retail/public/auth/* | customer auth |
| Cart / checkout (online order) | retail/public gateway | channel + customer |
| Inbound channel events | POST /retail/events | connector guard |

---

## Retail test matrix (what a full retail suite must cover)

| Area | Tests |
|------|-------|
| Operational gateway | each of 8 apps loads; requireShift apps blocked w/o shift |
| Shift lifecycle | open → POS sale → cash movement → close → reconcile (variance paths) |
| POS | scan, cart math, promotions, cash + electronic checkout, idempotency, oversell guard |
| Refund/return | full + partial return, stock + finance reversal |
| Opname / receiving | count submit → adjustment; receive → stock↑ |
| Management governance | dashboard panels load; store profile edit propagates to POS tax |
| Fulfilment | order racetrack, batch-pick, archive |
| Pricing | promo create → appears in POS |
| E-commerce | connector/channel CRUD, rotate/revoke creds, product mapping, test connector |
| Workforce | shift control force-close, staff assignment, segmentation/reminders |
| Infrastructure | device/CCTV/sensor register, node status, load balancer, footage request |
| Governance/crisis | threshold edit, violation resolve, crisis deploy, replenishment |
| Storefront | public catalog, customer auth, online checkout |
| RBAC | SPG limited to operational; Admin/Owner for management; manager-gated governance |
| Cross-module | sale→inventory/finance; stock request→procurement; replenish→procurement; shift→finance |

---

**Correction note:** the retail rows in `03_INTERACTION_CATALOG.md` (sections 2–3)
are a *summary*. This document is the authoritative, exhaustive retail surface.
