-- Debug location mismatch issue

\echo 'Checking location assignments...'
\echo ''

\echo '1. Location a370e7ca-c1f7-4180-8824-846eaa6a3c8e (user assigned to):'
SELECT id, name, code FROM locations WHERE id = 'a370e7ca-c1f7-4180-8824-846eaa6a3c8e';

\echo ''
\echo '2. Location 98d47bc5-08c2-44c0-a4c9-d11f2513170ae (shift trying to access):'
SELECT id, name, code FROM locations WHERE id = '98d47bc5-08c2-44c0-a4c9-d11f2513170ae';

\echo ''
\echo '3. Seminyak location:'
SELECT id, name, code FROM locations WHERE id = 'a3a241a4-4841-45a3-90cd-f7135e6847b4';

\echo ''
\echo '4. Stores at these locations:'
SELECT 
  s.id,
  s.name,
  s.code,
  s.location_id,
  l.name as location_name
FROM stores s
JOIN locations l ON s.location_id = l.id
WHERE s.location_id IN (
  'a370e7ca-c1f7-4180-8824-846eaa6a3c8e',
  '98d47bc5-08c2-44c0-a4c9-d11f2513170ae',
  'a3a241a4-4841-45a3-90cd-f7135e6847b4'
)
AND s.deleted_at IS NULL;

\echo ''
\echo '5. Open retail shifts:'
SELECT 
  rs.id,
  rs.store_id,
  s.name as store_name,
  s.location_id,
  l.name as location_name,
  rs.employee_id
FROM retail_shifts rs
JOIN stores s ON rs.store_id = s.id
JOIN locations l ON s.location_id = l.id
WHERE rs.status = 'open'
  AND rs.tenant_id = 'tnt-3rlhko';
