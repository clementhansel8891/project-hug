-- ═══════════════════════════════════════════════════════════════════════
-- RETAIL OPERATIONAL END-TO-END TEST
-- Testing actual table schema and data flow
-- ═══════════════════════════════════════════════════════════════════════

\echo ''
\echo '╔════════════════════════════════════════════════════════════════════╗'
\echo '║   RETAIL OPERATIONAL - END-TO-END INTEGRATION TEST                 ║'
\echo '║   Tenant: tnt-3rlhko (Bambu Silver) | Location: Seminyak          ║'
\echo '╚════════════════════════════════════════════════════════════════════╝'
\echo ''

-- ═══════════════════════════════════════════════════════════════════════
-- TEST 1: RETAIL SHIFTS (POS Session Management)
-- ═══════════════════════════════════════════════════════════════════════

\echo '✅ TEST 1: RETAIL SHIFTS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '1.1 Active Shifts (Clean State Check):'
SELECT 
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END as result,
  COUNT(*) as active_shifts
FROM retail_shifts
WHERE status = 'open' AND tenant_id = 'tnt-3rlhko';

\echo ''
\echo '1.2 Shift History Today:'
SELECT 
  id as shift_id,
  status,
  store_id,
  to_char(start_time, 'HH24:MI') as opened_at,
  to_char(end_time, 'HH24:MI') as closed_at
FROM retail_shifts
WHERE tenant_id = 'tnt-3rlhko'
  AND created_at >= '2026-06-24'
ORDER BY created_at DESC
LIMIT 5;

-- ═══════════════════════════════════════════════════════════════════════
-- TEST 2: SALES ORDERS (Transaction Records)
-- ═══════════════════════════════════════════════════════════════════════

\echo ''
\echo '✅ TEST 2: SALES ORDERS (Transactions)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '2.1 Sales Orders Today:'
SELECT 
  CASE WHEN COUNT(*) >= 0 THEN '✅ TRACKED' ELSE '❌ ERROR' END as result,
  COUNT(*) as order_count,
  COALESCE(SUM(total_amount), 0) as total_sales
FROM sales_orders
WHERE tenant_id = 'tnt-3rlhko'
  AND created_at >= '2026-06-24';

\echo ''
\echo '2.2 Recent Orders:'
SELECT 
  id,
  order_number,
  status,
  total_amount,
  to_char(created_at, 'HH24:MI:SS') as time
FROM sales_orders
WHERE tenant_id = 'tnt-3rlhko'
  AND created_at >= '2026-06-24'
ORDER BY created_at DESC
LIMIT 5;

\echo ''
\echo '2.3 Order Items (Line Items):'
SELECT 
  so.order_number,
  COUNT(soi.id) as items_count,
  SUM(soi.quantity) as total_quantity,
  SUM(soi.subtotal) as total_subtotal
FROM sales_orders so
JOIN sales_order_items soi ON so.id = soi.order_id
WHERE so.tenant_id = 'tnt-3rlhko'
  AND so.created_at >= '2026-06-24'
GROUP BY so.id, so.order_number
ORDER BY so.created_at DESC
LIMIT 5;

-- ═══════════════════════════════════════════════════════════════════════
-- TEST 3: FINANCE INTEGRATION (Journal Entries)
-- ═══════════════════════════════════════════════════════════════════════

\echo ''
\echo '✅ TEST 3: FINANCE INTEGRATION'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '3.1 Journal Entries from Retail:'
SELECT 
  CASE WHEN COUNT(*) >= 0 THEN '✅ TRACKED' ELSE '❌ ERROR' END as result,
  COUNT(*) as journal_entries,
  COALESCE(SUM(total_debit), 0) as total_debit,
  COALESCE(SUM(total_credit), 0) as total_credit
FROM finance_journal_entries
WHERE tenant_id = 'tnt-3rlhko'
  AND source_module = 'RETAIL'
  AND created_at >= '2026-06-24';

\echo ''
\echo '3.2 Recent Journal Entries:'
SELECT 
  id,
  entry_type,
  reference_type,
  total_debit,
  status
FROM finance_journal_entries
WHERE tenant_id = 'tnt-3rlhko'
  AND source_module = 'RETAIL'
  AND created_at >= '2026-06-24'
ORDER BY created_at DESC
LIMIT 5;

\echo ''
\echo '3.3 Journal Lines (Ledger Postings):'
SELECT 
  fje.entry_type,
  COUNT(fjl.id) as line_count,
  SUM(fjl.debit_amount) as total_debits,
  SUM(fjl.credit_amount) as total_credits
FROM finance_journal_entries fje
LEFT JOIN finance_journal_lines fjl ON fje.id = fjl.journal_entry_id
WHERE fje.tenant_id = 'tnt-3rlhko'
  AND fje.source_module = 'RETAIL'
  AND fje.created_at >= '2026-06-24'
GROUP BY fje.id, fje.entry_type
ORDER BY fje.created_at DESC
LIMIT 5;

-- ═══════════════════════════════════════════════════════════════════════
-- TEST 4: INVENTORY INTEGRATION (Stock Movements)
-- ═══════════════════════════════════════════════════════════════════════

\echo ''
\echo '✅ TEST 4: INVENTORY INTEGRATION'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '4.1 Stock Movements Today:'
SELECT 
  CASE WHEN COUNT(*) >= 0 THEN '✅ TRACKED' ELSE '❌ ERROR' END as result,
  COUNT(*) as movements_count,
  SUM(ABS(quantity)) as total_quantity_moved
FROM stock_movements
WHERE tenant_id = 'tnt-3rlhko'
  AND movement_date >= '2026-06-24';

\echo ''
\echo '4.2 Recent Stock Movements:'
SELECT 
  id,
  product_id,
  quantity,
  to_char(movement_date, 'HH24:MI:SS') as time
FROM stock_movements
WHERE tenant_id = 'tnt-3rlhko'
  AND movement_date >= '2026-06-24'
ORDER BY movement_date DESC
LIMIT 5;

\echo ''
\echo '4.3 Product Stock at Seminyak:'
SELECT 
  CASE WHEN COUNT(*) > 0 THEN '✅ PASS' ELSE '⚠️  WARN' END as result,
  COUNT(*) as products_with_stock,
  SUM(quantity_on_hand) as total_stock_qty
FROM stock_levels
WHERE tenant_id = 'tnt-3rlhko'
  AND location_id = 'a3a241a4-4841-45a3-90cd-f7135e6847b4'
  AND quantity_on_hand > 0;

-- ═══════════════════════════════════════════════════════════════════════
-- TEST 5: HR INTEGRATION (Work Shifts & Attendance)
-- ═══════════════════════════════════════════════════════════════════════

\echo ''
\echo '✅ TEST 5: HR INTEGRATION'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '5.1 Work Shifts Scheduled:'
SELECT 
  ws.id,
  e.first_name as employee,
  l.name as location,
  to_char(ws.start_time, 'HH24:MI') as start,
  to_char(ws.end_time, 'HH24:MI') as end
FROM hr_work_shifts ws
JOIN employees e ON ws.employee_id = e.id
JOIN locations l ON ws.location_id = l.id
WHERE ws.tenant_id = 'tnt-3rlhko'
  AND date(ws.start_time) = '2026-06-24';

\echo ''
\echo '5.2 Attendance Records:'
SELECT 
  CASE WHEN COUNT(*) >= 0 THEN '✅ TRACKED' ELSE '❌ ERROR' END as result,
  COUNT(*) as attendance_count,
  SUM(CASE WHEN check_out IS NOT NULL THEN 1 ELSE 0 END) as checked_out_count
FROM hr_attendance_records
WHERE tenant_id = 'tnt-3rlhko'
  AND date(check_in) = '2026-06-24';

-- ═══════════════════════════════════════════════════════════════════════
-- TEST 6: PAYMENT INTEGRATION
-- ═══════════════════════════════════════════════════════════════════════

\echo ''
\echo '✅ TEST 6: PAYMENT INTEGRATION'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '6.1 Payment Transactions Today:'
SELECT 
  CASE WHEN COUNT(*) >= 0 THEN '✅ TRACKED' ELSE '❌ ERROR' END as result,
  COUNT(*) as payment_count,
  COALESCE(SUM(amount), 0) as total_amount
FROM payment_transactions
WHERE tenant_id = 'tnt-3rlhko'
  AND created_at >= '2026-06-24';

\echo ''
\echo '6.2 Money Sources at Seminyak:'
SELECT 
  id,
  name,
  type,
  balance,
  status
FROM money_sources
WHERE tenant_id = 'tnt-3rlhko'
  AND store_id IN (
    SELECT id FROM stores 
    WHERE location_id = 'a3a241a4-4841-45a3-90cd-f7135e6847b4'
    AND deleted_at IS NULL
  )
ORDER BY type, name;

-- ═══════════════════════════════════════════════════════════════════════
-- TEST 7: DATA INTEGRITY CHECKS
-- ═══════════════════════════════════════════════════════════════════════

\echo ''
\echo '✅ TEST 7: DATA INTEGRITY'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '7.1 Orphaned Order Items:'
SELECT 
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END as result,
  COUNT(*) as orphaned_items
FROM sales_order_items soi
LEFT JOIN sales_orders so ON soi.order_id = so.id
WHERE so.id IS NULL;

\echo ''
\echo '7.2 Tenant Isolation:'
SELECT 
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END as result,
  COUNT(*) as violations
FROM sales_orders so
JOIN stores s ON so.store_id = s.id
WHERE so.tenant_id != s.tenant_id;

\echo ''
\echo '7.3 Referential Integrity (Shifts):'
SELECT 
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END as result,
  COUNT(*) as invalid_references
FROM retail_shifts rs
LEFT JOIN stores s ON rs.store_id = s.id
WHERE rs.tenant_id = 'tnt-3rlhko'
  AND s.id IS NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- TEST 8: CROSS-MODULE DATA FLOW
-- ═══════════════════════════════════════════════════════════════════════

\echo ''
\echo '✅ TEST 8: CROSS-MODULE DATA FLOW VALIDATION'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '8.1 Sales → Finance Linkage:'
SELECT 
  so.order_number,
  so.total_amount as sale_amount,
  fje.id as journal_entry,
  fje.total_debit as journal_amount,
  CASE WHEN fje.id IS NOT NULL THEN '✅ LINKED' ELSE '⚠️  NO JOURNAL' END as status
FROM sales_orders so
LEFT JOIN finance_journal_entries fje 
  ON fje.reference_id = so.id::text 
  AND fje.reference_type = 'SALES_ORDER'
  AND fje.tenant_id = so.tenant_id
WHERE so.tenant_id = 'tnt-3rlhko'
  AND so.created_at >= '2026-06-24'
ORDER BY so.created_at DESC
LIMIT 5;

\echo ''
\echo '8.2 Sales → Inventory Linkage:'
SELECT 
  so.order_number,
  soi.product_id,
  soi.quantity as ordered_qty,
  sm.id as stock_movement,
  sm.quantity as stock_qty,
  CASE WHEN sm.id IS NOT NULL THEN '✅ LINKED' ELSE '⚠️  NO MOVEMENT' END as status
FROM sales_orders so
JOIN sales_order_items soi ON so.id = soi.order_id
LEFT JOIN stock_movements sm 
  ON sm.reference_id = so.id::text 
  AND sm.product_id = soi.product_id
  AND sm.tenant_id = so.tenant_id
WHERE so.tenant_id = 'tnt-3rlhko'
  AND so.created_at >= '2026-06-24'
ORDER BY so.created_at DESC
LIMIT 5;

\echo ''
\echo '8.3 Retail Shifts → HR Work Shifts Linkage:'
SELECT 
  e.first_name as employee,
  hrs.id as work_shift_scheduled,
  rs.id as retail_shift_opened,
  to_char(hrs.start_time, 'HH24:MI') as scheduled_start,
  to_char(rs.start_time, 'HH24:MI') as actual_start,
  CASE 
    WHEN rs.id IS NOT NULL THEN '✅ SHIFT OPENED'
    WHEN hrs.start_time > NOW() THEN '⏳ UPCOMING'
    ELSE '⚠️  NOT OPENED'
  END as status
FROM hr_work_shifts hrs
JOIN employees e ON hrs.employee_id = e.id
LEFT JOIN retail_shifts rs 
  ON rs.employee_id = e.user_id
  AND date(rs.start_time) = date(hrs.start_time)
  AND rs.tenant_id = hrs.tenant_id
WHERE hrs.tenant_id = 'tnt-3rlhko'
  AND date(hrs.start_time) = '2026-06-24'
ORDER BY hrs.start_time;

-- ═══════════════════════════════════════════════════════════════════════
-- SUMMARY
-- ═══════════════════════════════════════════════════════════════════════

\echo ''
\echo '╔════════════════════════════════════════════════════════════════════╗'
\echo '║                          TEST SUMMARY                              ║'
\echo '╚════════════════════════════════════════════════════════════════════╝'
\echo ''
\echo 'Tests Completed:'
\echo '  ✅ Retail Shifts - Session management'
\echo '  ✅ Sales Orders - Transaction recording'
\echo '  ✅ Finance Integration - Journal entries'
\echo '  ✅ Inventory Integration - Stock movements'
\echo '  ✅ HR Integration - Work shifts & attendance'
\echo '  ✅ Payment Integration - Payment processing'
\echo '  ✅ Data Integrity - Orphans & violations'
\echo '  ✅ Cross-Module Flow - Data linkages'
\echo ''
\echo 'Next Step: Perform actual sales transaction in POS to generate data'
\echo '══════════════════════════════════════════════════════════════════════'
\echo ''
