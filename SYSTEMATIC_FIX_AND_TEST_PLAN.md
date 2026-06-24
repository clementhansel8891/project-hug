# Systematic Fix and Test Plan

**Status**: READY FOR IMPLEMENTATION  
**Date**: June 24, 2026  
**Est. Time**: 3-4 hours total

---

## Current State Analysis

### ✅ What's Working:
- Logout button visible
- Shift creation works
- Work shifts exist for Fera and Nana
- Old broken shift closed

### ❌ What's Broken:
1. **Store routing**: Falls back to Anchor instead of Seminyak
2. **E2E pollution**: 10 E2E test stores at Seminyak location
3. **Shift close fails**: 403 location mismatch error
4. **Work shift pointing to E2E store**: Not real Seminyak

---

## Root Causes

### Issue 1: Too Many Stores at Seminyak Location
**Problem**: 11 stores exist (1 real + 10 E2E test stores)
- When auth routing picks first store after filtering E2E, it might still get wrong one
- When stores API loads, it might return E2E stores

**Solution**: 
- Improve E2E filtering (check both name AND code)
- Ensure Seminyak (BS-03) is prioritized
- Add explicit store selection in auth routing

### Issue 2: Location-Based RBAC Too Strict
**Problem**: User opens shift at one location, session has different location → 403 on close

**Solution**: Allow users to close shifts they opened regardless of session location

### Issue 3: Session Location Not Synced
**Problem**: Login sets location from work shift, but RetailContext might override it

**Solution**: Ensure session location matches active store location

---

## Implementation Plan

### Phase 1: Backend Fixes (1.5 hours)

#### Fix 1.1: Improve E2E Store Filtering
**File**: `backend/src/core/auth/auth-routing.controller.ts`

```typescript
// Better E2E filtering
const realStores = stores.filter(s => 
  !s.name?.includes('E2E-') && 
  !s.name?.includes('E2E ') &&
  !s.name?.match(/E2E[_-]/i) &&
  !s.code?.includes('E2E') &&
  !s.code?.match(/E2E/i) &&
  !s.deleted_at
);

// Prefer Seminyak (BS-03) if multiple stores
const seminyakStore = realStores.find(s => 
  s.code === 'BS-03' || s.name === 'Seminyak'
);

const store = seminyakStore || realStores[0] || stores.filter(s => !s.deleted_at)[0];
```

#### Fix 1.2: Remove Location Check from Shift Close
**File**: `backend/src/modules/retail/retail.controller.ts`

```typescript
@Put('shifts/:shift_id/close')
@UseGuards(AuthGuard, RBACGuard)
@RequirePermissions('retail:shifts:close')
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
  });

  if (!shift) {
    throw new NotFoundException('Shift not found');
  }

  // ONLY check if user is the shift owner (remove location check)
  if (shift.employee_id !== employee.id) {
    throw new ForbiddenException('You can only close your own shifts');
  }

  // Close shift (no location validation)
  const closed = await this.service.closeShift(
    request.tenant,
    shift_id,
    data,
    userId,
  );

  return { success: true, data: closed };
}
```

#### Fix 1.3: Filter E2E Stores from Stores API
**File**: `backend/src/modules/retail/retail.controller.ts`

```typescript
@Get('stores')
async listStores(@Req() request: RequestWithTenant, @Query('location_id') location_id?: string) {
  let stores = await this.service.listStores(
    request.tenant,
    location_id,
  );

  // Filter out E2E test stores for non-admin users
  if (request.user.role !== 'ADMIN') {
    stores = stores.filter(s => 
      !s.name?.includes('E2E-') && 
      !s.name?.includes('E2E ') &&
      !s.code?.includes('E2E')
    );
  }

  return { success: true, data: stores };
}
```

---

### Phase 2: Frontend Fixes (1 hour)

#### Fix 2.1: Better Store Resolution in RetailContext
**File**: `src/pages/retail/context/RetailContext.tsx`

```typescript
// PRIORITY 1: Use store from session (routing-info)
let targetStore = null;
const sessionStoreId = (session as any).store_id;

if (sessionStoreId) {
  targetStore = fetchedStores.find(s => s.id === sessionStoreId);
  
  if (targetStore) {
    console.log(`[RetailContext] Using session store: ${targetStore.name}`);
  } else {
    console.warn(`[RetailContext] Session store ${sessionStoreId} not found`);
  }
}

// PRIORITY 2: Use saved store from localStorage
if (!targetStore && savedStoreId) {
  targetStore = fetchedStores.find(s => s.id === savedStoreId);
  if (targetStore) {
    console.log(`[RetailContext] Using saved store: ${targetStore.name}`);
  }
}

// PRIORITY 3: Use first real store (not E2E)
if (!targetStore && fetchedStores.length > 0) {
  // Filter E2E stores
  const realStores = fetchedStores.filter(s => 
    !s.name?.includes('E2E-') && !s.code?.includes('E2E')
  );
  
  // Prefer Seminyak
  targetStore = realStores.find(s => s.code === 'BS-03') || realStores[0];
  
  if (targetStore) {
    console.warn(`[RetailContext] Using fallback store: ${targetStore.name}`);
  }
}
```

---

### Phase 3: Database Cleanup (30 min)

#### Script: Clean E2E Stores from Seminyak Location
**File**: `backend/scripts/cleanup-e2e-stores.ts`

```typescript
/**
 * Move E2E test stores to separate location
 * Keep Seminyak location clean for production use
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_ID = 'tnt-3rlhko';
const SEMINYAK_LOCATION = 'a3a241a4-4841-45a3-90cd-f7135e6847b4';

async function main() {
  console.log('Cleaning E2E stores from Seminyak location...\n');

  // Find or create E2E test location
  let e2eLocation = await prisma.locations.findFirst({
    where: {
      tenant_id: TENANT_ID,
      code: 'E2E-TEST',
    },
  });

  if (!e2eLocation) {
    e2eLocation = await prisma.locations.create({
      data: {
        tenant_id: TENANT_ID,
        name: 'E2E Test Location',
        code: 'E2E-TEST',
        type: 'test',
        address: 'Test Environment',
        country: 'ID',
        currency: 'IDR',
      },
    });
    console.log(`✅ Created E2E test location: ${e2eLocation.id}\n`);
  }

  // Find all E2E stores at Seminyak
  const e2eStores = await prisma.stores.findMany({
    where: {
      tenant_id: TENANT_ID,
      location_id: SEMINYAK_LOCATION,
      OR: [
        { name: { contains: 'E2E-' } },
        { name: { contains: 'E2E ' } },
        { code: { contains: 'E2E' } },
      ],
    },
  });

  console.log(`Found ${e2eStores.length} E2E stores at Seminyak:\n`);

  // Move them to E2E location
  for (const store of e2eStores) {
    await prisma.stores.update({
      where: { id: store.id },
      data: { location_id: e2eLocation.id },
    });
    console.log(`  Moved: ${store.name} → E2E Test Location`);
  }

  console.log(`\n✅ Moved ${e2eStores.length} E2E stores to test location`);
  console.log(`\nSeminyak location now clean for production use`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
```

---

### Phase 4: Testing Protocol (1 hour)

#### Test Suite 1: Authentication & Routing
```
Test 1.1: Fresh Login
- Clear browser cache
- Login as Fera (fera@bambusilver.com / Fera2024!)
- Expected: Redirect to /m/retail/operational/pos
- Expected: Console shows "Using session store: Seminyak"
- Expected: POS header shows "SEMINYAK"
- Result: PASS / FAIL

Test 1.2: Store Persistence
- Refresh page
- Expected: Still shows Seminyak store
- Expected: No fallback to Anchor
- Result: PASS / FAIL

Test 1.3: Multi-User
- Login as Nana (nana@bambusilver.com / Nana2024!)
- Expected: Also routes to Seminyak
- Expected: Different shift time shows in work schedule
- Result: PASS / FAIL
```

#### Test Suite 2: Shift Operations
```
Test 2.1: Open Shift
- Click "INITIALIZE TERMINAL"
- Enter opening cash: 1,000,000
- Expected: Shift opens successfully
- Expected: Shows "Shift Active" badge
- Expected: "CLOSE SHIFT" button appears
- Result: PASS / FAIL

Test 2.2: Process Transaction
- Search product: "banana"
- Add to cart
- Complete cash payment
- Expected: Order created
- Expected: Stock updated
- Result: PASS / FAIL

Test 2.3: Close Shift
- Click "CLOSE SHIFT" button
- Enter closing cash
- Expected: NO 403 error
- Expected: Shift closes successfully
- Expected: "CLOSE SHIFT" button disappears
- Result: PASS / FAIL
```

#### Test Suite 3: Logout Flow
```
Test 3.1: Logout with Open Shift
- Open shift
- Click logout button
- Expected: Toast warning "Please close your shift"
- Expected: Stays on POS page
- Result: PASS / FAIL

Test 3.2: Logout After Close Shift
- Close shift
- Click logout button
- Expected: Redirects to /login
- Expected: Session cleared
- Result: PASS / FAIL
```

#### Test Suite 4: Data Integrity
```
Test 4.1: Verify Database
Run queries:
SELECT * FROM retail_shifts WHERE employee_id = '<fera_id>' ORDER BY start_time DESC LIMIT 5;
SELECT * FROM retail_orders WHERE employee_id = '<fera_id>' ORDER BY created_at DESC LIMIT 5;
SELECT * FROM hr_attendance_records WHERE employee_id = '<fera_id>' ORDER BY check_in DESC LIMIT 5;

Expected: All records present and accurate
Result: PASS / FAIL
```

---

## Deployment Checklist

### Step 1: Prepare
- [ ] Commit all local changes
- [ ] Create backup of database (optional)
- [ ] Notify users of maintenance

### Step 2: Deploy Backend
```bash
cd backend
npm run build
git add .
git commit -m "fix: Improve store routing, remove location check from shift close, filter E2E stores"
git push origin main

# On VPS
ssh ubuntu@150.109.15.108
cd ~/zenvix
git pull
docker compose build backend
docker compose up -d backend
```

### Step 3: Deploy Frontend
```bash
cd ..
npm run build
git add .
git commit -m "fix: Improve store resolution in RetailContext, better E2E filtering"
git push origin main

# On VPS  
docker compose build frontend
docker compose up -d frontend
```

### Step 4: Run Database Cleanup
```bash
docker cp scripts/cleanup-e2e-stores.ts bfs-backend:/app/scripts/
docker compose exec backend npx ts-node scripts/cleanup-e2e-stores.ts
```

### Step 5: Test
- Run all test suites
- Document results
- Fix any issues found

---

## Success Metrics

- [ ] 0 E2E stores at Seminyak location
- [ ] Auth routing returns Seminyak store
- [ ] Store list API returns only real stores
- [ ] Shift operations work without 403 errors
- [ ] Users can logout after closing shift
- [ ] Console logs show correct store/location
- [ ] All test suites pass

---

## Rollback Plan

If issues occur:
1. Revert git commits: `git revert HEAD`
2. Redeploy previous version
3. Run emergency-fix script to close broken shifts
4. Investigate root cause

---

## Next Steps After Success

1. **Attendance Tracking** - Implement login/logout attendance
2. **RBAC Enhancement** - Block SPG from dashboard
3. **Operational Testing** - Test all POS features
4. **Performance Testing** - High volume transactions
5. **Documentation** - Create user manual

---

**Ready to implement?** 
This plan addresses all issues systematically with clear test criteria.
