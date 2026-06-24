-- Check money sources at Seminyak

\echo 'Checking Money Sources for Seminyak Store...'
\echo ''

-- Get Seminyak store ID
\echo '1. Seminyak Store:'
SELECT id, name, code, location_id
FROM stores
WHERE code = 'BS-03' AND tenant_id = 'tnt-3rlhko' AND deleted_at IS NULL;

\echo ''
\echo '2. Money Sources at Seminyak:'
SELECT 
  id,
  name,
  type,
  balance,
  store_id,
  currency
FROM money_sources
WHERE tenant_id = 'tnt-3rlhko'
  AND store_id = 'f6ec35ea-b90c-46cf-ad39-4429f7d48c6e';

\echo ''
\echo '3. All Money Sources for Bambu Silver:'
SELECT 
  id,
  name,
  type,
  balance,
  store_id,
  currency
FROM money_sources
WHERE tenant_id = 'tnt-3rlhko'
ORDER BY type, name
LIMIT 30;
