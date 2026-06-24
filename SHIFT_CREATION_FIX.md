# Shift Creation Foreign Key Fix

**Date**: June 24, 2026
**Status**: ✅ FIXED AND DEPLOYED

## Problem

When SPG staff (e.g., Fera) tried to initialize a shift on the POS page, the system failed with:

```
Foreign key constraint violated: `retail_shifts_company_id_fkey (index)`
PrismaClientKnownRequestError at retail_shifts.create()
```

## Root Cause

The `openShift` method in `retail.db.repository.ts` was using `MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true })` to build the shift creation data. This utility includes the `company_id` from the `TenantContext`.

However, when there's no `x-company-id` header in the request (which is the case for POS operations), the `tenant.interceptor.ts` falls back to setting `company_id = tenant_id` in the context. This fallback value is not a valid company ID in the `companies` table, causing a foreign key violation when trying to insert into `retail_shifts` table.

## Database Schema

### `retail_shifts` table:
```prisma
model retail_shifts {
  id          String     @id @default(uuid())
  tenant_id   String
  company_id  String?    // Optional field with FK to companies
  store_id    String
  employee_id String
  // ... other fields
  companies   companies? @relation(fields: [company_id], references: [id])
  stores      stores     @relation(fields: [store_id], references: [id])
  tenants     tenants    @relation(fields: [tenant_id], references: [id])
}
```

### `stores` table:
```prisma
model stores {
  id         String     @id @default(uuid())
  tenant_id  String
  company_id String?    // Has valid company reference
  // ... other fields
  companies  companies? @relation(fields: [company_id], references: [id])
}
```

## Solution

Instead of using the context's `company_id` (which may be a fallback value), we now:

1. **Fetch the store record** to get its valid `company_id`
2. **Use the store's company_id** when creating the shift

### Code Changes

**File**: `backend/src/modules/retail/repositories/retail.db.repository.ts`

**Before**:
```typescript
async openShift(ctx: TenantContext,
  location_id: string,
  employee_id: string,
  data: OpenShiftDto,
  opened_by_id?: string,
): Promise<RetailShift> {
  const shift = await this.prisma.retail_shifts.create({
    data: {
      updated_at: new Date(),
      ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
      store_id: data.store_id,
      employee_id: employee_id,
      // ...
    },
  });
  return this.mapShift(shift);
}
```

**After**:
```typescript
async openShift(ctx: TenantContext,
  location_id: string,
  employee_id: string,
  data: OpenShiftDto,
  opened_by_id?: string,
): Promise<RetailShift> {
  // Fetch the store to get its company_id
  const store = await this.prisma.stores.findUnique({
    where: { id: data.store_id },
    select: { company_id: true },
  });

  if (!store) {
    throw new Error(`Store ${data.store_id} not found`);
  }

  const shift = await this.prisma.retail_shifts.create({
    data: {
      updated_at: new Date(),
      tenant_id: ctx.tenant_id,
      company_id: store.company_id, // Use store's company_id
      store_id: data.store_id,
      employee_id: employee_id,
      // ...
    },
  });
  return this.mapShift(shift);
}
```

## Why This Works

1. **Stores have valid company_id**: All 18 stores were updated to have `company_id = 'b74e21b9-4e99-42fd-857b-36bf4dee7ed5'` (Bambu Silver company)
2. **Shifts inherit from store**: By using the store's company_id, shifts are correctly associated with the same company
3. **No fallback dependency**: We no longer rely on the context's company_id fallback logic

## Deployment

```bash
# Local build
cd backend
npm run build

# Commit and push
git add backend/src/modules/retail/repositories/retail.db.repository.ts
git commit -m "fix: Use store's company_id for shift creation to avoid foreign key constraint error"
git push origin main

# VPS deployment
ssh ubuntu@150.109.15.108
cd ~/zenvix
git pull
docker compose build backend
docker compose restart backend
```

## Testing

**Test User**: Fera (fera@bambusilver.com / Fera2024!)
**Store**: Seminyak (BS-03)
**Expected Flow**:
1. Login → Redirected to `/m/retail/operational/pos`
2. Click "INITIALIZE TERMINAL" → Shift created successfully
3. POS opens for transactions

## Status

✅ Code fixed
✅ Build successful
✅ Deployed to VPS (http://150.109.15.108:3010)
⏳ Awaiting user confirmation that shift initialization works

## Related Files

- `backend/src/modules/retail/repositories/retail.db.repository.ts` - Fixed openShift method
- `backend/src/gateway/tenant.interceptor.ts` - Context company_id fallback logic
- `backend/prisma/schema.prisma` - Database schema (retail_shifts, stores tables)
- `POS_ROUTING_FIX_COMPLETE.md` - Previous fixes for authentication and routing
- `AUTHENTICATION_FIX_REPORT.md` - User credentials

## Next Steps

1. User should test shift initialization on live system
2. If successful, mark Task 3 as complete
3. Document complete end-to-end POS flow
