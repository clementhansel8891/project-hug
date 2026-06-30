-- Promote the storefront ZENVIX workflow stage to a first-class column so it is
-- syncable via /sync/delta/retail-orders (which keys off updated_at), and persist
-- the storefront correlation ids on the order.
ALTER TABLE "retail_orders" ADD COLUMN "workflow_stage" TEXT DEFAULT 'SUBMITTED';
ALTER TABLE "retail_orders" ADD COLUMN "channel_record_id" TEXT;
ALTER TABLE "retail_orders" ADD COLUMN "external_reference" TEXT;

-- Delta-sync access paths (tenant + changed-since).
CREATE INDEX "retail_orders_tenant_id_updated_at_idx" ON "retail_orders"("tenant_id", "updated_at");
CREATE INDEX "retail_customers_tenant_id_updated_at_idx" ON "retail_customers"("tenant_id", "updated_at");

-- Backfill existing orders so the mirror reflects a sensible stage from day one
-- (map the internal POS status onto the ZENVIX workflow stage).
UPDATE "retail_orders" SET "workflow_stage" =
  CASE lower("status")
    WHEN 'paid' THEN 'PAYMENT_CONFIRMED'
    WHEN 'completed' THEN 'COMPLETED'
    WHEN 'fulfilled' THEN 'COMPLETED'
    WHEN 'shipped' THEN 'SHIPPED'
    WHEN 'prepared' THEN 'PREPARED'
    ELSE 'SUBMITTED'
  END;
