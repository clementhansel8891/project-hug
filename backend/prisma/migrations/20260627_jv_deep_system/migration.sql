-- Joint Venture Deep System Migration
-- Adds: Permissions, Expenses, Expense Allocations, Settlements, Settlement Lines, Activity Log

-- ═══════════════════════════════════════════════════════════════════════════
-- JV PERMISSIONS: Granular module-level access for each participant
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "finance_jv_permissions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "participant_id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "access_level" TEXT NOT NULL DEFAULT 'read',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_jv_permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "finance_jv_permissions_participant_id_module_key" 
    ON "finance_jv_permissions"("participant_id", "module");

-- ═══════════════════════════════════════════════════════════════════════════
-- JV EXPENSES: Costs logged by either party against the JV
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "finance_jv_expenses" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL,
    "jv_profile_id" TEXT NOT NULL,
    "submitted_by" TEXT NOT NULL,
    "submitter_tenant_id" TEXT NOT NULL,
    "category_id" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "receipt_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "expense_date" TIMESTAMP(3) NOT NULL,
    "period_id" TEXT,
    "split_method" TEXT NOT NULL DEFAULT 'by_share',
    "custom_split" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_jv_expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_jv_expenses_tenant_profile" 
    ON "finance_jv_expenses"("tenant_id", "jv_profile_id");
CREATE INDEX IF NOT EXISTS "idx_jv_expenses_status" 
    ON "finance_jv_expenses"("status");
CREATE INDEX IF NOT EXISTS "idx_jv_expenses_date" 
    ON "finance_jv_expenses"("expense_date");

-- ═══════════════════════════════════════════════════════════════════════════
-- JV EXPENSE ALLOCATIONS: How each expense is distributed
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "finance_jv_expense_allocations" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "expense_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "burden_pct" DECIMAL(20,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_jv_expense_allocations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "finance_jv_expense_allocations_expense_id_fkey" FOREIGN KEY ("expense_id") 
        REFERENCES "finance_jv_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_jv_expense_alloc_expense" 
    ON "finance_jv_expense_allocations"("expense_id");

-- ═══════════════════════════════════════════════════════════════════════════
-- JV SETTLEMENTS: Periodic net settlement between parties
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "finance_jv_settlements" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL,
    "jv_profile_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "generated_by" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_by" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "payment_ref" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_jv_settlements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_jv_settlements_tenant_profile" 
    ON "finance_jv_settlements"("tenant_id", "jv_profile_id");
CREATE INDEX IF NOT EXISTS "idx_jv_settlements_status" 
    ON "finance_jv_settlements"("status");

-- ═══════════════════════════════════════════════════════════════════════════
-- JV SETTLEMENT LINES: Per-participant breakdown in a settlement
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "finance_jv_settlement_lines" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "settlement_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "participant_tenant_id" TEXT NOT NULL,
    "revenue_allocated" DECIMAL(20,4) NOT NULL,
    "cost_burden" DECIMAL(20,4) NOT NULL,
    "expenses_borne" DECIMAL(20,4) NOT NULL,
    "net_payable" DECIMAL(20,4) NOT NULL,
    "direction" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_jv_settlement_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "finance_jv_settlement_lines_settlement_id_fkey" FOREIGN KEY ("settlement_id") 
        REFERENCES "finance_jv_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_jv_settlement_lines_settlement" 
    ON "finance_jv_settlement_lines"("settlement_id");

-- ═══════════════════════════════════════════════════════════════════════════
-- JV ACTIVITY LOG: Audit trail for all JV operations
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "finance_jv_activity_log" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL,
    "jv_profile_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_tenant_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_jv_activity_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_jv_activity_tenant_profile" 
    ON "finance_jv_activity_log"("tenant_id", "jv_profile_id");
CREATE INDEX IF NOT EXISTS "idx_jv_activity_created" 
    ON "finance_jv_activity_log"("created_at" DESC);
