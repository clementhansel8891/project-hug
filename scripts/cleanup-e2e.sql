-- Deep cleanup of inactive stores from tnt-3rlhko
BEGIN;

-- Get IDs of inactive stores
-- dec9e45b (Anchor inactive), de5f764b (Double Six inactive), c2221884 (SS inactive)

-- 1. Delete cash movements linked to shifts in inactive stores
DELETE FROM retail_cash_movements WHERE shift_id IN (
  SELECT id FROM retail_shifts WHERE store_id IN (
    SELECT id FROM stores WHERE tenant_id = 'tnt-3rlhko' AND status = 'inactive'
  )
);

-- 2. Delete order items linked to orders in inactive stores
DELETE FROM retail_order_items WHERE order_id IN (
  SELECT id FROM retail_orders WHERE store_id IN (
    SELECT id FROM stores WHERE tenant_id = 'tnt-3rlhko' AND status = 'inactive'
  )
);

-- 3. Delete orders in inactive stores
DELETE FROM retail_orders WHERE store_id IN (
  SELECT id FROM stores WHERE tenant_id = 'tnt-3rlhko' AND status = 'inactive'
);

-- 4. Delete shifts in inactive stores
DELETE FROM retail_shifts WHERE store_id IN (
  SELECT id FROM stores WHERE tenant_id = 'tnt-3rlhko' AND status = 'inactive'
);

-- 5. Delete inactive stores
DELETE FROM stores WHERE tenant_id = 'tnt-3rlhko' AND status = 'inactive';

COMMIT;

-- Verify final stores
SELECT id, name, type, status, code FROM stores WHERE tenant_id = 'tnt-3rlhko' ORDER BY name;
