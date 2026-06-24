-- Check Seminyak store details
SELECT 
  id,
  name,
  code,
  location_id,
  company_id,
  status
FROM stores
WHERE location_id = 'a3a241a4-4841-45a3-90cd-f7135e6847b4'
  AND code = 'BS-03'
  AND deleted_at IS NULL;
