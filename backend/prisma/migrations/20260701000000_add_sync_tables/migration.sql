-- CreateTable
CREATE TABLE "sync_operation_log" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "session_id" TEXT NOT NULL,
    "operation_type" VARCHAR(50) NOT NULL,
    "payload" JSONB NOT NULL,
    "vector_clock" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'received',
    "error_reason" TEXT,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_operation_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_inventory_ledger" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "movement_type" VARCHAR(30) NOT NULL,
    "quantity_change" DECIMAL(12,4) NOT NULL,
    "running_balance" DECIMAL(12,4) NOT NULL,
    "operation_envelope_id" TEXT,
    "vector_clock" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_inventory_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_conflict_log" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "record_type" VARCHAR(50) NOT NULL,
    "conflict_type" VARCHAR(50) NOT NULL,
    "source_location_id" TEXT NOT NULL,
    "original_values" JSONB NOT NULL,
    "conflicting_values" JSONB NOT NULL,
    "resolution_strategy" VARCHAR(30) NOT NULL,
    "final_values" JSONB NOT NULL,
    "resolved_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requires_manual_review" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_at" TIMESTAMPTZ,
    "reviewed_by" TEXT,

    CONSTRAINT "sync_conflict_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "operations_received" INTEGER NOT NULL DEFAULT 0,
    "operations_applied" INTEGER NOT NULL DEFAULT 0,
    "operations_failed" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'in_progress',

    CONSTRAINT "sync_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_ecommerce_reserve" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "reserve_percentage" DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_ecommerce_reserve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_reconciliation_flags" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "affected_locations" TEXT[] NOT NULL,
    "expected_total" DECIMAL(12,4) NOT NULL,
    "actual_total" DECIMAL(12,4) NOT NULL,
    "discrepancy" DECIMAL(12,4) NOT NULL,
    "flagged_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ,
    "resolved_by" TEXT,

    CONSTRAINT "sync_reconciliation_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: sync_operation_log
CREATE UNIQUE INDEX "uq_idempotency" ON "sync_operation_log"("tenant_id", "idempotency_key");

CREATE INDEX "idx_sync_op_log_tenant_location" ON "sync_operation_log"("tenant_id", "location_id");

CREATE INDEX "idx_sync_op_log_received" ON "sync_operation_log"("received_at");

CREATE INDEX "idx_sync_op_log_status" ON "sync_operation_log"("tenant_id", "status");

-- CreateIndex: sync_inventory_ledger
CREATE UNIQUE INDEX "uq_ledger_entry" ON "sync_inventory_ledger"("tenant_id", "product_id", "location_id", "operation_envelope_id");

CREATE INDEX "idx_inv_ledger_product" ON "sync_inventory_ledger"("tenant_id", "product_id", "location_id");

-- CreateIndex: sync_conflict_log
CREATE INDEX "idx_conflict_log_tenant" ON "sync_conflict_log"("tenant_id", "resolved_at");

CREATE INDEX "idx_conflict_log_review" ON "sync_conflict_log"("requires_manual_review");

-- CreateIndex: sync_sessions
CREATE INDEX "idx_sync_sessions_location" ON "sync_sessions"("tenant_id", "location_id", "started_at" DESC);

-- CreateIndex: sync_ecommerce_reserve
CREATE UNIQUE INDEX "uq_ecom_reserve" ON "sync_ecommerce_reserve"("tenant_id", "product_id");

-- CreateIndex: sync_reconciliation_flags
CREATE INDEX "idx_recon_flags_open" ON "sync_reconciliation_flags"("tenant_id");

-- AddForeignKey
ALTER TABLE "sync_operation_log" ADD CONSTRAINT "sync_operation_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_inventory_ledger" ADD CONSTRAINT "sync_inventory_ledger_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_inventory_ledger" ADD CONSTRAINT "sync_inventory_ledger_operation_envelope_id_fkey" FOREIGN KEY ("operation_envelope_id") REFERENCES "sync_operation_log"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_conflict_log" ADD CONSTRAINT "sync_conflict_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_sessions" ADD CONSTRAINT "sync_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_ecommerce_reserve" ADD CONSTRAINT "sync_ecommerce_reserve_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_reconciliation_flags" ADD CONSTRAINT "sync_reconciliation_flags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddConstraint: reserve percentage range check (5-50%)
ALTER TABLE "sync_ecommerce_reserve" ADD CONSTRAINT "chk_reserve_range" CHECK ("reserve_percentage" >= 5 AND "reserve_percentage" <= 50);
