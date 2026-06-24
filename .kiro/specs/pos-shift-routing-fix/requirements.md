# POS Shift-Based Routing Fix - Requirements

## Problem Statement

SPG employees (Fera, Nana) can successfully login and are redirected to the POS page based on their active work shifts. However, the POS shows "Store Missing - Node identity not verified" error when trying to initialize the terminal.

### Current Behavior (From Console Logs)

1. ✅ Fera logs in successfully → receives JWT token
2. ✅ Auth routing endpoint called → returns shift context with `store_id: '1bcb0547-d886-43c3-acf5-ac4866032cdb'`
3. ✅ Redirect to `/m/retail/operational/pos` works
4. ✅ POS page loads and shows "Shift Initialize" screen
5. ❌ **BLOCKER:** When clicking "INITIALIZE TERMINAL", error shows "Store Missing - Node identity not verified"
6. ❌ **ROOT CAUSE:** `RetailContext` cannot find the store with ID `1bcb0547-d886-43c3-acf5-ac4866032cdb` in the stores list

### Console Log Analysis

```javascript
[AuthContext] Session updated with shift context: {
  user_id: 'cb49c5ae-1871-48a7-af23-ca01132ccfb3',
  tenant_id: 'tnt-3rlhko', 
  store_id: '1bcb0547-d886-43c3-acf5-ac4866032cdb',  // <-- From shift
  location_id: 'a3a241a4-4841-45a3-90cd-f7135e6847b4',
  shift_id: '...',
  role: 'EMPLOYEE'
}

// Later...
[apiClient] Request: GET /api/v1/retail/stores  // Fetches stores list
```

**The problem:** The `store_id` from the shift doesn't exist in the stores returned by `/api/v1/retail/stores`.

## Requirements

### FR-1: Verify Store Data Integrity
**Priority:** CRITICAL  
**Description:** Investigate why the store ID from the work shift doesn't exist in the stores list.

**Acceptance Criteria:**
- [ ] Query VPS production database to list all stores for tenant `tnt-3rlhko`
- [ ] Verify if store `1bcb0547-d886-43c3-acf5-ac4866032cdb` exists
- [ ] Check the relationship between `hr_work_shifts.location_id` and `stores.location_id`
- [ ] Document the correct store that work shifts should reference

**Technical Details:**
- Database: PostgreSQL on VPS at `150.109.15.108`
- Tenant: `tnt-3rlhko` (Bambu Silver)
- Expected stores: Seminyak (BS-03), Double Six, Sahadewa, SS, Anchor

### FR-2: Fix Work Shift Store References
**Priority:** CRITICAL  
**Description:** Update Fera and Nana's work shifts to reference the correct Seminyak store.

**Acceptance Criteria:**
- [ ] Identify the correct store ID for "Seminyak (BS-03)" / "Toko Baru"
- [ ] Update work shifts for Fera (8am-3pm) and Nana (3pm-10pm) to use correct store location
- [ ] Verify the store appears in the `/api/v1/retail/stores` response
- [ ] Test that `RetailContext` can successfully find the store

**Data Requirements:**
- Work shifts must link to location_id that has an associated store
- Store must be active and belong to tenant `tnt-3rlhko`
- Store name should be "Toko Baru" or "Seminyak"

### FR-3: Verify Auth Routing Store Lookup
**Priority:** HIGH  
**Description:** Ensure the auth routing controller correctly resolves store from work shift.

**Acceptance Criteria:**
- [ ] Verify `auth-routing.controller.ts` query correctly joins `hr_work_shifts` → `locations` → `stores`
- [ ] Add logging to show which store is being resolved from the shift
- [ ] Handle case where shift has no associated store (shouldn't happen, but fail gracefully)

### FR-4: Test Complete Login-to-POS Flow
**Priority:** HIGH  
**Description:** End-to-end testing of the shift-based POS routing.

**Acceptance Criteria:**
- [ ] Login as Fera → Should redirect to `/m/retail/operational/pos`
- [ ] POS page shows correct store name ("Toko Baru" / "Seminyak")
- [ ] Click "INITIALIZE TERMINAL" → Should successfully open shift
- [ ] Verify shift is linked to correct store
- [ ] Verify all transactions will be tracked under correct store + employee

### NFR-1: Fix Text Color Theme Issues
**Priority:** MEDIUM  
**Description:** Some text in the UI is blending with the background, needs proper theme color application.

**Acceptance Criteria:**
- [ ] Audit POS pages for text color issues (check against dark/light themes)
- [ ] Ensure all text uses proper theme variables (`text-foreground`, `text-muted-foreground`, etc.)
- [ ] Test in both light and dark mode
- [ ] Fix any accessibility issues with contrast ratios

## User Story

**As** an SPG employee (Fera or Nana)  
**I want** to login and be automatically taken to the POS for my scheduled store  
**So that** I can start processing sales immediately without manual navigation

### Acceptance Criteria
- Login redirects me to POS based on my active work shift
- POS shows the correct store name I'm scheduled to work at
- I can successfully initialize the shift and start selling
- All my sales are tracked under my employee ID and the correct store

## Technical Context

### Database Schema
```
hr_work_shifts
  ├── id (primary key)
  ├── employee_id → employees.id
  ├── location_id → locations.id
  ├── start_time
  ├── end_time
  
locations
  ├── id (primary key)
  ├── stores[] (one-to-many relationship)
  
stores
  ├── id (primary key)
  ├── location_id → locations.id
  ├── name
  ├── code
```

### Current Implementation Flow
1. User logs in → JWT token issued
2. Frontend calls `/v1/auth/routing-info`
3. Backend finds active work shift for user
4. Backend joins `hr_work_shifts` → `locations` → `stores[0]`
5. Returns `store_id` in session context
6. Frontend redirects to POS
7. **RetailContext** fetches stores via `/v1/retail/stores`
8. **RetailContext** tries to find `store_id` in fetched stores
9. **FAILS:** Store not found

### Possible Root Causes
1. Work shift points to a location that has no stores
2. Work shift points to a test/deleted store
3. Store exists but is not returned by `/v1/retail/stores` (permissions? tenant filter?)
4. Store ID mismatch (wrong ID stored in work shift)

## Out of Scope
- Geo-location verification (planned for future)
- Schedule creation UI (using scripts for now)
- Multi-shift support (SPG working at multiple stores in one day)

## Success Metrics
- [ ] 100% of SPG logins successfully redirect to POS
- [ ] 0% "Store Missing" errors after login
- [ ] All shift initializations succeed
- [ ] All text is readable in both light/dark themes

## Dependencies
- VPS database access (SSH: `ubuntu@150.109.15.108`)
- Prisma schema understanding
- Backend NestJS auth module
- Frontend React routing and context
