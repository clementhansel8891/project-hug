-- Close all open retail shifts to clean state
-- This allows users to open new shifts at the correct location

UPDATE retail_shifts
SET 
  status = 'closed',
  end_time = CURRENT_TIMESTAMP,
  updated_at = CURRENT_TIMESTAMP
WHERE status = 'open'
RETURNING id, employee_id, store_id, start_time;
