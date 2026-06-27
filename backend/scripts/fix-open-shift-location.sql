-- Close the shift at wrong location

\echo 'Closing open shift at Anchor...'

UPDATE retail_shifts
SET 
  status = 'closed',
  end_time = CURRENT_TIMESTAMP,
  updated_at = CURRENT_TIMESTAMP
WHERE id = '89847bc5-08c2-446b-a5a0-411251317ae5'
RETURNING id, store_id, employee_id, start_time, end_time;
