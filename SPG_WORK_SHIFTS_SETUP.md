# SPG Work Shifts Setup - Seminyak Store

**Date**: June 24, 2026
**Status**: ✅ COMPLETED

## Problem

When Fera logged in, the system:
1. ✅ Successfully redirected to `/m/retail/operational/pos`
2. ✅ Shift initialization worked (foreign key issue fixed)
3. ❌ **Wrong store selected**: System showed "Anchor" instead of "Seminyak"

## Root Cause

The auth routing logic requires work shifts to determine which store an employee should be routed to. The flow is:

1. **Auth Routing** (`auth-routing.controller.ts`) checks for active work shifts
2. If shift found → provides store context to frontend
3. If no shift → returns generic `/core/dashboard` redirect
4. **RetailContext** uses this routing info or falls back to:
   - Saved store from localStorage
   - First available store (this is why "Anchor" was selected)

Since Fera and Nana had **no work shifts created**, the system fell back to the first available store alphabetically.

## Solution

Created work shifts for both SPG staff members at Seminyak store with their scheduled times:

### Fera (Morning Shift)
- **Email**: fera@bambusilver.com
- **Schedule**: Monday to Sunday, 8:00 AM - 3:00 PM Jakarta Time (01:00-08:00 UTC)
- **Store**: Seminyak (BS-03)
- **Location**: Seminyak

### Nana (Afternoon Shift)
- **Email**: nana@bambusilver.com  
- **Schedule**: Monday to Sunday, 3:00 PM - 10:00 PM Jakarta Time (08:00-15:00 UTC)
- **Store**: Seminyak (BS-03)
- **Location**: Seminyak

## Implementation

### Script Created

**File**: `backend/scripts/create-spg-work-shifts.ts`

The script:
1. ✅ Verified Sales department exists (or creates it)
2. ✅ Verified Sales Associate position exists (or creates it)
3. ✅ Verified employee records exist (Fera and Nana already had records)
4. ✅ Created work schedules for each employee
5. ✅ Created 7 work shifts per employee (one for each day of the week)

### Execution

```bash
# Copy script to VPS
scp backend/scripts/create-spg-work-shifts.ts ubuntu@150.109.15.108:~/zenvix/backend/scripts/

# Run script in container
docker cp ~/zenvix/backend/scripts/create-spg-work-shifts.ts bfs-backend:/app/scripts/
docker compose exec backend npx ts-node scripts/create-spg-work-shifts.ts
```

### Results

```
✅ Created schedule: Nana - Afternoon Shift
   Time: 8:00-15:00 UTC (3pm-10pm Jakarta)
   Days: Monday to Sunday

✅ Created schedule: Fera - Morning Shift  
   Time: 1:00-8:00 UTC (8am-3pm Jakarta)
   Days: Monday to Sunday

Nana Sales:
  Email: nana@bambusilver.com
  Shifts: 8
  Location: Seminyak

Fera Sales:
  Email: fera@bambusilver.com
  Shifts: 8
  Location: Seminyak
```

## How Auth Routing Works Now

1. **User logs in** (e.g., Fera at 10:00 AM Jakarta = 03:00 UTC)
2. **Auth routing checks** for active shifts:
   - Finds Fera's shift (01:00-08:00 UTC covers current time)
   - Gets shift's location (Seminyak)
   - Gets stores at that location
   - Filters out E2E test stores
   - Returns Seminyak store context
3. **Frontend receives** redirect info:
   ```json
   {
     "redirect_to": "/m/retail/operational/pos",
     "context": {
       "store_id": "f6ec35ea-b90c-46cf-ad39-4429f7d48c6e",
       "store_name": "Seminyak",
       "location_id": "a3a241a4-4841-45a3-90cd-f7135e6847b4",
       "shift_id": "<shift_id>",
       "shift_start": "2026-06-24T01:00:00.000Z",
       "shift_end": "2026-06-24T08:00:00.000Z"
     }
   }
   ```
4. **RetailContext** uses this store_id to set active store

## Database Schema

### hr_work_schedules
```prisma
model hr_work_schedules {
  id            String   @id @default(uuid())
  tenant_id     String
  department_id String   // Required
  created_by    String   // Required
  name          String?
  status        String   @default("DRAFT")
  start_date    DateTime
  end_date      DateTime
  company_id    String?
  location_id   String?
  // ... relations
}
```

### hr_work_shifts
```prisma
model hr_work_shifts {
  id           String   @id @default(uuid())
  tenant_id    String
  schedule_id  String
  employee_id  String
  start_time   DateTime // Shift start (UTC)
  end_time     DateTime // Shift end (UTC)
  location_id  String?  // Links to store location
  company_id   String?
  // ... relations
}
```

## Testing

**Before Fix**:
- Fera logs in → Redirected to POS → Shows "Anchor" store

**After Fix**:
- Fera logs in → Redirected to POS → Should show "Seminyak" store
- Nana logs in → Redirected to POS → Should show "Seminyak" store

## Next Steps

1. **Fera should log out and log in again** to get fresh routing-info
2. System should now show **"Seminyak"** store on POS page
3. Initialize shift and verify it's created for Seminyak store
4. Test with Nana (afternoon shift) to verify her routing works too

## Related Files

- `backend/scripts/create-spg-work-shifts.ts` - Script to create shifts
- `backend/src/core/auth/auth-routing.controller.ts` - Auth routing logic
- `src/pages/retail/context/RetailContext.tsx` - Store resolution on frontend
- `src/contexts/AuthContext.tsx` - Calls routing-info after login
- `backend/prisma/schema.prisma` - Database schemas

## Complete Flow Diagram

```
┌─────────────────┐
│  Fera Logs In   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  AuthContext calls /auth/routing-info   │
└────────┬────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│  Auth Routing Controller                             │
│  1. Gets user info                                   │
│  2. Finds employee record                            │
│  3. Checks for active shift (01:00-08:00 UTC)        │
│  4. Gets shift's location (Seminyak)                 │
│  5. Gets stores at location, filters E2E             │
│  6. Returns store context                            │
└────────┬─────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│  Frontend receives:                    │
│  {                                     │
│    redirect_to: "/m/retail/.../pos",   │
│    context: {                          │
│      store_id: "f6ec35ea...",         │
│      store_name: "Seminyak"           │
│    }                                   │
│  }                                     │
└────────┬───────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Navigate to /m/retail/.../pos       │
└────────┬─────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  RetailContext                              │
│  1. Loads stores list                       │
│  2. Checks session.store_id (from routing)  │
│  3. Finds & sets "Seminyak" store          │
│  4. Updates location context               │
└────────┬────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  POS shows "Seminyak" store  │
│  Fera can initialize shift   │
└──────────────────────────────┘
```

## Status Summary

✅ Shift creation foreign key issue - FIXED
✅ Work shifts created for Fera and Nana - COMPLETED  
✅ Auth routing configured for Seminyak store - READY
⏳ Awaiting user confirmation that correct store is shown

## Verification Checklist

- [ ] Fera logs out
- [ ] Fera logs in again (fera@bambusilver.com / Fera2024!)
- [ ] System shows "Seminyak" store (not "Anchor")
- [ ] Fera can initialize shift successfully
- [ ] Shift is created with Seminyak store ID
- [ ] POS transactions work correctly
