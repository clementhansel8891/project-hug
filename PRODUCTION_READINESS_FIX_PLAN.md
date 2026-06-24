# Production Readiness - Fix Plan

## Date: June 24, 2026
## Goal: Clean, production-grade application ready for use

---

## Issues Identified

### HIGH PRIORITY (Blocking Production Use)

#### 1. ❌ Inventory Schema Mismatches
**Issue**: Column names don't match expected API
- `stock_movements.movement_date` - doesn't exist
- `stock_levels.quantity_on_hand` - doesn't exist
**Impact**: Stock deduction may fail after sales
**Fix**: Discover actual column names and update API/queries

#### 2. ❌ Sales Order Schema Verification Needed
**Issue**: Column names uncertain
- `sales_orders.order_number` - may have different name
- `sales_orders.total_amount` - may have different name
**Impact**: Transaction display and queries may fail
**Fix**: Verify actual schema and ensure API consistency

#### 3. ❌ Money Sources Missing at Seminyak
**Issue**: No money sources found for Seminyak store
**Impact**: Payment processing may fail
**Fix**: Verify money sources setup and create if missing

#### 4. ❌ HR Attendance JSONB Column Issue
**Issue**: `check_in` column is JSONB instead of TIMESTAMP
**Impact**: Attendance queries fail
**Fix**: Verify schema and fix column type or queries

### MEDIUM PRIORITY (Quality & Reliability)

#### 5. ⚠️ Store Resolution at Wrong Location
**Issue**: Past shifts opened at wrong store (Anchor instead of Seminyak)
**Impact**: Shift data inconsistent, location verification failing
**Fix**: Improve store resolution logic in RetailContext

#### 6. ⚠️ Cross-Module Data Flow Untested
**Issue**: Sales → Finance and Sales → Inventory linkages not verified
**Impact**: Unknown if accounting and inventory updates work
**Fix**: Test with actual sale, verify linkages

#### 7. ⚠️ E2E Test Store Filtering
**Issue**: E2E test stores may still pollute queries
**Impact**: User sees test data in production
**Fix**: Ensure E2E stores are properly excluded everywhere

### LOW PRIORITY (Polish & Enhancement)

#### 8. 📝 Console-Only Shift Status Messages
**Issue**: Shift status messages only in console logs
**Impact**: Users don't see helpful messages
**Fix**: Add toast notifications for shift status

#### 9. 📝 No Shift Status Indicator in POS
**Issue**: No visual indicator of shift status
**Impact**: Users unsure of shift state
**Fix**: Add shift status badge/indicator to POS header

#### 10. 📝 TypeScript Warnings in Build
**Issue**: Duplicate case clauses in theme-colors.ts
**Impact**: Build warnings, potential bugs
**Fix**: Remove duplicate cases

---

## Fix Execution Plan

### Phase 1: Critical Schema Fixes (30 min)
1. Discover actual schema for all tables
2. Fix inventory column references
3. Fix sales order column references
4. Fix HR attendance column type issue
5. Verify money sources exist

### Phase 2: Data & Logic Fixes (20 min)
6. Improve store resolution logic
7. Ensure E2E test stores are excluded
8. Close any remaining orphaned shifts
9. Verify work shift schedules

### Phase 3: Testing & Validation (30 min)
10. Test full POS flow as Nana
11. Verify data persistence to all tables
12. Validate cross-module data flow
13. Test as Fera (different shift)
14. Check RBAC and multi-tenant isolation

### Phase 4: Polish & Deploy (20 min)
15. Fix TypeScript warnings
16. Build and test locally
17. Deploy to VPS
18. Final smoke test
19. Update documentation

**Total Estimated Time**: 100 minutes (1h 40min)

---

## Success Criteria

### ✅ Must Have:
- [ ] All schema column names correct
- [ ] POS shift open/close working
- [ ] Sales transaction creates records in all tables
- [ ] Finance journal entries created automatically
- [ ] Inventory stock deducted correctly
- [ ] Payment transactions recorded
- [ ] No 403 Forbidden errors
- [ ] No schema/column errors
- [ ] Clean build with no errors
- [ ] All tests passing

### ✅ Should Have:
- [ ] Money sources configured for Seminyak
- [ ] E2E stores excluded from all queries
- [ ] Work shifts validated for 30 days
- [ ] Shift status messages visible to users
- [ ] Cross-module linkages verified

### ✅ Nice to Have:
- [ ] Shift status indicator in UI
- [ ] Toast notifications for shift events
- [ ] Zero TypeScript warnings

---

## Execution Start

Starting with Phase 1: Critical Schema Fixes...
