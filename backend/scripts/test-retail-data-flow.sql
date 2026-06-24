-- ═══════════════════════════════════════════════════════════════════════
-- RETAIL OPERATIONAL DATA FLOW - INTEGRATION TEST
-- Testing data persistence and cross-module integration
-- ═══════════════════════════════════════════════════════════════════════

\echo ''
\echo '╔════════════════════════════════════════════════════════════════════╗'
\echo '║   RETAIL OPERATIONAL DATA FLOW TEST                                ║'
\echo '║   Tenant: tnt-3rlhko (Bambu Silver)                                ║'
\echo '║   Location: Seminyak                                               ║'
\echo '╚════════════════════════════════════════════════════════════════════╝'
\echo ''

-- ═══════════════════════════════════════════════════════════════════════
-- TEST 1: RETAIL SHIFTS MODULE
-- ═══════════════════════════════════════════════════════════════════════

\echo ''
\echo '🔍 TEST 1: Retail Shifts'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

\echo '1.1 Active Shifts (should be 0 for clean state):'
SELECT COUNT(*) as active_shifts_count
FROM retail_shifts
WHERE status = 'open'
  AND tenant_id = 'tnt-3rlhko';

\echo ''
\echo '1.2 Recent Shift History (today):'
SELECT 
  id,
  status,
  store_id,
  employee_id,
  to_char(start_time, 'HH24:MI') as start_time,
  to_char(end_time, 'HH24:MI') as end_time
FROM retail_shifts
WHERE tenant_id = 'tnt-3rlhko'
  AND created_at >= '2026-06-24'
ORDER BY created_at DESC
LIMIT 5;

-- ═══════════════════════════════════════════════════════════════════════
-- TEST 2: RETAIL TRANSACTIONS MODULE
-- ═══════════════════════════════════════════════════════════════════════

\echo ''
\echo '🔍 TEST 2: Retail Transactions'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

\echo '2.1 Transaction Records (today):'
SELECT 
  COUNT(*) as total_transactions,
  SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
  SUM(total_amount) as total_sales_amount
FROM sales_transactions
WHERE tenant_id = 'tnt-3rlhko'
  AND created_at >= '2026-06-24';

\echo ''
\echo '2.2 Recent Transactions:'
SELECT 
  id,
  transaction_number,
  status,
  total_amount,
  to_char(created_at, 'HH24:MI:SS') as time
FROM sales_transactions
WHERE tenant_id = 'tnt-3rlhko'
  AND created_at >= '2026-06-24'
ORDER BY created_at DESC
LIMIT 5;

\echo ''
\echo '2.3 Transaction Items (sample from latest transaction):'
SELECT 
  st.transaction_number,
  sti.product_id,
  sti.quantity,
  sti.unit_price,
  sti.subtotal
FROM sales_transactions st
JOIN sales_transaction_items sti ON st.id = sti.transaction_id
WHERE st.tenant_id = 'tnt-3rlhko'
  AND st.created_at >= '2026-06-24'
ORDER BY st.created_at DESC, sti.line_number
LIMIT 5;

-- ═══════════════════════════════════════════════════════════════════════
-- TEST 3: FINANCE INTEGRATION
-- ═══════════════════════════════════════════════════════════════════════

\echo ''
\echo '🔍 TEST 3: Finance Integration'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

\echo '3.1 Journal Entries from Retail:'
SELECT 
  COUNT(*) as journal_entries_count,
  SUM(total_debit) as total_debit_amount,
  SUM(total_credit) as total_credit_amount
FROM journal_entries
WHERE tenant_id = 'tnt-3rlhko'
  AND source_module = 'RETAIL'
  AND created_at >= '2026-06-24';

\echo ''
\echo '3.2 Recent Journal Entries:'
SELECT 
  id,
  entry_type,
  reference_type,
  reference_id,
  total_debit,
  status
FROM journal_entries
WHERE tenant_id = 'tnt-3rlhko'
  AND source_module = 'RETAIL'
  AND created_at >= '2026-06-24'
ORDER BY created_at DESC
LIMIT 5;

\echo ''
\echo '3.3 Ledger Lines (sample from latest entry):'
SELECT 
  je.entry_type,
  le.account_id,
  le.debit_amount,
  le.credit_amount
FROM journal_entries je
JOIN ledger_entries le ON je.id = le.journal_entry_id
WHERE je.tenant_id = 'tnt-3rlhko'
  AND je.source_module = 'RETAIL'
  AND je.created_at >= '2026-06-24'
ORDER BY je.created_at DESC, le.created_at
LIMIT 5;

-- ═══════════════════════════════════════════════════════════════════════
-- TEST 4: INVENTORY INTEGRATION
-- ═══════════════════════════════════════════════════════════════════════

\echo ''
\echo '🔍 TEST 4: Inventory Integration'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

\echo '4.1 Stock Movements from Sales:'
SELECT 
  COUNT(*) as stock_movements_count,
  SUM(ABS(quantity)) as total_quantity_moved
FROM stock_movements
WHERE tenant_id = 'tnt-3rlhko'
  AND transaction_type = 'SALE'
  AND created_at >= '2026-06-24';

\echo ''
\echo '4.2 Recent Stock Movements:'
SELECT 
  id,
  product_id,
  quantity,
  transaction_type,
  reference_id
FROM stock_movements
WHERE tenant_id = 'tnt-3rlhko'
  AND transaction_type = 'SALE'
  AND created_at >= '2026-06-24'
ORDER BY created_at DESC
LIMIT 5;

\echo ''
\echo '4.3 Product Stock at Seminyak:'
SELECT 
  COUNT(*) as products_with_stock
FROM product_stock
WHERE tenant_id = 'tnt-3rlhko'
  AND location_id = 'a3a241a4-4841-45a3-90cd-f7135e6847b4'
  AND quantity_available > 0;

-- ═══════════════════════════════════════════════════════════════════════
-- TEST 5: HR INTEGRATION
-- ═══════════════════════════════════════════════════════════════════════

\echo ''
\echo '🔍 TEST 5: HR Integration'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

\echo '5.1 Work Shifts Scheduled Today:'
SELECT 
  ws.id,
  e.first_name as employee,
  l.name as location,
  to_char(ws.start_time, 'HH24:MI') as start_time,
  to_char(ws.end_time, 'HH24:MI') as end_time
FROM hr_work_shifts ws
JOIN employees e ON ws.employee_id = e.id
JOIN locations l ON ws.location_id = l.id
WHERE ws.tenant_id = 'tnt-3rlhko'
  AND date(ws.start_time) = '2026-06-24'
ORDER BY ws.start_time;

\echo ''
\echo '5.2 Attendance Records:'
SELECT 
  COUNT(*) as attendance_records_count,
  SUM(CASE WHEN check_out IS NOT NULL THEN 1 ELSE 0 END) as checked_out
FROM hr_attendance_records
WHERE tenant_id = 'tnt-3rlhko'
  AND check_in >= '2026-06-24';

-- ═══════════════════════════════════════════════════════════════════════
-- TEST 6: PAYMENT INTEGRATION
-- ═══════════════════════════════════════════════════════════════════════

\echo ''
\echo '🔍 TEST 6: Payment Integration'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

\echo '6.1 Payment Records (today):'
SELECT 
  COUNT(*) as payment_count,
  payment_method,
  SUM(amount) as total_amount,
  SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_count
FROM sales_payments
WHERE tenant_id = 'tnt-3rlhko'
  AND created_at >= '2026-06-24'
GROUP BY payment_method;

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
  );

-- ═══════════════════════════════════════════════════════════════════════
-- TEST 7: DATA INTEGRITY
-- ═══════════════════════════════════════════════════════════════════════

\echo ''
\echo '🔍 TEST 7: Data Integrity'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

\echo '7.1 Orphaned Transaction Items (should be 0):'
SELECT COUNT(*) as orphaned_items_count
FROM sales_transaction_items sti
LEFT JOIN sales_transactions st ON sti.transaction_id = st.id
WHERE st.id IS NULL;

\echo ''
\echo '7.2 Tenant Isolation Check (should be 0):'
SELECT COUNT(*) as cross_tenant_violations
FROM sales_transactions st
JOIN stores s ON st.store_id = s.id
WHERE st.tenant_id != s.tenant_id;

\echo ''
\echo '7.3 Referential Integrity - Shifts with Invalid Stores (should be 0):'
SELECT COUNT(*) as invalid_shift_references
FROM retail_shifts rs
LEFT JOIN stores s ON rs.store_id = s.id
WHERE rs.tenant_id = 'tnt-3rlhko'
  AND s.id IS NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- TEST 8: CROSS-MODULE DATA FLOW
-- ═══════════════════════════════════════════════════════════════════════

\echo ''
\echo '🔍 TEST 8: Cross-Module Data Flow'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

\echo '8.1 Sales → Finance Flow:'
SELECT 
  st.transaction_number as sale_transaction,
  st.total_amount as sale_amount,
  je.id as journal_entry_id,
  je.total_debit as journal_debit,
  je.status as journal_status
FROM sales_transactions st
LEFT JOIN journal_entries je ON je.reference_id = st.id::text 
  AND je.reference_type = 'SALES_TRANSACTION'
WHERE st.tenant_id = 'tnt-3rlhko'
  AND st.created_at >= '2026-06-24'
ORDER BY st.created_at DESC
LIMIT 5;

\echo ''
\echo '8.2 Sales → Inventory Flow:'
SELECT 
  st.transaction_number as sale_transaction,
  sti.product_id,
  sti.quantity as sold_quantity,
  sm.id as stock_movement_id,
  sm.quantity as stock_movement_qty
FROM sales_transactions st
JOIN sales_transaction_items sti ON st.id = sti.transaction_id
LEFT JOIN stock_movements sm ON sm.reference_id = st.id::text 
  AND sm.product_id = sti.product_id
WHERE st.tenant_id = 'tnt-3rlhko'
  AND st.created_at >= '2026-06-24'
ORDER BY st.created_at DESC
LIMIT 5;

-- ═══════════════════════════════════════════════════════════════════════
-- SUMMARY
-- ═══════════════════════════════════════════════════════════════════════

\echo ''
\echo '════════════════════════════════════════════════════════════════════'
\echo 'TEST COMPLETE'
\echo '════════════════════════════════════════════════════════════════════'
\echo ''
