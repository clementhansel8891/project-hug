SELECT company_id, COUNT(*) as items FROM item_masters WHERE tenant_id = 'tnt-3rlhko' GROUP BY company_id;
