-- Check current retail shifts
SELECT id, employee_id, store_id, status, start_time, end_time 
FROM retail_shifts 
WHERE tenant_id = 'tnt-3rlhko' 
ORDER BY start_time DESC 
LIMIT 10;
