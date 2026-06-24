# POS Shift-Based Routing Fix - Tasks

## Task 1: Diagnose Store and Shift Data on VPS
**Status:** pending  
**Priority:** critical  
**Estimated Time:** 15 minutes

**Description:**
Query the production database on VPS to understand the current state of stores and work shifts. Identify the correct Seminyak store and verify what the current shifts are pointing to.

**Steps:**
1. SSH into VPS: `ssh -i "C:\Users\user\.ssh\vps_zenvix" ubuntu@150.109.15.108`
2. Access PostgreSQL database
3. Run diagnostic queries:
   - List all stores for tenant `tnt-3rlhko`
   - Check if store `1bcb0547-d886-43c3-acf5-ac4866032cdb` exists
   - Find Fera and Nana's current work shifts
   - Find the correct Seminyak (BS-03) store
4. Document findings

**Acceptance Criteria:**
- [ ] Know the correct store ID for Seminyak (BS-03)
- [ ] Know which store(s) the current shifts are pointing to
- [ ] Understand if the problematic store is a test store or real store
- [ ] Have a clear picture of the database state

**Files Involved:**
- VPS database queries (no code changes)

**SQL Queries:**
```sql
-- Query 1: All stores
SELECT id, name, code, location_id, created_at, deleted_at
FROM stores 
WHERE tenant_id = 'tnt-3rlhko' 
ORDER BY name;

-- Query 2: Problematic store
SELECT id, name, code, location_id, created_at, deleted_at
FROM stores 
WHERE id = '1bcb0547-d886-43c3-acf5-ac4866032cdb';

-- Query 3: Current shifts with store info
SELECT 
  s.id as shift_id,
  e.first_name,
  e.last_name,
  e.email,
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
  AND DATE(s.start_time) = CURRENT_DATE
ORDER BY s.start_time;

-- Query 4: Find Seminyak store
SELECT id, name, code, location_id, created_at, deleted_at
FROM stores 
WHERE tenant_id = 'tnt-3rlhko' 
  AND (code = 'BS-03' OR name ILIKE '%seminyak%' OR name ILIKE '%toko%')
ORDER BY created_at DESC;
```

---

## Task 2: Fix Work Shift Store References
**Status:** pending  
**Priority:** critical  
**Estimated Time:** 10 minutes  
**Depends On:** Task 1

**Description:**
Update Fera and Nana's work shifts to reference the correct Seminyak store location_id. This ensures the auth routing controller will resolve the correct store when they login.

**Steps:**
1. Using findings from Task 1, identify the correct Seminyak store location_id
2. Execute SQL update to fix shift location_id
3. Verify shifts now point to correct store
4. Test by querying the shifts again with the diagnostic query

**Acceptance Criteria:**
- [ ] Fera's shift (8am-3pm) points to Seminyak store location
- [ ] Nana's shift (3pm-10pm) points to Seminyak store location
- [ ] When querying shifts with store join, correct store name appears
- [ ] No orphaned shifts (all shifts have valid location with store)

**SQL Update:**
```sql
-- Update shifts to use correct Seminyak location
WITH seminyak_store AS (
  SELECT location_id 
  FROM stores 
  WHERE tenant_id = 'tnt-3rlhko' 
    AND code = 'BS-03'
    AND deleted_at IS NULL
  LIMIT 1
),
target_employees AS (
  SELECT id 
  FROM employees 
  WHERE tenant_id = 'tnt-3rlhko'
    AND email IN ('fera@bambusilver.com', 'nana@bambusilver.com')
)
UPDATE hr_work_shifts
SET location_id = (SELECT location_id FROM seminyak_store)
WHERE tenant_id = 'tnt-3rlhko'
  AND employee_id IN (SELECT id FROM target_employees)
  AND DATE(start_time) = CURRENT_DATE;

-- Verify update
SELECT 
  e.first_name,
  e.last_name,
  s.start_time,
  s.location_id,
  st.name as store_name,
  st.code as store_code
FROM hr_work_shifts s
JOIN employees e ON e.id = s.employee_id
JOIN locations l ON l.id = s.location_id
LEFT JOIN stores st ON st.location_id = l.id
WHERE s.tenant_id = 'tnt-3rlhko'
  AND e.email IN ('fera@bambusilver.com', 'nana@bambusilver.com')
  AND DATE(s.start_time) = CURRENT_DATE;
```

**Rollback Plan:**
```sql
-- Backup current location_id before update
CREATE TEMP TABLE shift_backup AS
SELECT id, location_id
FROM hr_work_shifts
WHERE tenant_id = 'tnt-3rlhko'
  AND DATE(start_time) = CURRENT_DATE;

-- Restore if needed
UPDATE hr_work_shifts s
SET location_id = b.location_id
FROM shift_backup b
WHERE s.id = b.id;
```

---

## Task 3: Enhance Auth Routing Controller with Better Store Resolution
**Status:** pending  
**Priority:** high  
**Estimated Time:** 15 minutes  
**Depends On:** Task 2

**Description:**
Improve the auth routing controller to handle edge cases where a location has multiple stores. Add filtering for active, non-deleted stores and add debug logging.

**Steps:**
1. Open `backend/src/core/auth/auth-routing.controller.ts`
2. Modify store resolution logic to prefer active stores
3. Add logging for debugging
4. Add error handling if no valid store found
5. Rebuild backend
6. Deploy to VPS

**Acceptance Criteria:**
- [ ] Controller filters out deleted stores
- [ ] Controller prefers active stores over inactive ones
- [ ] Logs show which store is being resolved from shift
- [ ] Gracefully handles case where location has no stores
- [ ] Backend builds without errors
- [ ] Deployment succeeds

**Files to Modify:**
- `backend/src/core/auth/auth-routing.controller.ts`

**Code Changes:**
```typescript
// In getRoutingInfo method, after fetching activeShift

if (activeShift && activeShift.locations) {
  // Find the best matching store at this location
  const stores = activeShift.locations.stores || [];
  
  // Filter out deleted stores
  const validStores = stores.filter(s => !s.deleted_at);
  
  // Prefer active stores
  const activeStores = validStores.filter(s => s.status === 'active');
  
  const store = activeStores[0] || validStores[0];
  
  if (store) {
    console.log(`[AuthRouting] Resolved store: ${store.name} (${store.id}) for shift ${activeShift.id}`);
    
    return {
      success: true,
      data: {
        redirect_to: '/m/retail/operational/pos',
        context: {
          store_id: store.id,
          store_name: store.name,
          location_id: activeShift.location_id || undefined,
          shift_id: activeShift.id,
          shift_start: activeShift.start_time?.toISOString(),
          shift_end: activeShift.end_time?.toISOString(),
        },
      },
    };
  } else {
    console.warn(`[AuthRouting] No valid store found for shift ${activeShift.id} at location ${activeShift.location_id}`);
    // Fall through to default routing
  }
}
```

---

## Task 4: Add Fallback Logic to RetailContext
**Status:** pending  
**Priority:** high  
**Estimated Time:** 10 minutes  
**Depends On:** Task 2

**Description:**
Enhance RetailContext to add warning logs when shift store is not found and implement better fallback logic to prevent "Store Missing" errors.

**Steps:**
1. Open `src/pages/retail/context/RetailContext.tsx`
2. Add warning log when shift store_id not found
3. Add fallback to first available store
4. Rebuild frontend
5. Deploy to VPS

**Acceptance Criteria:**
- [ ] Console shows warning if shift store not found in stores list
- [ ] Warning includes available stores for debugging
- [ ] Falls back to first available store if shift store missing
- [ ] Never leaves `activeStore` as null if stores are available
- [ ] Frontend builds without errors

**Files to Modify:**
- `src/pages/retail/context/RetailContext.tsx`

**Code Changes:**
```typescript
// In refreshState, after fetching stores and channels

if (!initializedRef.current) {
  initializedRef.current = true;
  
  // PRIORITY 1: Check if session has store_id from routing (shift context)
  let targetStore = (session as any).store_id 
    ? fetchedStores.find(s => s.id === (session as any).store_id)
    : null;
  
  // LOG WARNING if shift store not found
  if ((session as any).store_id && !targetStore) {
    console.warn(
      `[RetailContext] Shift store ${(session as any).store_id} not found in stores list.`,
      `Available stores:`, fetchedStores.map(s => ({ id: s.id, name: s.name, code: s.code }))
    );
  }
  
  // PRIORITY 2: Use saved store from localStorage
  if (!targetStore && savedStoreId) {
    targetStore = fetchedStores.find(s => s.id === savedStoreId);
    if (targetStore) {
      console.log(`[RetailContext] Using saved store: ${targetStore.name}`);
    }
  }
  
  // PRIORITY 3: Fallback to first available store
  if (!targetStore && fetchedStores.length > 0) {
    targetStore = fetchedStores[0];
    console.warn(`[RetailContext] Using fallback store: ${targetStore.name}`);
  }

  if (targetStore) {
    setActiveStore(targetStore);
    if (session.location_id !== targetStore.locationId) {
      updateLocationRef.current(targetStore.locationId);
    }
  }
  // ... rest of logic
}
```

---

## Task 5: Test Complete Login-to-POS Flow
**Status:** pending  
**Priority:** critical  
**Estimated Time:** 10 minutes  
**Depends On:** Task 3, Task 4

**Description:**
Perform end-to-end testing of the SPG login and POS initialization flow to verify all fixes work correctly.

**Test Cases:**

### Test Case 1: Fera Morning Shift Login
**Steps:**
1. Navigate to `http://150.109.15.108:3010`
2. Login with `fera@bambusilver.com` / `Fera2024!`
3. Observe redirect
4. Check store name in POS UI
5. Open browser console and check logs
6. Click "INITIALIZE TERMINAL"
7. Verify shift opens successfully

**Expected Results:**
- ✅ Redirects to `/m/retail/operational/pos`
- ✅ Shows "Toko Baru" or "Seminyak" as store name
- ✅ Console log shows correct store ID resolved
- ✅ "INITIALIZE TERMINAL" succeeds without errors
- ✅ Can proceed to POS gateway

### Test Case 2: Nana Evening Shift Login
**Steps:**
1. Navigate to `http://150.109.15.108:3010`
2. Login with `nana@bambusilver.com` / `Nana2024!`
3. Observe redirect
4. Verify same success as Fera

**Expected Results:**
- Same as Test Case 1

### Test Case 3: Management Login (No Shift)
**Steps:**
1. Navigate to `http://150.109.15.108:3010`
2. Login with `hansel@bambusilver.com` / `Hansel2024!`
3. Observe redirect

**Expected Results:**
- ✅ Redirects to `/core/dashboard` (not POS)
- ✅ Can access retail module manually if needed

### Test Case 4: SPG Login Outside Shift Hours
**Steps:**
1. Wait until current time is outside Fera/Nana shift hours OR
2. Temporarily modify shift times in database
3. Login as Fera or Nana

**Expected Results:**
- ✅ Redirects to `/core/dashboard` (no active shift)

**Acceptance Criteria:**
- [ ] All 4 test cases pass
- [ ] No "Store Missing" errors
- [ ] No console errors
- [ ] Shift initialization succeeds
- [ ] Correct store context throughout POS flow

---

## Task 6: Fix Text Color Theme Issues
**Status:** pending  
**Priority:** medium  
**Estimated Time:** 15 minutes

**Description:**
Audit POS pages for text color issues where text blends with background. Replace hardcoded colors with proper theme variables.

**Steps:**
1. Open `src/pages/retail/operational/ShiftOpenTerminal.tsx`
2. Find all hardcoded color classes (e.g., `text-gray-600`)
3. Replace with theme variables (e.g., `text-muted-foreground`)
4. Repeat for other POS pages if needed
5. Test in light mode
6. Test in dark mode
7. Rebuild and deploy

**Problematic Patterns to Find:**
```tsx
// AVOID (hardcoded colors)
text-gray-600
text-gray-500
text-gray-400
text-white
text-black
bg-gray-100
bg-gray-800

// PREFER (theme-aware)
text-foreground
text-muted-foreground
text-primary
text-destructive
bg-background
bg-card
bg-secondary
```

**Files to Audit:**
- `src/pages/retail/operational/ShiftOpenTerminal.tsx`
- `src/pages/retail/operational/POSTerminal.tsx`
- `src/pages/retail/operational/Gateway.tsx`

**Acceptance Criteria:**
- [ ] All text readable in light mode
- [ ] All text readable in dark mode
- [ ] No hardcoded gray colors remaining
- [ ] Theme toggle works correctly
- [ ] Accessibility: Minimum 4.5:1 contrast ratio for body text

**Testing:**
1. Toggle between light/dark theme
2. Check every page in retail operational module
3. Verify text is always readable
4. Use browser DevTools to check contrast ratios

---

## Task 7: Documentation and Cleanup
**Status:** pending  
**Priority:** low  
**Estimated Time:** 10 minutes  
**Depends On:** Task 5

**Description:**
Update documentation with the final solution and create a troubleshooting guide for future reference.

**Steps:**
1. Update `POS_ROUTING_SUCCESS_AND_NEXT_STEPS.md` with fix details
2. Document the correct store ID for Seminyak
3. Create troubleshooting guide for "Store Missing" errors
4. Update work shift creation process documentation
5. Add notes to credentials document about shift schedules

**Acceptance Criteria:**
- [ ] Documentation clearly explains the fix
- [ ] Troubleshooting guide helps debug similar issues
- [ ] Future developers can create shifts correctly
- [ ] All team members know the correct Seminyak store ID

**Files to Update:**
- `POS_ROUTING_SUCCESS_AND_NEXT_STEPS.md`
- `bambu-silver-credentials-report.txt` (add shift schedule info)
- New file: `TROUBLESHOOTING_STORE_MISSING.md`

---

## Summary

**Total Tasks:** 7  
**Critical Path:** Tasks 1 → 2 → 3 → 5  
**Parallel Work:** Tasks 4 and 6 can be done alongside Task 3  
**Total Estimated Time:** ~85 minutes

**Task Dependencies:**
```
Task 1 (Diagnose)
  ↓
Task 2 (Fix Shifts)
  ↓
Task 3 (Backend)
  ↓
Task 5 (Test)
  ↓
Task 7 (Docs)

Task 4 (Frontend) ← Can run parallel with Task 3
Task 6 (Colors)   ← Can run parallel with Task 3-5
```

**Success Metrics:**
- ✅ 0 "Store Missing" errors after SPG login
- ✅ 100% test cases passing
- ✅ All text readable in both themes
- ✅ Complete documentation
