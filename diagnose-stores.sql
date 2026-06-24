-- Query 1: All stores for Bambu Silver
\echo '=== ALL STORES FOR TENANT tnt-3rlhko ==='
SELECT id, name, code, location_id, created_at::date
FROM stores 
WHERE tenant_id = 'tnt-3rlhko' 
ORDER BY name;

\echo ''
\echo '=== PROBLEMATIC STORE (from shift context) ==='
-- Query 2: Check the specific store from console logs
SELECT id, name, code, location_id, created_at::date
FROM stores 
WHERE id = '1bcb0547-d886-43c3-acf5-ac4866032cdb';

\echo ''
\echo '=== SEMINYAK STORE (BS-03) ==='
-- Query 3: Find correct Seminyak store
SELECT id, name, code, location_id, created_at::date
FROM stores 
WHERE tenant_id = 'tnt-3rlhko' 
  AND (code = 'BS-03' OR name ILIKE '%seminyak%' OR name ILIKE '%toko%');

\echo ''
\echo '=== CURRENT WORK SHIFTS WITH STORE INFO ==='
-- Query 4: Check Fera and Nana's shifts
SELECT 
  s.id as shift_id,
  e.first_name || ' ' || e.last_name as employee_name,
  e.email,
  s.location_id,
  TO_CHAR(s.start_time, 'YYYY-MM-DD HH24:MI') as shift_start,
  TO_CHAR(s.end_time, 'YYYY-MM-DD HH24:MI') as shift_end,
  st.id as store_id,
  st.name as store_name,
  st.code as store_code
FROM hr_work_shifts s
JOIN employees e ON e.id = s.employee_id
JOIN locations l ON l.id = s.location_id
LEFT JOIN stores st ON st.location_id = l.id
WHERE s.tenant_id = 'tnt-3rlhko'
  AND e.email IN ('fera@bambusilver.com', 'nana@bambusilver.com')
  AND DATE(s.start_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta') = CURRENT_DATE
ORDER BY s.start_time;

\echo ''
\echo '=== EMPLOYEE INFO ==='
-- Query 5: Check employee records
SELECT id, first_name, last_name, email
FROM employees
WHERE tenant_id = 'tnt-3rlhko'
  AND email IN ('fera@bambusilver.com', 'nana@bambusilver.com');
