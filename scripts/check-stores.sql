SELECT id, name, type, status, code FROM stores WHERE tenant_id = 'tnt-3rlhko' AND status = 'active' ORDER BY name;
SELECT id, name, type, status, integration_category FROM retail_channels WHERE tenant_id = 'tnt-3rlhko' ORDER BY created_at DESC LIMIT 10;
