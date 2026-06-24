-- Check Nana's user and employee records
SELECT 
  u.id as user_id,
  u.email,
  u.first_name,
  u.last_name,
  u.tenant_id,
  e.id as employee_id,
  e.department
FROM users u
LEFT JOIN employees e ON e.user_id = u.id
WHERE u.email = 'nana@bambusilver.com';

-- Check Nana's work shifts for today
SELECT 
  ws.id as shift_id,
  ws.start_time,
  ws.end_time,
  ws.location_id,
  l.name as location_name,
  e.first_name
FROM hr_work_shifts ws
JOIN employees e ON ws.employee_id = e.id
JOIN users u ON e.user_id = u.id
JOIN locations l ON ws.location_id = l.id
WHERE u.email = 'nana@bambusilver.com'
  AND ws.start_time::date = '2026-06-24'
ORDER BY ws.start_time;
