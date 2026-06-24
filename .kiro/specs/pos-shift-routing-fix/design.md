# POS Shift-Based Routing Fix - Design

## Overview

This design addresses the "Store Missing" error that occurs when SPG employees try to initialize the POS terminal after successfully logging in and being redirected based on their work shift schedule.

## Root Cause Analysis

### Problem Identified
The work shifts for Fera and Nana reference a `store_id` that doesn't exist in the production database stores list.

From console logs:
```javascript
store_id: '1bcb0547-d886-43c3-acf5-ac4866032cdb'  // From work shift
```

This store ID likely belongs to:
- A test store that was deleted
- A store created during E2E tests (name includes "E2E-FULL-...")
- A location that has no associated store record

### Why It Happened
The work shift creation script (`create-seminyak-schedules-today.ts`) finds the Seminyak store and uses its `location_id`, but when the auth routing controller queries:

```typescript
hr_work_shifts → locations → stores[0]
```

It returns the **first store** at that location, which might not be the intended Seminyak store if multiple stores share the same location.

## Solution Design

### Phase 1: Diagnose (VPS Database Query)

**Action:** Query the production database to understand the current state.

**Queries Needed:**
```sql
-- 1. Find all stores for Bambu Silver tenant
SELECT id, name, code, location_id 
FROM stores 
WHERE tenant_id = 'tnt-3rlhko' 
ORDER BY name;

-- 2. Find the problematic store referenced in the shift
SELECT id, name, code, location_id 
FROM stores 
WHERE id = '1bcb0547-d886-43c3-acf5-ac4866032cdb';

-- 3. Find Fera and Nana's current shifts
SELECT 
  s.id as shift_id,
  s.employee_id,
  e.first_name,
  e.last_name,
  s.location_id,
  s.start_time,
  s.end_time,
  st.id as store_id,
  st.name as store_name,
  st.code as store_code
FROM hr_work_shifts s
JOIN employees e ON e.id = s.employee_id
JOIN locations l ON l.id = s.location_id
LEFT JOIN stores st ON st.location_id = l.id
WHERE s.tenant_id = 'tnt-3rlhko'
  AND e.email IN ('fera@bambusilver.com', 'nana@bambusilver.com')
  AND s.start_time >= CURRENT_DATE
ORDER BY s.start_time;

-- 4. Find the correct Seminyak store
SELECT id, name, code, location_id 
FROM stores 
WHERE tenant_id = 'tnt-3rlhko' 
  AND (code = 'BS-03' OR name ILIKE '%seminyak%' OR name ILIKE '%toko baru%')
LIMIT 5;
```

**Expected Outcome:**
- Identify the correct store ID for Seminyak (BS-03)
- Confirm which store the shifts are currently pointing to
- Understand if there are multiple stores at the same location

### Phase 2: Fix Work Shift References

**Action:** Update the work shifts to reference the correct Seminyak store location.

**Approach:**

**Option A: Update Existing Shifts** (Preferred if shifts exist)
```sql
-- Find correct Seminyak store
WITH seminyak_store AS (
  SELECT id, location_id 
  FROM stores 
  WHERE tenant_id = 'tnt-3rlhko' AND code = 'BS-03'
  LIMIT 1
)
-- Update Fera and Nana's shifts
UPDATE hr_work_shifts
SET location_id = (SELECT location_id FROM seminyak_store)
WHERE tenant_id = 'tnt-3rlhko'
  AND employee_id IN (
    SELECT id FROM employees 
    WHERE email IN ('fera@bambusilver.com', 'nana@bambusilver.com')
  )
  AND start_time >= CURRENT_DATE;
```

**Option B: Recreate Shifts** (If Option A fails)
1. Delete existing shifts for today
2. Run updated `create-seminyak-schedules-today.ts` script
3. Verify shifts point to correct store

**Script Update:**
```typescript
// In create-seminyak-schedules-today.ts
// Change from finding any store to specifically finding BS-03
const seminyakStore = await prisma.stores.findFirst({
  where: {
    tenant_id: TENANT_ID,
    code: 'BS-03',  // Explicit code match
    deleted_at: null,  // Ensure not soft-deleted
  },
});
```

### Phase 3: Enhance Auth Routing Controller

**Current Code:**
```typescript
const activeShift = await this.prisma.hr_work_shifts.findFirst({
  // ... filters ...
  include: {
    locations: {
      include: {
        stores: true,  // Gets ALL stores for that location
      },
    },
  },
});

// Uses first store
const store = activeShift.locations.stores[0];
```

**Problem:** If multiple stores exist at the same location, this picks the first one, which might not be correct.

**Improved Design:**

**Option 1: Add store_id directly to hr_work_shifts** (Recommended)
```typescript
// Schema change
model hr_work_shifts {
  // ... existing fields ...
  location_id String
  store_id    String?  // NEW: Direct reference to store
  
  locations locations @relation(fields: [location_id], references: [id])
  stores    stores?   @relation(fields: [store_id], references: [id])
}
```

Benefits:
- Explicit store assignment per shift
- No ambiguity about which store at a location
- Aligns with business logic (shift is for specific store)

**Option 2: Filter stores by active status** (Quick fix)
```typescript
// Find the active, non-deleted store at this location
const store = activeShift.locations.stores.find(
  s => !s.deleted_at && s.status === 'active'
) || activeShift.locations.stores[0];
```

**Option 3: Add store preference to shift notes** (Workaround)
```typescript
// Parse shift.notes for store_code or store_id
// Match against available stores at location
```

**Chosen Approach:** Option 2 (Quick fix for immediate unblock) + Option 1 (Long-term improvement)

### Phase 4: Improve RetailContext Store Resolution

**Current Logic:**
```typescript
// Priority 1: session.store_id from shift
let targetStore = (session as any).store_id 
  ? fetchedStores.find(s => s.id === (session as any).store_id)
  : null;

// Priority 2: localStorage
if (!targetStore && savedStoreId) {
  targetStore = fetchedStores.find(s => s.id === savedStoreId);
}
```

**Enhancement:** Add fallback and error logging
```typescript
// Priority 1: session.store_id from shift
let targetStore = (session as any).store_id 
  ? fetchedStores.find(s => s.id === (session as any).store_id)
  : null;

// LOG WARNING if shift store not found
if ((session as any).store_id && !targetStore) {
  console.warn(
    `[RetailContext] Shift store ${(session as any).store_id} not found in stores list.`,
    `Available stores:`, fetchedStores.map(s => ({ id: s.id, name: s.name }))
  );
}

// Priority 2: localStorage (fallback)
if (!targetStore && savedStoreId) {
  targetStore = fetchedStores.find(s => s.id === savedStoreId);
}

// Priority 3: First available store (last resort)
if (!targetStore && fetchedStores.length > 0) {
  targetStore = fetchedStores[0];
  console.warn(`[RetailContext] Using default store: ${targetStore.name}`);
}
```

### Phase 5: Fix Text Color Theme Issues

**Audit Targets:**
- `ShiftOpenTerminal.tsx`
- `POSTerminal.tsx`
- Any retail operational pages

**Theme Variables to Use:**
```css
/* Foreground colors */
text-foreground           /* Primary text */
text-muted-foreground     /* Secondary/muted text */
text-primary              /* Brand color text */
text-destructive          /* Error text */

/* Background colors */
bg-background             /* Page background */
bg-card                   /* Card background */
bg-secondary              /* Secondary elements */
```

**Fix Pattern:**
```tsx
// BEFORE (hardcoded colors that might not work in all themes)
<p className="text-gray-600">Some text</p>

// AFTER (theme-aware)
<p className="text-muted-foreground">Some text</p>
```

## Implementation Plan

### Step 1: VPS Database Investigation (15 min)
- [ ] SSH into VPS: `ssh -i "C:\Users\user\.ssh\vps_zenvix" ubuntu@150.109.15.108`
- [ ] Run diagnostic queries (Phase 1)
- [ ] Document findings

### Step 2: Fix Work Shifts (10 min)
- [ ] Execute SQL update (Phase 2, Option A)
- [ ] OR run updated script (Phase 2, Option B)
- [ ] Verify shifts now reference correct store

### Step 3: Enhance Auth Routing (15 min)
- [ ] Apply Option 2 quick fix to `auth-routing.controller.ts`
- [ ] Add logging for debugging
- [ ] Rebuild and deploy backend

### Step 4: Enhance RetailContext (10 min)
- [ ] Add fallback logic and warning logs
- [ ] Rebuild and deploy frontend

### Step 5: Test End-to-End (10 min)
- [ ] Login as Fera
- [ ] Verify redirect to POS
- [ ] Verify correct store shows
- [ ] Click "INITIALIZE TERMINAL"
- [ ] Verify shift opens successfully

### Step 6: Fix Text Colors (15 min)
- [ ] Audit POS pages
- [ ] Replace hardcoded colors with theme variables
- [ ] Test in light and dark mode

**Total Estimated Time:** 75 minutes (~1.5 hours)

## Rollback Plan

If changes break the system:

1. **Revert shift updates:**
   ```sql
   -- Restore original location_id if backed up
   UPDATE hr_work_shifts SET location_id = '<original>' WHERE id IN (...);
   ```

2. **Revert code changes:**
   ```bash
   git revert HEAD
   git push origin main
   # Redeploy previous version
   ```

3. **Manual workaround:**
   - SPG can login as management role temporarily
   - Manually select store in POS
   - Open shift manually

## Testing Strategy

### Unit Tests (Future)
- Test `AuthRoutingController.getRoutingInfo()` with various shift scenarios
- Test `RetailContext` store resolution logic

### Integration Tests
- Test full login → routing → POS flow
- Test with shift at different stores
- Test with no active shift

### Manual Testing Checklist
- [ ] Fera login (morning shift 8am-3pm)
- [ ] Nana login (evening shift 3pm-10pm)
- [ ] SPG login outside shift hours (should go to dashboard)
- [ ] Management login (should go to dashboard)
- [ ] Store name displays correctly
- [ ] Shift initialization succeeds
- [ ] Text readable in both themes

## Success Criteria

### Functional
- ✅ SPG login redirects to POS based on active shift
- ✅ Correct store name displays in POS
- ✅ "INITIALIZE TERMINAL" succeeds without errors
- ✅ Shift linked to correct store and employee

### Non-Functional
- ✅ All text readable (proper contrast)
- ✅ No console errors
- ✅ Response time < 2 seconds for routing check
- ✅ Graceful fallback if store not found

## Future Enhancements

1. **Schema Improvement:** Add `store_id` directly to `hr_work_shifts` table
2. **Geo-location:** Verify employee is at correct physical store location
3. **Multi-shift Support:** Handle SPG working at multiple stores in one day
4. **Store Selection UI:** Allow SPG to choose store if shift has multiple locations
5. **Admin Shift Management:** UI to create/edit work shifts instead of scripts

## Security Considerations

- Ensure SPG cannot access POS for stores they're not scheduled at
- Validate shift ownership (employee_id matches logged-in user)
- Prevent shift manipulation through session tampering
- Log all shift open/close events for audit trail

## Performance Considerations

- `/v1/auth/routing-info` should respond in < 500ms
- Cache store list in RetailContext (avoid repeated fetches)
- Index on `hr_work_shifts(employee_id, start_time, end_time)` for fast lookup
- Index on `stores(tenant_id, code)` for fast Seminyak lookup

## Documentation Updates Needed

- Update `POS_ROUTING_IMPLEMENTATION.md` with final solution
- Document shift creation process for admins
- Add troubleshooting guide for "Store Missing" errors
- Update user credentials document with shift schedule info
