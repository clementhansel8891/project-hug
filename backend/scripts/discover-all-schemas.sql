-- Discover actual schemas for all critical tables

\echo '═══════════════════════════════════════════════════════════════════════'
\echo 'SCHEMA DISCOVERY - All Critical Tables'
\echo '═══════════════════════════════════════════════════════════════════════'

\echo ''
\echo '1. SALES_ORDERS TABLE:'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sales_orders'
ORDER BY ordinal_position;

\echo ''
\echo '2. SALES_ORDER_ITEMS TABLE:'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sales_order_items'
ORDER BY ordinal_position;

\echo ''
\echo '3. STOCK_MOVEMENTS TABLE:'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'stock_movements'
ORDER BY ordinal_position;

\echo ''
\echo '4. STOCK_LEVELS TABLE:'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'stock_levels'
ORDER BY ordinal_position;

\echo ''
\echo '5. FINANCE_JOURNAL_ENTRIES TABLE:'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'finance_journal_entries'
ORDER BY ordinal_position;

\echo ''
\echo '6. FINANCE_JOURNAL_LINES TABLE:'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'finance_journal_lines'
ORDER BY ordinal_position;

\echo ''
\echo '7. PAYMENT_TRANSACTIONS TABLE:'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payment_transactions'
ORDER BY ordinal_position;

\echo ''
\echo '8. MONEY_SOURCES TABLE:'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'money_sources'
ORDER BY ordinal_position;

\echo ''
\echo '9. HR_ATTENDANCE_RECORDS TABLE:'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'hr_attendance_records'
ORDER BY ordinal_position;

\echo ''
\echo '10. RETAIL_SHIFTS TABLE:'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'retail_shifts'
ORDER BY ordinal_position;

\echo ''
\echo '═══════════════════════════════════════════════════════════════════════'
\echo 'SCHEMA DISCOVERY COMPLETE'
\echo '═══════════════════════════════════════════════════════════════════════'
