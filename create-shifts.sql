-- Create work shifts for Fera and Nana at Seminyak today

-- First, create a schedule template if it doesn't exist
INSERT INTO hr_work_schedules (
  id,
  tenant_id,
  company_id,
  department_id,
  location_id,
  created_by,
  name,
  status,
  start_date,
  end_date,
  created_at,
  updated_at
)
SELECT 
  'manual-shift-schedule',
  'tnt-3rlhko',
  s.company_id,
  d.id,
  s.location_id,
  'system',
  'Manual Shift Schedule - Seminyak',
  'ACTIVE',
  CURRENT_DATE AT TIME ZONE 'UTC',
  (CURRENT_DATE AT TIME ZONE 'UTC') + INTERVAL '7 days',
  NOW(),
  NOW()
FROM stores s
CROSS JOIN departments d
WHERE s.code = 'BS-03'
  AND s.tenant_id = 'tnt-3rlhko'
  AND d.tenant_id = 'tnt-3rlhko'
  AND d.name = 'Sales'
  AND NOT EXISTS (
    SELECT 1 FROM hr_work_schedules WHERE id = 'manual-shift-schedule'
  )
LIMIT 1;

-- Create Fera's shift (8am-3pm)
INSERT INTO hr_work_shifts (
  id,
  tenant_id,
  company_id,
  location_id,
  schedule_id,
  employee_id,
  start_time,
  end_time,
  notes,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  'tnt-3rlhko',
  s.company_id,
  s.location_id,
  'manual-shift-schedule',
  e.id,
  (CURRENT_DATE AT TIME ZONE 'UTC') + INTERVAL '8 hours',
  (CURRENT_DATE AT TIME ZONE 'UTC') + INTERVAL '15 hours',
  'Morning shift - Seminyak POS',
  NOW(),
  NOW()
FROM employees e
CROSS JOIN stores s
WHERE e.email = 'fera@bambusilver.com' 
  AND e.tenant_id = 'tnt-3rlhko'
  AND s.code = 'BS-03'
  AND s.tenant_id = 'tnt-3rlhko'
  AND NOT EXISTS (
    SELECT 1 FROM hr_work_shifts 
    WHERE employee_id = e.id 
      AND start_time >= CURRENT_DATE AT TIME ZONE 'UTC'
      AND start_time < (CURRENT_DATE AT TIME ZONE 'UTC') + INTERVAL '1 day'
  );

-- Create Nana's shift (3pm-10pm)
INSERT INTO hr_work_shifts (
  id,
  tenant_id,
  company_id,
  location_id,
  schedule_id,
  employee_id,
  start_time,
  end_time,
  notes,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  'tnt-3rlhko',
  s.company_id,
  s.location_id,
  'manual-shift-schedule',
  e.id,
  (CURRENT_DATE AT TIME ZONE 'UTC') + INTERVAL '15 hours',
  (CURRENT_DATE AT TIME ZONE 'UTC') + INTERVAL '22 hours',
  'Evening shift - Seminyak POS',
  NOW(),
  NOW()
FROM employees e
CROSS JOIN stores s
WHERE e.email = 'nana@bambusilver.com' 
  AND e.tenant_id = 'tnt-3rlhko'
  AND s.code = 'BS-03'
  AND s.tenant_id = 'tnt-3rlhko'
  AND NOT EXISTS (
    SELECT 1 FROM hr_work_shifts 
    WHERE employee_id = e.id 
      AND start_time >= CURRENT_DATE AT TIME ZONE 'UTC'
      AND start_time < (CURRENT_DATE AT TIME ZONE 'UTC') + INTERVAL '1 day'
  );

-- Verify the shifts were created
SELECT 
  e.email,
  s.name as store,
  ws.start_time,
  ws.end_time,
  ws.notes
FROM hr_work_shifts ws
JOIN employees e ON ws.employee_id = e.id
JOIN stores s ON ws.location_id = s.location_id
WHERE ws.tenant_id = 'tnt-3rlhko'
  AND e.email IN ('fera@bambusilver.com', 'nana@bambusilver.com')
  AND ws.start_time >= CURRENT_DATE AT TIME ZONE 'UTC'
ORDER BY ws.start_time;
