SELECT company_id, COUNT(*) as cats FROM product_categories WHERE tenant_id = 'tnt-3rlhko' GROUP BY company_id;
SELECT id, name, company_id FROM product_categories WHERE tenant_id = 'tnt-3rlhko' LIMIT 10;
