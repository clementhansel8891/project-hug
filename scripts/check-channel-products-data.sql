SELECT visible, COUNT(*) FROM retail_channel_products GROUP BY visible;
SELECT channel_id, tenant_id, COUNT(*) as prods FROM retail_channel_products GROUP BY channel_id, tenant_id;
