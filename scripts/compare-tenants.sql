-- Compare tnt-3rlhko vs bambu-tenant data
\echo '=== TENANT: tnt-3rlhko ==='
\echo '--- Stores ---'
SELECT id, name, type, status, code FROM stores WHERE tenant_id = 'tnt-3rlhko' ORDER BY name;

\echo '--- Locations ---'
SELECT id, name, code FROM locations WHERE tenant_id = 'tnt-3rlhko' ORDER BY name;

\echo '--- Channels ---'
SELECT id, name, type, status, integration_category FROM retail_channels WHERE tenant_id = 'tnt-3rlhko' ORDER BY name;

\echo '--- Connectors ---'
SELECT id, name, platform, domain, status FROM ecommerce_connectors WHERE tenant_id = 'tnt-3rlhko' AND deleted_at IS NULL;

\echo '--- Users ---'
SELECT id, email, first_name, last_name FROM users WHERE tenant_id = 'tnt-3rlhko' ORDER BY first_name;

\echo '--- Companies ---'
SELECT id, name, tenant_id FROM companies WHERE tenant_id = 'tnt-3rlhko';

\echo '--- Products count ---'
SELECT COUNT(*) as product_count FROM item_masters WHERE tenant_id = 'tnt-3rlhko';

\echo ''
\echo '=== TENANT: bambu-tenant ==='
\echo '--- Stores ---'
SELECT id, name, type, status, code FROM stores WHERE tenant_id = 'bambu-tenant' ORDER BY name;

\echo '--- Locations ---'
SELECT id, name, code FROM locations WHERE tenant_id = 'bambu-tenant' ORDER BY name;

\echo '--- Channels ---'
SELECT id, name, type, status, integration_category FROM retail_channels WHERE tenant_id = 'bambu-tenant' ORDER BY name;

\echo '--- Connectors ---'
SELECT id, name, platform, domain, status FROM ecommerce_connectors WHERE tenant_id = 'bambu-tenant' AND deleted_at IS NULL;

\echo '--- Users ---'
SELECT id, email, first_name, last_name FROM users WHERE tenant_id = 'bambu-tenant' ORDER BY first_name;

\echo '--- Companies ---'
SELECT id, name, tenant_id FROM companies WHERE tenant_id = 'bambu-tenant';

\echo '--- Products count ---'
SELECT COUNT(*) as product_count FROM item_masters WHERE tenant_id = 'bambu-tenant';

\echo ''
\echo '=== USER COMPANIES (role mapping) ==='
SELECT uc.user_id, u.email, uc.tenant_id, uc.role, uc.company_id 
FROM user_companies uc 
JOIN users u ON uc.user_id = u.id
WHERE uc.tenant_id IN ('tnt-3rlhko', 'bambu-tenant')
ORDER BY uc.tenant_id, u.email;
