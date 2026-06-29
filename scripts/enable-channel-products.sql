UPDATE retail_channel_products SET visible = true WHERE tenant_id = 'tnt-3rlhko' AND channel_id = 'cf051a00-2fda-4c45-9606-68d949aaa171';
SELECT COUNT(*) as visible_products FROM retail_channel_products WHERE tenant_id = 'tnt-3rlhko' AND visible = true;
