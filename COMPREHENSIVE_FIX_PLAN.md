# Comprehensive Fix Plan - Retail Operational Issues

**Date**: June 24, 2026  
**Priority**: CRITICAL

---

## Issues Identified

### Issue 1: Store Routing Regression
**Symptom**:
```
[RetailContext] Shift store f6ec35ea... not found in stores list
[RetailContext] Using fallback store: Anchor (BS-AN)
```

**Root Cause**: The stores list API isn't returning Seminyak store, or the session doesn't have the correct store_id from auth routing.

### Issue 2: Shift Close Permission Error
**Symptom**:
```
403 Forbidden: Access Denied
You are assigned to location 'a370e7ca...' 
Cannot perform actions for location 'ca573031...'
```

**Root Cause**: 
- User's session has location_id from Anchor
- Shift was opened at Seminyak  
- Backend RBAC checks location match
- Locations don't match → 403 error

### Issue 3: Session Location Not Updating
**Symptom**: After login with shift schedule, session still has old location

**Root Cause**: AuthContext or RetailContext not properly updating session location when store changes

---

## Comprehensive Fix Strategy

### Fix 1: Ensure Stores API Returns All Stores
**File**: `backend/src/modules/retail/repositories/retail.db.repository.ts`

Already fixed - removed company_id filter. Need to verify it's working.

### Fix 2: Fix Auth Routing to Set Correct Context
**File**: `backend/src/core/auth/auth-routing.controller.ts`

Ensure routing info includes correct location_id and store_id for Seminyak.

### Fix 3: Update Session Location When Store Changes
**File**: `src/contexts/AuthContext.tsx` or `src/pages/retail/context/RetailContext.tsx`

When active store changes, update session location_id.

### Fix 4: Remove Location-Based RBAC for Shift Operations
**File**: `backend/src/modules/retail/retail.controller.ts` (shift close endpoint)

SPG staff should be able to close shifts they opened, regardless of current session location.

---

## Implementation Plan

### Step 1: Debug Current State (10 min)

Check what's actually happening:

```sql
-- Check Fera's current open shift
SELECT 
  rs.id, rs.employee_id, rs.store_id, rs.status,
  rs.start_time, rs.opening_cash,
  s.name as store_name, s.location_id as store_location,
  e.first_name, e.last_name
FROM retail_shifts rs
JOIN stores s ON rs.store_id = s.id
JOIN employees e ON rs.employee_id = e.id
WHERE e.user_id = 'cb49c5ae-1871-48a7-af23-ca01132ccfb3'
AND rs.status = 'open'
ORDER BY rs.start_time DESC;

-- Check what stores are returned by API
SELECT id, name, code, location_id, company_id, tenant_id
FROM stores
WHERE tenant_id = 'tnt-3rlhko'
AND deleted_at IS NULL
ORDER BY name;

-- Check Fera's work shift schedule
SELECT 
  ws.id, ws.employee_id, ws.location_id, 
  ws.start_time, ws.end_time,
  l.name as location_name,
  s.name as store_name
FROM hr_work_shifts ws
JOIN locations l ON ws.location_id = l.id
LEFT JOIN stores s ON s.location_id = l.id
WHERE ws.employee_id = '66a2b48b-6fdd-4bad-afc9-f29e8b77cd76'
AND ws.start_time <= NOW()
AND ws.end_time >= NOW()
ORDER BY ws.start_time DESC;
```

### Step 2: Fix Shift Close Permission (30 min)

**Option A**: Remove location check for shift closure  
**Option B**: Allow closing shifts you opened regardless of location  
**Option C**: Update session location when shift opens

**Recommended**: Option B

```typescript
// backend/src/modules/retail/retail.controller.ts
@Put('shifts/:shift_id/close')
async closeShift(
  @Req() request: RequestWithTenant,
  @Param('shift_id') shift_id: string,
  @Body() data: CloseShiftDto,
) {
  const userId = request.user.sub;
  
  // Get employee record
  const employee = await this.prisma.employees.findFirst({
    where: { 
      user_id: userId,
      tenant_id: request.tenant.tenant_id,
    },
  });

  if (!employee) {
    throw new BadRequestException('Employee record not found');
  }

  // Get the shift
  const shift = await this.prisma.retail_shifts.findUnique({
    where: { id: shift_id },
    include: { stores: true },
  });

  if (!shift) {
    throw new NotFoundException('Shift not found');
  }

  // Check if user opened this shift OR is assigned to shift employee
  if (shift.employee_id !== employee.id && shift.opened_by_id !== userId) {
    throw new ForbiddenException('You can only close shifts you opened');
  }

  // Close the shift (no location check)
  const closed = await this.service.closeShift(
    request.tenant,
    shift_id,
    data,
    userId,
  );

  return { success: true, data: closed };
}
```

### Step 3: Fix Store Routing (1 hour)

**Root Cause Analysis**:
The issue is that after login, the session has the routing info but when RetailContext loads stores, it can't find the shift store in the list.

**Solution**: Ensure auth routing returns correct store and RetailContext can find it.

```typescript
// backend/src/core/auth/auth-routing.controller.ts
// After finding active shift and store
console.log(`[AuthRouting] Store context:`, {
  store_id: store.id,
  store_name: store.name,
  location_id: activeShift.location_id,
  shift_id: activeShift.id,
});

return {
  success: true,
  data: {
    redirect_to: '/m/retail/operational/pos',
    context: {
      store_id: store.id,
      store_name: store.name,
      store_code: store.code,
      location_id: activeShift.location_id,
      shift_id: activeShift.id,
      shift_start: activeShift.start_time?.toISOString(),
      shift_end: activeShift.end_time?.toISOString(),
    },
  },
};
```

### Step 4: Update Session on Store Change (30 min)

```typescript
// src/pages/retail/context/RetailContext.tsx
useEffect(() => {
  if (targetStore && targetStore.id !== activeStoreRef.current?.id) {
    setActiveStore(targetStore);
    
    // Update auth session with new location
    if (targetStore.locationId !== session.location_id) {
      console.log(`[RetailContext] Updating session location: ${targetStore.locationId}`);
      updateLocationRef.current(targetStore.locationId);
    }
  }
}, [targetStore, session.location_id]);
```

---

## Quick Emergency Fix Script

Create a script to close the current broken shift and clear session:

```typescript
// backend/scripts/emergency-fix-fera-session.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const FERA_USER_ID = 'cb49c5ae-1871-48a7-af23-ca01132ccfb3';

async function main() {
  console.log('Emergency fix for Fera session...\n');

  // 1. Close all open shifts for Fera
  const openShifts = await prisma.retail_shifts.findMany({
    where: {
      employees: { user_id: FERA_USER_ID },
      status: 'open',
    },
  });

  for (const shift of openShifts) {
    await prisma.retail_shifts.update({
      where: { id: shift.id },
      data: {
        status: 'closed',
        end_time: new Date(),
        closing_cash: shift.expected_cash || shift.opening_cash,
        closing_note: 'Emergency closed by system',
      },
    });
    console.log(`✅ Closed shift: ${shift.id}`);
  }

  console.log('\n✅ Fera can now log in fresh and open new shift');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
```

---

## Testing Protocol

After fixes are deployed:

### Test 1: Fresh Login Flow
1. Clear browser cache/cookies
2. Login as Fera
3. Verify redirected to Seminyak POS
4. Check console: Should show "Using store: Seminyak"
5. Check active shift badge shows correct store

### Test 2: Shift Operations
1. Open shift at Seminyak
2. Declare opening cash
3. Process 1 test transaction
4. Close shift
5. Verify no 403 errors
6. Verify shift closes successfully

### Test 3: Logout Flow
1. After closing shift
2. Click logout button
3. Verify redirected to login
4. No errors in console

### Test 4: Multi-User Test
1. Login as Nana (different shift time)
2. Should route to Seminyak
3. Should be able to open/close shift
4. No conflicts with Fera's data

---

## Deployment Steps

1. **Run emergency fix** to close current broken shift
2. **Deploy backend fixes** (shift close permission)
3. **Deploy frontend fixes** (session location update)
4. **Test with Fera** (fresh login)
5. **Verify all flows** (open, transact, close, logout)
6. **Document results**

---

## Time Estimate

- Emergency fix script: 10 min
- Backend fixes: 1 hour
- Frontend fixes: 30 min  
- Testing: 1 hour
- **Total**: ~2.5 hours

---

## Priority Order

1. **URGENT**: Run emergency fix (close broken shift)
2. **HIGH**: Fix shift close permission (remove location check)
3. **HIGH**: Fix store routing (ensure Seminyak returned)
4. **MEDIUM**: Update session location on store change
5. **MEDIUM**: Comprehensive testing

---

## Success Criteria

- [ ] Fera logs in → Sees Seminyak store
- [ ] Fera opens shift → No errors
- [ ] Fera closes shift → No 403 error
- [ ] Fera logs out → Successfully logged out
- [ ] Nana logs in → Sees Seminyak store
- [ ] No location mismatch errors
- [ ] Console logs show correct store/location
