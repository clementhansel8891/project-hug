# Retail Operational Readiness Plan

**Date**: June 24, 2026  
**Objective**: Complete SPG operational workflow with proper access control, attendance tracking, and full testing

---

## Phase 1: Core Infrastructure (Priority: HIGH)

### 1.1 Logout Button & Access Control
**Status**: ⏳ TODO

**Requirements**:
- [ ] Add logout button to POS header/navigation
- [ ] Implement role-based routing guard for SPG users
- [ ] Restrict SPG access to retail operational pages only
- [ ] Block access to dashboard and non-authorized modules
- [ ] Add permission checks on backend API endpoints

**Files to Modify**:
- `src/pages/retail/operational/components/POSLayout.tsx` (or similar header)
- `src/contexts/AuthContext.tsx` (add logout function)
- `src/core/routes/RouteGuard.tsx` (add role-based restrictions)
- `backend/src/core/auth/guards/rbac.guard.ts` (enforce permissions)

**Implementation Details**:
```typescript
// Frontend: Logout button in POS header
<Button onClick={handleLogout}>
  <LogOut className="mr-2" />
  Logout
</Button>

// Route guard logic
if (userRole === 'EMPLOYEE') {
  // Only allow /m/retail/operational/* routes
  const allowedPaths = ['/m/retail/operational'];
  if (!allowedPaths.some(p => location.pathname.startsWith(p))) {
    return <Navigate to="/m/retail/operational/pos" />;
  }
}
```

---

### 1.2 Attendance Tracking Integration
**Status**: ⏳ TODO

**Requirements**:
- [ ] Auto-create attendance record on successful login
- [ ] Update attendance record on logout
- [ ] Link attendance to work shift
- [ ] Calculate work hours automatically
- [ ] Handle shift changes and breaks

**Database Tables**:
- `hr_attendance_records` - Main attendance log
- `hr_work_shifts` - Scheduled shifts
- `retail_shifts` - POS terminal shifts (different from work shifts!)

**Fields to Populate**:
```sql
hr_attendance_records {
  id: uuid
  tenant_id: string
  employee_id: string (from employee record)
  shift_id: string (from hr_work_shifts)
  store_id: string (from current store context)
  check_in: timestamp (login time)
  check_out: timestamp (logout time)
  status: 'PRESENT' | 'ABSENT' | 'LATE'
  work_hours: decimal (calculated)
  notes: string (optional)
}
```

**Implementation Flow**:
1. **On Login** (after successful auth):
   - Get employee_id from user
   - Get active hr_work_shift for today
   - Create attendance record with check_in = NOW
   - Store attendance_id in session

2. **On Logout**:
   - Retrieve attendance_id from session
   - Update attendance record with check_out = NOW
   - Calculate work_hours = check_out - check_in
   - Set status based on shift compliance

**Files to Create/Modify**:
- `backend/src/modules/hr/services/attendance.service.ts`
- `backend/src/core/auth/auth.service.ts` (integrate attendance on login)
- `src/contexts/AuthContext.tsx` (call attendance API on logout)

---

## Phase 2: Operational Testing (Priority: HIGH)

### 2.1 Test Scenarios for Fera & Nana

#### Scenario 1: Complete Shift Workflow
**Fera (Morning Shift: 8am-3pm)**
- [ ] 1. Login at 8:00 AM → Verify attendance created
- [ ] 2. Redirected to Seminyak POS
- [ ] 3. Initialize terminal (declare opening cash)
- [ ] 4. Shift opens successfully
- [ ] 5. Process test transactions (see below)
- [ ] 6. Close shift at 3:00 PM
- [ ] 7. Logout → Verify attendance updated

**Nana (Afternoon Shift: 3pm-10pm)**
- [ ] 1. Login at 3:00 PM → Verify attendance created
- [ ] 2. Redirected to Seminyak POS
- [ ] 3. Initialize terminal
- [ ] 4. Continue from Fera's shift or start new
- [ ] 5. Process test transactions
- [ ] 6. Close shift at 10:00 PM
- [ ] 7. Logout → Verify attendance updated

---

#### Scenario 2: Transaction Processing Tests

**Test Cases**:

1. **Cash Sale** (5 transactions)
   - [ ] Search product by name
   - [ ] Search product by barcode
   - [ ] Add to cart
   - [ ] Apply quantity
   - [ ] Calculate total
   - [ ] Accept cash payment
   - [ ] Print receipt
   - [ ] Verify: `retail_orders`, `retail_order_items`, `stock_levels` updated

2. **Card Payment** (3 transactions)
   - [ ] Add products to cart
   - [ ] Select card payment method
   - [ ] Complete transaction
   - [ ] Verify: Payment gateway integration works
   - [ ] Verify: `payment_transactions` created

3. **Mixed Payment** (2 transactions)
   - [ ] Cart total: IDR 1,500,000
   - [ ] Pay IDR 1,000,000 cash
   - [ ] Pay IDR 500,000 card
   - [ ] Verify: Split payment recorded correctly

4. **Discount Application** (3 transactions)
   - [ ] Apply percentage discount (10%)
   - [ ] Apply fixed amount discount (IDR 50,000)
   - [ ] Apply promotional code
   - [ ] Verify: Discount reflected in order

5. **Return/Refund** (2 transactions)
   - [ ] Find original order
   - [ ] Process full return
   - [ ] Process partial return
   - [ ] Verify: Stock restored, refund recorded

6. **Customer Registration** (2 customers)
   - [ ] Create new customer during checkout
   - [ ] Link transaction to customer
   - [ ] Verify: `retail_customers` table populated

7. **Cash Management**
   - [ ] Cash IN (petty cash deposit)
   - [ ] Cash OUT (expense)
   - [ ] Verify: `retail_cash_movements` table updated
   - [ ] Verify: Expected cash balance correct

8. **Inventory Check**
   - [ ] View product stock levels
   - [ ] Check low stock alerts
   - [ ] Verify: Stock quantities accurate

---

#### Scenario 3: Edge Cases & Error Handling

- [ ] 1. **Out of Stock**: Try to sell product with 0 stock
- [ ] 2. **Insufficient Payment**: Customer pays less than total
- [ ] 3. **Network Failure**: Simulate offline mode (if supported)
- [ ] 4. **Shift Already Open**: Try to open shift when one is active
- [ ] 5. **Close with Variance**: Close shift with cash discrepancy
- [ ] 6. **Invalid Barcode**: Scan non-existent barcode
- [ ] 7. **Concurrent Users**: Both Fera and Nana use POS simultaneously
- [ ] 8. **Session Timeout**: Leave POS idle for extended period

---

### 2.2 Data Verification Queries

After each test scenario, run these SQL queries to verify data integrity:

```sql
-- 1. Verify orders created
SELECT 
  o.id, o.order_number, o.total_amount, o.status, o.employee_id,
  e.first_name, e.last_name, s.name as store_name
FROM retail_orders o
JOIN employees e ON o.employee_id = e.id
JOIN stores s ON o.store_id = s.id
WHERE o.created_at >= '2026-06-24'
ORDER BY o.created_at DESC;

-- 2. Verify order items
SELECT 
  oi.order_id, oi.product_id, im.name as product_name, 
  oi.quantity, oi.unit_price, oi.total_price
FROM retail_order_items oi
JOIN item_masters im ON oi.product_id = im.id
WHERE oi.created_at >= '2026-06-24'
ORDER BY oi.created_at DESC;

-- 3. Verify stock movements
SELECT 
  sm.id, sm.product_id, im.name as product_name,
  sm.quantity, sm.type, sm.reference_type, sm.reference_id
FROM stock_movements sm
JOIN item_masters im ON sm.product_id = im.id
WHERE sm.tenant_id = 'tnt-3rlhko'
AND sm.created_at >= '2026-06-24'
ORDER BY sm.created_at DESC;

-- 4. Verify stock levels updated
SELECT 
  sl.product_id, im.name as product_name, im.sku,
  sl.on_hand, sl.reserved, sl.available
FROM stock_levels sl
JOIN item_masters im ON sl.product_id = im.id
WHERE sl.location_id = 'a3a241a4-4841-45a3-90cd-f7135e6847b4' -- Seminyak
ORDER BY sl.updated_at DESC
LIMIT 20;

-- 5. Verify shifts
SELECT 
  rs.id, rs.employee_id, e.first_name, e.last_name,
  rs.start_time, rs.end_time, rs.opening_cash, rs.closing_cash,
  rs.expected_cash, rs.status
FROM retail_shifts rs
JOIN employees e ON rs.employee_id = e.id
WHERE rs.created_at >= '2026-06-24'
ORDER BY rs.start_time DESC;

-- 6. Verify cash movements
SELECT 
  rcm.id, rcm.shift_id, rcm.type, rcm.amount, rcm.reason, rcm.notes
FROM retail_cash_movements rcm
WHERE rcm.created_at >= '2026-06-24'
ORDER BY rcm.created_at DESC;

-- 7. Verify attendance records
SELECT 
  har.id, har.employee_id, e.first_name, e.last_name,
  har.check_in, har.check_out, har.work_hours, har.status
FROM hr_attendance_records har
JOIN employees e ON har.employee_id = e.id
WHERE har.check_in >= '2026-06-24'
ORDER BY har.check_in DESC;

-- 8. Verify payment transactions
SELECT 
  pt.id, pt.order_id, pt.amount, pt.currency, pt.status, 
  pt.payment_method, pt.provider_response
FROM payment_transactions pt
WHERE pt.created_at >= '2026-06-24'
ORDER BY pt.created_at DESC;

-- 9. Verify finance ledger postings (if auto-posting enabled)
SELECT 
  flp.id, flp.account_id, fca.account_code, fca.account_name,
  flp.debit, flp.credit, flp.reference_type, flp.reference_id
FROM finance_ledger_postings flp
JOIN finance_chart_of_accounts fca ON flp.account_id = fca.id
WHERE flp.posting_date >= '2026-06-24'
ORDER BY flp.created_at DESC;

-- 10. Check for any errors or incomplete records
SELECT 
  o.id, o.order_number, o.status, o.total_amount, o.created_at
FROM retail_orders o
WHERE o.created_at >= '2026-06-24'
AND (o.status NOT IN ('completed', 'paid') OR o.total_amount <= 0)
ORDER BY o.created_at DESC;
```

---

## Phase 3: Module Integration Verification (Priority: MEDIUM)

### 3.1 Finance Module Integration

**Verify**:
- [ ] Sales revenue posted to correct GL accounts
- [ ] Payment receipts recorded in AR
- [ ] Tax calculations accurate
- [ ] Daily sales summary in financial snapshots

**Test Query**:
```sql
-- Check GL postings from retail sales
SELECT 
  DATE(flp.posting_date) as date,
  fca.account_code, fca.account_name,
  SUM(flp.debit) as total_debit,
  SUM(flp.credit) as total_credit
FROM finance_ledger_postings flp
JOIN finance_chart_of_accounts fca ON flp.account_id = fca.id
WHERE flp.reference_type = 'RETAIL_ORDER'
AND flp.posting_date >= '2026-06-24'
GROUP BY DATE(flp.posting_date), fca.account_code, fca.account_name
ORDER BY date DESC, fca.account_code;
```

---

### 3.2 Inventory Module Integration

**Verify**:
- [ ] Stock decrements on sale
- [ ] Stock increments on return
- [ ] Reservations cleared on transaction completion
- [ ] Low stock alerts triggered
- [ ] Inventory valuation updated (FIFO/LIFO)

**Test Query**:
```sql
-- Inventory movement summary
SELECT 
  im.id, im.sku, im.name,
  SUM(CASE WHEN sm.type = 'SALE' THEN -sm.quantity ELSE 0 END) as sold,
  SUM(CASE WHEN sm.type = 'RETURN' THEN sm.quantity ELSE 0 END) as returned,
  sl.on_hand as current_stock
FROM item_masters im
JOIN stock_movements sm ON im.id = sm.product_id
LEFT JOIN stock_levels sl ON im.id = sl.product_id AND sl.location_id = 'a3a241a4-4841-45a3-90cd-f7135e6847b4'
WHERE sm.created_at >= '2026-06-24'
GROUP BY im.id, im.sku, im.name, sl.on_hand
ORDER BY sold DESC;
```

---

### 3.3 HR Module Integration

**Verify**:
- [ ] Attendance records created/updated
- [ ] Work hours calculated correctly
- [ ] Commission calculations (if applicable)
- [ ] Performance metrics tracked (sales per employee)

**Test Query**:
```sql
-- Employee performance summary
SELECT 
  e.id, e.first_name, e.last_name,
  COUNT(DISTINCT ro.id) as transactions_count,
  SUM(ro.total_amount) as total_sales,
  AVG(ro.total_amount) as avg_transaction_value,
  har.check_in, har.check_out, har.work_hours
FROM employees e
LEFT JOIN retail_orders ro ON e.id = ro.employee_id AND ro.created_at >= '2026-06-24'
LEFT JOIN hr_attendance_records har ON e.id = har.employee_id AND har.check_in >= '2026-06-24'
WHERE e.tenant_id = 'tnt-3rlhko'
AND e.email IN ('fera@bambusilver.com', 'nana@bambusilver.com')
GROUP BY e.id, e.first_name, e.last_name, har.check_in, har.check_out, har.work_hours;
```

---

### 3.4 Sales Module Integration

**Verify**:
- [ ] Retail orders appear in sales module
- [ ] Customer purchase history tracked
- [ ] Sales analytics updated
- [ ] Revenue attribution correct

---

## Phase 4: Implementation Checklist

### Step 1: Add Logout Button (30 min)
- [ ] Find POS header/navigation component
- [ ] Add logout button with icon
- [ ] Wire up to AuthContext.logout()
- [ ] Test logout clears session
- [ ] Test redirect after logout

### Step 2: Implement Attendance Tracking (2 hours)
- [ ] Create attendance service
- [ ] Hook into login flow
- [ ] Hook into logout flow
- [ ] Test attendance record creation
- [ ] Test work hours calculation

### Step 3: Add Role-Based Access Control (1 hour)
- [ ] Create route guard for SPG users
- [ ] Block dashboard access
- [ ] Allow only retail operational routes
- [ ] Test with Fera and Nana accounts
- [ ] Verify redirect logic

### Step 4: Operational Testing (4-6 hours)
- [ ] Execute all test scenarios
- [ ] Document any bugs found
- [ ] Run data verification queries
- [ ] Check module integrations
- [ ] Create test results report

---

## Success Criteria

✅ **Access Control**:
- SPG users cannot access dashboard
- SPG users can access POS
- Logout button visible and functional

✅ **Attendance**:
- Login creates attendance record
- Logout updates attendance with check_out time
- Work hours calculated accurately

✅ **Operational Functions**:
- All transaction types work (cash, card, mixed)
- Discounts apply correctly
- Returns/refunds process properly
- Cash management functions work
- Stock levels update in real-time

✅ **Data Integrity**:
- All retail operations write to database
- Finance module receives postings
- Inventory module sees stock movements
- HR module has attendance records
- No orphaned or incomplete records

---

## Next Steps After Completion

1. **Performance Testing**: Test with high transaction volume
2. **Security Audit**: Review permissions and data access
3. **Documentation**: Create SPG user manual
4. **Training**: Prepare training materials for actual SPG staff
5. **Retail Management Access**: Configure selected management features for SPG

---

## Timeline Estimate

- **Phase 1** (Infrastructure): 3-4 hours
- **Phase 2** (Testing): 4-6 hours
- **Phase 3** (Verification): 2-3 hours
- **Total**: ~12 hours (1.5 days)

---

## Priority Order

1. **URGENT**: Logout button + Attendance tracking (users need this now)
2. **HIGH**: Access control (security requirement)
3. **HIGH**: Operational testing (validate system works)
4. **MEDIUM**: Module integration verification (data quality)
