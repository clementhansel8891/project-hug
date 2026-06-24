-- Fix: Update all stores to have the correct Bambu Silver company_id
UPDATE stores
SET company_id = 'b74e21b9-4e99-42fd-857b-36bf4dee7ed5',
    updated_at = NOW()
WHERE tenant_id = 'tnt-3rlhko'
  AND company_id IS NULL;

-- Verify the fix
SELECT id, name, code, company_id, tenant_id
FROM stores
WHERE tenant_id = 'tnt-3rlhko'
ORDER BY name
LIMIT 5;
