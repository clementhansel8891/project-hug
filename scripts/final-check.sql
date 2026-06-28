SELECT '--- CUSTOMERS ---' as section;
SELECT id, name, email, phone, created_at FROM retail_customers WHERE tenant_id = 'tnt-3rlhko' ORDER BY created_at DESC LIMIT 5;

SELECT '--- ORDERS ---' as section;
SELECT id, status, grand_total, payment_method, created_at FROM retail_orders WHERE tenant_id = 'tnt-3rlhko' ORDER BY created_at DESC LIMIT 5;

SELECT '--- CARTS ---' as section;
SELECT rc.id, rc.customer_id, COUNT(rci.id) as items FROM retail_carts rc LEFT JOIN retail_cart_items rci ON rc.id = rci.cart_id WHERE rc.tenant_id = 'tnt-3rlhko' GROUP BY rc.id, rc.customer_id LIMIT 5;

SELECT '--- WISHLISTS ---' as section;
SELECT rw.id, rw.customer_id, COUNT(rwi.id) as items FROM retail_wishlists rw LEFT JOIN retail_wishlist_items rwi ON rw.id = rwi.wishlist_id WHERE rw.tenant_id = 'tnt-3rlhko' GROUP BY rw.id, rw.customer_id LIMIT 5;
