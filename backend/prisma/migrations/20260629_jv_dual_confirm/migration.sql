-- JV Dual Confirmation: Split Agreement + Settlement Dual-Confirm
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add split_confirmed to participants (both must agree on the split)
ALTER TABLE "finance_jv_participants"
  ADD COLUMN IF NOT EXISTS "split_confirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "split_confirmed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "split_proposed_by" TEXT;

-- 2. Add dual confirmation fields to settlements
ALTER TABLE "finance_jv_settlements"
  ADD COLUMN IF NOT EXISTS "host_confirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "host_confirmed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "host_confirmed_by" TEXT,
  ADD COLUMN IF NOT EXISTS "partner_confirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "partner_confirmed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "partner_confirmed_by" TEXT;

-- 3. Add individual_expenses to settlement lines for clarity
ALTER TABLE "finance_jv_settlement_lines"
  ADD COLUMN IF NOT EXISTS "individual_expenses" DECIMAL(20,4) NOT NULL DEFAULT 0;
