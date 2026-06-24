# Database Schema - Actual Column Names Reference

## Purpose
This document maps the actual database column names to ensure API and query consistency.

---

## Key Tables and Correct Column Names

### 1. SALES_ORDERS
**Correct Columns**:
- `id` - TEXT (primary key)
- `tenant_id` - TEXT
- `customer_name` - TEXT (NOT `order_number`)
- `amount` - NUMERIC (NOT `total_amount`)
- `status` - TEXT
- `quote_id` - TEXT (nullable)
- `opportunity_id` - TEXT
- `currency` - TEXT
- `inventory_check` - TEXT
- `finance_invoice_id` - TEXT
- `created_by`, `created_at`, `updated_at`
- `company_id`, `ecommerce_id`

**Missing Columns** (compared to expected):
- ❌ No `order_number` column (use `id` or generate one)
- ❌ No `total_amount` (use `amount`)

---

### 2. SALES_ORDER_ITEMS
**Correct Columns**:
- `id`, `tenant_id`, `order_id`
- `product_id` - TEXT
- `quantity` - NUMERIC
- `unit_price` - NUMERIC
- `total_price` - NUMERIC (NOT `subtotal`)

---

### 3. STOCK_MOVEMENTS
**Correct Columns**:
- `id`, `tenant_id`, `product_id`
- `from_location_id`, `to_location_id` - TEXT
- `quantity` - NUMERIC
- `type` - TEXT (NOT `movement_type` or `transaction_type`)
- `reference_id`, `reference_type` - TEXT
- `performed_by` - TEXT
- `created_at`, `updated_at` - TIMESTAMP
- `location_id` - TEXT (primary location)
- `department_id`, `company_id`

**Missing Columns** (compared to expected):
- ❌ No `movement_date` (use `created_at`)
- ❌ No `transaction_type` (use `type`)

---

### 4. STOCK_LEVELS
**Correct Columns**:
- `id`, `tenant_id`, `location_id`, `product_id`
- `on_hand` - NUMERIC (NOT `quantity_on_hand`)
- `reserved` - NUMERIC
- `available` - NUMERIC
- `in_transit` - NUMERIC
- `damaged`, `in_repair` - NUMERIC
- `min_buffer`, `max_capacity` - NUMERIC
- `last_stock_take_at` - TIMESTAMP
- `created_at`, `updated_at`
- `department_id`, `company_id`

**Missing Columns** (compared to expected):
- ❌ No `quantity_on_hand` (use `on_hand`)
- ❌ No `quantity_available` (use `available`)

---

### 5. FINANCE_JOURNAL_ENTRIES
**Correct Columns**:
- `id`, `tenant_id`, `fiscal_period_id`
- `ref` - TEXT (reference number, NOT `entry_number`)
- `description` - TEXT
- `posting_date` - TIMESTAMP
- `effective_date` - TIMESTAMP
- `status` - TEXT
- `journal_type` - TEXT (NOT `entry_type`)
- `source_event_id` - TEXT (link to source module)
- `memo` - TEXT
- `ledger_sequence` - BIGINT
- `previous_hash`, `entry_hash` - TEXT (blockchain)
- `created_at`, `updated_at`
- `company_id`

**Missing Columns** (compared to expected):
- ❌ No `entry_type` (use `journal_type`)
- ❌ No `total_debit`, `total_credit` (calculate from lines)
- ❌ No `source_module` (use `source_event_id` or `memo`)
- ❌ No `reference_id`, `reference_type` (use `source_event_id`)

---

### 6. FINANCE_JOURNAL_LINES
**Correct Columns**:
- `id`, `tenant_id`, `journal_entry_id`
- `account_id`, `account_code` - TEXT
- `description` - TEXT
- `side` - TEXT ('DEBIT' or 'CREDIT')
- `amount` - NUMERIC (absolute value)
- `debit` - NUMERIC (amount if debit, 0 if credit)
- `credit` - NUMERIC (amount if credit, 0 if debit)
- `branch_id`, `location_id`, `department_id`
- `cost_center_id`, `project_id`
- `created_at`, `updated_at`
- `company_id`

**Missing Columns** (compared to expected):
- ❌ No `debit_amount`, `credit_amount` (use `debit`, `credit`)

---

### 7. PAYMENT_TRANSACTIONS
**Correct Columns**:
- `id`, `tenant_id`
- `external_reference`, `external_ref` - TEXT
- `type` - TEXT
- `amount` - NUMERIC
- `net_amount` - NUMERIC
- `currency` - TEXT
- `destination`, `source` - TEXT
- `channel` - TEXT
- `method` - TEXT (payment method)
- `provider_id` - TEXT
- `status` - TEXT
- `payment_status` - TEXT
- `idempotency_key` - TEXT
- `ledger_sync_at`, `ledger_sync_triggered_at` - TIMESTAMP
- `created_by`, `approved_by`, `approved_at`
- `created_at`, `updated_at`
- `settlement_id`, `evidence_pack_id`
- `gateway_fee`, `platform_fee` - NUMERIC
- `department_id`, `company_id`
- `extra_info` - JSONB
- `purpose`, `workflow_request_id`

**Note**: This is the CORRECT table (not `sales_payments`)

---

### 8. MONEY_SOURCES
**Correct Columns**:
- `id`, `tenant_id`
- `name` - TEXT
- `type` - TEXT ('CASH_REGISTER', 'PETTY_CASH', etc.)
- `currency` - TEXT
- `balance` - NUMERIC
- `pending_settlement` - NUMERIC
- `provider` - TEXT
- `last_updated`, `updated_at` - TIMESTAMP
- `company_id`, `department_id`, `ecommerce_id`
- `store_id` - TEXT ✅ (links to stores table)
- `min_limit`, `max_limit` - NUMERIC

**Status**: ✅ Has `store_id` column for linking to stores

---

### 9. HR_ATTENDANCE_RECORDS
**Correct Columns**:
- `id`, `tenant_id`, `employee_id`, `location_id`
- `date` - TIMESTAMP
- `check_in` - JSONB ⚠️ (NOT TIMESTAMP)
- `check_out` - JSONB ⚠️ (NOT TIMESTAMP)
- `check_in_time` - TIMESTAMP ✅
- `check_out_time` - TIMESTAMP ✅
- `status`, `type` - TEXT
- `metadata`, `audit_log` - JSONB
- `work_duration_minutes` - INTEGER
- `lateness_minutes`, `early_leave_minutes`, `overtime_minutes` - INTEGER
- `shift_id`, `work_schedule_id`, `work_shift_id` - TEXT
- `event_reference_id` - TEXT
- `created_at`, `updated_at`, `deleted_at`
- `company_id`, `department_id`, `device_id`, `retail_id`
- `source` - TEXT
- `is_locked` - BOOLEAN

**Important**: 
- Use `check_in_time` and `check_out_time` for timestamps
- `check_in` and `check_out` are JSONB (may contain location data, device info, etc.)

---

### 10. RETAIL_SHIFTS
**Correct Columns**:
- `id`, `tenant_id`, `store_id`, `employee_id`
- `start_time`, `end_time` - TIMESTAMP
- `opening_cash`, `closing_cash`, `expected_cash`, `actual_cash` - NUMERIC
- `variance` - NUMERIC
- `status` - TEXT
- `notes`, `closing_note`, `compliance_note` - TEXT
- `reconciliation_reason` - TEXT
- `created_at`, `updated_at`
- `company_id`, `ecommerce_id`
- `closed_by_id`, `opened_by_id` - TEXT

**All columns present** ✅

---

## API Mapping Recommendations

### For Sales Orders:
```typescript
// Use `amount` instead of `total_amount`
const order = await prisma.sales_orders.findMany({
  select: {
    id: true,
    amount: true,  // NOT total_amount
    customer_name: true,  // NOT order_number
    status: true,
  }
});
```

### For Stock Levels:
```typescript
// Use `on_hand` instead of `quantity_on_hand`
const stock = await prisma.stock_levels.findMany({
  select: {
    on_hand: true,  // NOT quantity_on_hand
    available: true,  // NOT quantity_available
    reserved: true,
  }
});
```

### For Stock Movements:
```typescript
// Use `type` and `created_at`
const movements = await prisma.stock_movements.findMany({
  where: {
    type: 'SALE',  // NOT movement_type or transaction_type
    created_at: { gte: today },  // NOT movement_date
  }
});
```

### For Journal Entries:
```typescript
// Calculate totals from lines, use journal_type
const entry = await prisma.finance_journal_entries.findMany({
  select: {
    id: true,
    journal_type: true,  // NOT entry_type
    ref: true,  // NOT entry_number
    source_event_id: true,  // For module linking
  },
  include: {
    finance_journal_lines: {
      select: {
        debit: true,  // NOT debit_amount
        credit: true,  // NOT credit_amount
      }
    }
  }
});

// Calculate totals
const totalDebit = entry.finance_journal_lines.reduce((sum, line) => sum + line.debit, 0);
const totalCredit = entry.finance_journal_lines.reduce((sum, line) => sum + line.credit, 0);
```

### For HR Attendance:
```typescript
// Use check_in_time and check_out_time
const attendance = await prisma.hr_attendance_records.findMany({
  where: {
    check_in_time: { gte: today },  // NOT check_in (which is JSONB)
  },
  select: {
    check_in_time: true,
    check_out_time: true,
    work_duration_minutes: true,
  }
});
```

---

## Critical Findings

### ✅ Working Correctly:
1. Money sources have `store_id` column
2. Retail shifts table complete
3. Payment transactions table comprehensive
4. Stock levels table has all inventory tracking fields

### ⚠️ Needs Attention:
1. Sales orders missing `order_number` - may need generation logic
2. Finance journal entries missing `source_module` - use `source_event_id` or `memo`
3. Finance journal entries no `total_debit`/`total_credit` - calculate from lines
4. HR attendance uses JSONB for `check_in`/`check_out` - use `_time` columns instead

### ❌ Schema Differences (not errors, just different naming):
1. `amount` vs `total_amount`
2. `on_hand` vs `quantity_on_hand`
3. `available` vs `quantity_available`
4. `type` vs `movement_type`/`transaction_type`
5. `journal_type` vs `entry_type`
6. `debit`/`credit` vs `debit_amount`/`credit_amount`

---

## Verification Queries

```sql
-- Test Sales Order Query
SELECT id, amount, customer_name, status, created_at
FROM sales_orders
WHERE tenant_id = 'tnt-3rlhko'
LIMIT 1;

-- Test Stock Levels Query
SELECT product_id, on_hand, available, reserved
FROM stock_levels
WHERE tenant_id = 'tnt-3rlhko' AND location_id = 'a3a241a4-4841-45a3-90cd-f7135e6847b4'
LIMIT 1;

-- Test Stock Movements Query
SELECT product_id, quantity, type, created_at
FROM stock_movements
WHERE tenant_id = 'tnt-3rlhko'
ORDER BY created_at DESC
LIMIT 1;

-- Test Journal Entry with Totals
SELECT 
  je.id,
  je.journal_type,
  je.ref,
  SUM(jl.debit) as total_debit,
  SUM(jl.credit) as total_credit
FROM finance_journal_entries je
LEFT JOIN finance_journal_lines jl ON je.id = jl.journal_entry_id
WHERE je.tenant_id = 'tnt-3rlhko'
GROUP BY je.id, je.journal_type, je.ref
LIMIT 1;
```

---

**Document Version**: 1.0  
**Last Updated**: June 24, 2026  
**Status**: Production Reference - Use for all API development
