# POS Shift Routing Fix - Diagnostic Results

## Date: June 24, 2026
## Database: VPS Production (150.109.15.108)
## Tenant: tnt-3rlhko (Bambu Silver)

---

## Executive Summary

✅ **FOUND:** The correct store ID for Seminyak (BS-03)  
❌ **CONFIRMED:** The problematic store ID is a leftover E2E test store  
✅ **VERIFIED:** Current work shifts are pointing to the CORRECT location  

---

## Key Findings

### 1. Correct Seminyak Store (BS-03)

**Store ID:** `f6ec35ea-b90c-46cf-ad39-4429f7d48c6e`  
**Store Name:** `Seminyak`  
**Store Code:** `BS-03`  
**Location ID:** `a3a241a4-4841-45a3-90cd-f7135e6847b4`  

This is the CORRECT production store for Seminyak operations.

---

### 2. Problematic Store (From Console Logs)

**Store ID:** `1bcb0547-d886-43c3-acf5-ac4866032cdb`  
**Store Name:** `E2E-FULL-1781176576815 Online`  
**Store Code:** `EC-E2EFULL1-3C5927`  
**Location ID:** `1db74f6e-cabd-4f43-85f3-bb583e2c5ea7`  

**Analysis:** This is a leftover E2E test store created during automated testing. It should NOT be used for production work shifts.

---

### 3. Current Work Shifts Status

#### Fera's Shift (Morning)
- **Shift ID:** `793bb421-da3d-4842-99bd-3f7d6e848cc0`
- **Employee:** Fera Sales (fera@bambusilver.com)
- **Schedule:** 1:00 AM - 8:00 AM (UTC) = 8:00 AM - 3:00 PM (Local)
- **Location ID:** `a3a241a4-4841-45a3-90cd-f7135e6847b4` ✅ **CORRECT**

#### Nana's Shift (Evening)
- **Shift ID:** `4206d634-efe8-4168-8e44-350510260318`
- **Employee:** Nana Sales (nana@bambusilver.com)
- **Schedule:** 8:00 AM - 3:00 PM (UTC) = 3:00 PM - 10:00 PM (Local)
- **Location ID:** `a3a241a4-4841-45a3-90cd-f7135e6847b4` ✅ **CORRECT**

**IMPORTANT:** Both shifts are already pointing to the correct Seminyak location!

---

### 4. Store-Location Relationship

At the Seminyak location (`a3a241a4-4841-45a3-90cd-f7135e6847b4`), there is **ONLY ONE** store:

- **Seminyak (BS-03)** - `f6ec35ea-b90c-46cf-ad39-4429f7d48c6e`

This means the auth routing controller should have no ambiguity when resolving the store from the work shift.

---

## Root Cause Analysis

### Why Was the Wrong Store ID Being Used?

The issue is **NOT** in the work shifts themselves (they're correct). The problem is likely in:

1. **Auth Routing Controller Logic** - The controller may be:
   - Picking the first store at ANY location (not just the shift's location)
   - Using a cached/stale store ID
   - Joining tables incorrectly

2. **Multiple Stores at Same Location** - While the Seminyak location only has 1 store, other locations have multiple stores (e.g., the E2E test location has many E2E stores). The controller logic may be picking stores from the wrong location.

3. **Test Data Pollution** - The E2E test stores are still in production database and may be interfering with queries that don't properly filter by location.

---

## All Stores in Tenant (tnt-3rlhko)

| Store Name | Store Code | Store ID | Location ID | Status |
|------------|------------|----------|-------------|--------|
| Anchor | BS-AN | dec9e45b-8333-4404-a723-3a0497a7b144 | a370e7ca-c1f7-4180-8824-846eaa6a3c8e | Active |
| Double Six | BS-01 | de5f764b-ca3a-45b1-9a0d-3559278882eb | f7b7e5f0-0fb8-4995-8840-ff4577d84989 | Active |
| Sahadewa | BS-02 | 9062d2bc-67e5-4174-a9c1-7532d4c82e3a | ee3bcfcf-d49c-4894-8b52-0e87df2794ff | Active |
| **Seminyak** | **BS-03** | **f6ec35ea-b90c-46cf-ad39-4429f7d48c6e** | **a3a241a4-4841-45a3-90cd-f7135e6847b4** | **Active** |
| SS | BS-SS | c2221884-ce83-4493-a35a-17d372218694 | ccd6c269-7a9e-4540-8b20-198ac296f701 | Active |
| E2E test stores | Various | Multiple IDs | 1db74f6e-cabd-4f43-85f3-bb583e2c5ea7 | Test Data |

---

## SQL Queries Used

### Query 1: List All Stores
```sql
SELECT id, name, code, location_id, created_at, deleted_at
FROM stores 
WHERE tenant_id = 'tnt-3rlhko' 
ORDER BY name;
```

### Query 2: Find Seminyak Store
```sql
SELECT id, name, code, location_id 
FROM stores 
WHERE tenant_id = 'tnt-3rlhko' 
  AND code = 'BS-03';
```

### Query 3: Check Current Work Shifts
```sql
SELECT 
  s.id as shift_id,
  e.first_name,
  e.last_name,
  e.email,
  s.location_id,
  s.start_time,
  s.end_time
FROM hr_work_shifts s
JOIN employees e ON e.id = s.employee_id
WHERE s.tenant_id = 'tnt-3rlhko'
  AND e.email IN ('fera@bambusilver.com', 'nana@bambusilver.com')
  AND DATE(s.start_time) = CURRENT_DATE
ORDER BY s.start_time;
```

### Query 4: Stores at Seminyak Location
```sql
SELECT id, name, code 
FROM stores 
WHERE location_id = 'a3a241a4-4841-45a3-90cd-f7135e6847b4' 
ORDER BY created_at;
```

### Query 5: Check Problematic Store
```sql
SELECT id, name, code, location_id 
FROM stores 
WHERE id = '1bcb0547-d886-43c3-acf5-ac4866032cdb';
```

---

## Next Steps (Recommendations)

### ✅ Task 1 Subtask: COMPLETED
- [x] Know the correct store ID for Seminyak (BS-03): `f6ec35ea-b90c-46cf-ad39-4429f7d48c6e`

### Task 2: NOT NEEDED
- Work shifts are already correct - they reference the right location
- The issue is in the backend controller logic, not the shift data

### Task 3: CRITICAL - Fix Auth Routing Controller
The controller needs to:
1. Join `hr_work_shifts` → `locations` → `stores` **using the shift's location_id**
2. Filter out deleted/inactive stores
3. Add logging to show which store is resolved
4. Handle edge cases gracefully

### Recommended Code Fix:
```typescript
// In auth-routing.controller.ts
const activeShift = await this.prisma.hr_work_shifts.findFirst({
  where: {
    employee_id: user.employee_id,
    tenant_id: user.tenant_id,
    start_time: { lte: now },
    end_time: { gte: now },
  },
  include: {
    locations: {
      include: {
        stores: {
          where: {
            deleted_at: null,  // Filter out deleted stores
            // Optionally: status: 'active'
          },
        },
      },
    },
  },
});

if (activeShift?.locations?.stores?.length > 0) {
  // Prefer active stores
  const activeStores = activeShift.locations.stores.filter(s => s.status === 'active');
  const store = activeStores[0] || activeShift.locations.stores[0];
  
  console.log(`[AuthRouting] Resolved store: ${store.name} (${store.id}) for shift ${activeShift.id}`);
  
  return {
    store_id: store.id,
    store_name: store.name,
    location_id: activeShift.location_id,
    shift_id: activeShift.id,
  };
}
```

---

## Conclusion

✅ **Correct Seminyak Store ID:** `f6ec35ea-b90c-46cf-ad39-4429f7d48c6e`  
✅ **Work shifts are correctly configured**  
❌ **Issue is in the backend auth routing controller logic**  

The work shifts are pointing to the correct location. The problem is that the auth routing controller is somehow returning the wrong store ID (an E2E test store) instead of the correct Seminyak store. This needs to be fixed in Task 3 by improving the store resolution logic in the backend controller.
