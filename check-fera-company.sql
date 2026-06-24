-- Check Fera's employee and company data
SELECT 
  e.id as employee_id,
  e.first_name,
  e.last_name,
  e.email,
  e.company_id as employee_company_id,
  e.tenant_id as employee_tenant_id,
  u.tenant_id as user_tenant_id,
  uc.company_id as user_company_id,
  c.name as company_name
FROM employees e 
JOIN users u ON u.id = e.user_id 
LEFT JOIN user_companies uc ON uc.user_id = u.id
LEFT JOIN companies c ON c.id = uc.company_id
WHERE e.email = 'fera@bambusilver.com';

\echo ''
\echo 'Checking stores with correct company_id...'
SELECT id, name, code, company_id, tenant_id
FROM stores 
WHERE tenant_id = 'tnt-3rlhko' 
  AND name = 'Seminyak'
LIMIT 1;
