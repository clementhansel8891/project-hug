-- Diagnose Shift Close Location Mismatch Error
-- Run: docker exec -i bfs-db psql -U zenvix -d zenvix_prod -f /app/scripts/diagnose-shift-close-error.sql

\echo '=== CURRENT OPEN SHIFTS FOR NANA ==='
SELECT 
  rs.id as shift_id,
  rs.store_id,
  s.name as store_name,
  s.location_id as store_physical_location,
  l.name as physical_location_name,
  rs.status,
  rs.start_time,
  e.first_name,
  u.email
FROM retail_shifts rs
JOIN stores s ON rs.store_id = s.id
LEFT JOIN locations l ON s.location_id = l.id
JOIN employees e ON rs.employee_id = e.id
JOIN users u ON e.user_id = u.id
WHERE rs.tenant_id = 'tnt-3rlhko'
  AND u.email = 'nana@bambusilver.com'
  AND rs.status = 'open'
ORDER BY rs.start_time DESC;

\echo ''
\echo '=== NANA USER SESSION LOCATION ==='
SELECT 
  u.id as user_id,
  u.email,
  e.id as employee_id,
  hw.location_id as scheduled_location,
  l.name as location_name,
  hw.start_time,
  hw.end_time
FROM users u
JOIN employees e ON u.id = e.user_id
LEFT JOIN hr_work_shifts hw ON e.id = hw.employee_id
LEFT JOIN locations l ON hw.location_id = l.id
WHERE u.email = 'nana@bambusilver.com'
  AND u.tenant_id = 'tnt-3rlhko'
  AND hw.start_time::date = CURRENT_DATE
ORDER BY hw.start_time DESC
LIMIT 1;

\echo ''
\echo '=== ALL STORES AND THEIR PHYSICAL LOCATIONS ==='
SELECT 
  s.id as store_id,
  s.name as store_name,
  s.code,
  s.location_id as physical_location_id,
  l.name as physical_location_name,
  l.code as location_code
FROM stores s
LEFT JOIN locations l ON s.location_id = l.id
WHERE s.tenant_id = 'tnt-3rlhko'
  AND s.deleted_at IS NULL
ORDER BY s.name;

\echo ''
\echo '=== SEMINYAK STORE DETAILS ==='
SELECT 
  s.id as store_id,
  s.name as store_name,
  s.code as store_code,
  s.location_id as physical_location_id,
  l.name as physical_location_name,
  l.code as physical_location_code,
  l.type as location_type
FROM stores s
LEFT JOIN locations l ON s.location_id = l.id
WHERE s.code = 'BS-03'
  AND s.tenant_id = 'tnt-3rlhko';
