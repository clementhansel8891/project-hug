-- Discover retail-related tables
\echo 'Available retail-related tables:'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name LIKE '%retail%'
    OR table_name LIKE '%sales%'
    OR table_name LIKE '%transaction%'
    OR table_name LIKE '%stock%'
    OR table_name LIKE '%journal%'
    OR table_name LIKE '%ledger%'
    OR table_name LIKE '%payment%'
  )
ORDER BY table_name;
