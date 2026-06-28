\echo '=== ITEM COUNTS ==='
SELECT tenant_id, COUNT(*) as items FROM item_masters WHERE tenant_id IN ('tnt-3rlhko', 'bambu-tenant') GROUP BY tenant_id;

\echo ''
\echo '=== STOCK LEVELS ==='
SELECT tenant_id, COUNT(*) as stock_records FROM stock_levels WHERE tenant_id IN ('tnt-3rlhko', 'bambu-tenant') GROUP BY tenant_id;

\echo ''
\echo '=== STOCK OPNAME CYCLES ==='
SELECT tenant_id, COUNT(*) as cycles FROM stock_opname_cycles WHERE tenant_id IN ('tnt-3rlhko', 'bambu-tenant') GROUP BY tenant_id;

\echo ''
\echo '=== STOCK OPNAME ITEMS ==='
SELECT soc.tenant_id, COUNT(soi.id) as opname_items 
FROM stock_opname_items soi 
JOIN stock_opname_cycles soc ON soi.cycle_id = soc.id 
WHERE soc.tenant_id IN ('tnt-3rlhko', 'bambu-tenant') 
GROUP BY soc.tenant_id;

\echo ''
\echo '=== RETAIL ORDERS ==='
SELECT tenant_id, COUNT(*) as orders FROM retail_orders WHERE tenant_id IN ('tnt-3rlhko', 'bambu-tenant') GROUP BY tenant_id;

\echo ''
\echo '=== STOCK MOVEMENTS ==='
SELECT tenant_id, COUNT(*) as movements FROM stock_movements WHERE tenant_id IN ('tnt-3rlhko', 'bambu-tenant') GROUP BY tenant_id;

\echo ''
\echo '=== SAMPLE ITEMS tnt-3rlhko (first 5) ==='
SELECT id, sku, name, status FROM item_masters WHERE tenant_id = 'tnt-3rlhko' LIMIT 5;

\echo ''
\echo '=== SAMPLE ITEMS bambu-tenant (first 5) ==='
SELECT id, sku, name, status FROM item_masters WHERE tenant_id = 'bambu-tenant' LIMIT 5;

\echo ''
\echo '=== What API returns for retail products (checking view/query) ==='
SELECT COUNT(*) as products_via_retail 
FROM item_masters 
WHERE tenant_id = 'tnt-3rlhko' 
  AND status = 'active';
