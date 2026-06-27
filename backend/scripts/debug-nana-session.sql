-- Debug Nana's Session and Location Issue
-- Find out why session has wrong location_id

\echo '=== 1. NANA USER ACCOUNT ==='
SELECT 
  id,
  email,
  tenant_id,
  created_at
FROM users 
WHERE email = 'nana@bambusilver.com';

\echo ''
\echo '=== 2. NANA EMPLOYEE RECORD ==='
SELECT 
  e.id as employee_id,
  e.user_id,
  e.first_name,
  e.last_name,
  e.tenant_id
FROM employees e
JOIN users u ON e.user_id = u.id
WHERE u.email = 'nana@bambusilver.com';

\echo ''
\echo '=== 3. NANA WORK SHIFT TODAY ==='
SELECT 
  ws.id as shift_id,
  ws.employee_id,
  ws.location_id,
  l.name as location_name,
  l.code as location_code,
  ws.start_time AT TIME ZONE 'UTC' as start_utc,
  ws.end_time AT TIME ZONE 'UTC' as end_utc
FROM hr_work_shifts ws
JOIN employees e ON ws.employee_id = e.id
JOIN users u ON e.user_id = u.id
JOIN locations l ON ws.location_id = l.id
WHERE u.email = 'nana@bambusilver.com'
  AND ws.start_time::date = CURRENT_DATE;

\echo ''
\echo '=== 4. STORES AT SEMINYAK LOCATION ==='
SELECT 
  s.id as store_id,
  s.name as store_name,
  s.code as store_code,
  s.location_id,
  l.name as location_name
FROM stores s
JOIN locations l ON s.location_id = l.id
WHERE s.tenant_id = 'tnt-3rlhko'
  AND l.name = 'Seminyak'
  AND s.deleted_at IS NULL;

\echo ''
\echo '=== 5. NANA OPEN SHIFTS ==='
SELECT 
  rs.id as shift_id,
  rs.employee_id,
  rs.store_id,
  s.name as store_name,
  s.code as store_code,
  s.location_id as store_location_id,
  l.name as location_name,
  rs.start_time AT TIME ZONE 'UTC' as start_utc,
  rs.status
FROM retail_shifts rs
JOIN employees e ON rs.employee_id = e.id
JOIN users u ON e.user_id = u.id
JOIN stores s ON rs.store_id = s.id
JOIN locations l ON s.location_id = l.id
WHERE u.email = 'nana@bambusilver.com'
  AND rs.status = 'open';

\echo ''
\echo '=== 6. ALL LOCATIONS IN TENANT ==='
SELECT 
  id,
  name,
  code,
  type,
  deleted_at IS NULL as active
FROM locations
WHERE tenant_id = 'tnt-3rlhko'
ORDER BY name;

\echo ''
\echo '=== 7. SEMINYAK LOCATION DETAILS ==='
SELECT 
  id,
  name,
  code,
  type,
  address
FROM locations
WHERE tenant_id = 'tnt-3rlhko'
  AND (name ILIKE '%seminyak%' OR code = 'BS-03');

\echo ''
\echo '=== 8. ANCHOR LOCATION DETAILS (WRONG ONE) ==='
SELECT 
  id,
  name,
  code,
  type,
  address
FROM locations
WHERE id = 'a370e7ca-c1f7-4180-8824-846eaa6a3c8e';
