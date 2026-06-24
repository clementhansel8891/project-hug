-- Clear Locked Shifts Script
-- Purpose: Force-close any open shifts that are preventing users from starting fresh
-- Created: 2025-01-XX

-- Step 1: View all open/active shifts for the tenant
SELECT 
    id, 
    employee_id, 
    store_id, 
    start_time, 
    end_time,
    status,
    created_at
FROM retail_shifts 
WHERE tenant_id = 'tnt-3rlhko' 
  AND status IN ('open', 'active')
ORDER BY created_at DESC;

-- Step 2: Force close any open shifts by setting status to 'closed' and end_time to NOW()
UPDATE retail_shifts
SET 
    status = 'closed',
    end_time = NOW(),
    updated_at = NOW()
WHERE tenant_id = 'tnt-3rlhko'
  AND status IN ('open', 'active')
  AND (end_time IS NULL OR end_time > NOW());

-- Step 3: Verify the update
SELECT 
    id, 
    employee_id, 
    store_id, 
    start_time, 
    end_time,
    status,
    updated_at
FROM retail_shifts 
WHERE tenant_id = 'tnt-3rlhko' 
  AND status = 'closed'
  AND updated_at > NOW() - INTERVAL '1 minute'
ORDER BY updated_at DESC;
