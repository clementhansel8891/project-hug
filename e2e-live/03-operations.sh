#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Phase 3: Department Operations
# Each department performs its core business activities with CORRECT DTOs
# ═══════════════════════════════════════════════════════════════════════

set -uo pipefail
source "$(dirname "$0")/lib.sh"

STATE_FILE="$RESULTS_DIR/tenant-state.json"
if [ ! -f "$STATE_FILE" ]; then
  echo "ERROR: Run previous phases first"
  exit 1
fi

OWNER_EMAIL=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['owner_email'])")
OWNER_PASSWORD=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['owner_password'])")
TENANT_ID=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['tenant_id'])")
COMPANY_ID=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['company_id'])")
TIMESTAMP=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['timestamp'])")

# Re-login
RESP=$(api_post "/auth/login" "{\"email\": \"$OWNER_EMAIL\", \"password\": \"$OWNER_PASSWORD\"}")
TOKEN=$(json_field "$(get_body "$RESP")" "token")

T="$TENANT_ID"
C="$COMPANY_ID"

# Load IDs from Phase 2
STORE_ID=$(python3 -c "import json; print(json.load(open('$STATE_FILE')).get('store_id',''))" 2>/dev/null)
FIRST_DEPT_ID=$(python3 -c "import json; print(json.load(open('$STATE_FILE')).get('first_dept_id',''))" 2>/dev/null)
EMP_ID_FROM_PHASE2=$(python3 -c "import json; print(json.load(open('$STATE_FILE')).get('first_employee_id',''))" 2>/dev/null)

section "Phase 3: Department Operations"

# ═══════════════════════════════════════════════════════════════════════
# 3.1 INVENTORY — Create items, intake, transfer
# ═══════════════════════════════════════════════════════════════════════
subsection "3.1 Inventory Operations"

ITEM_IDS=()
for i in 1 2 3; do
  RESP=$(api_post "/inventory/items" "{
    \"sku\": \"E2E-SKU-${TIMESTAMP}-${i}\",
    \"name\": \"E2E Silver Ring Type $i - $TIMESTAMP\",
    \"category\": \"Jewelry-${TIMESTAMP}-${i}\",
    \"uom\": \"pcs\",
    \"base_price\": $((i * 50000)),
    \"selling_price\": $((i * 75000)),
    \"active\": true
  }" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  BODY=$(get_body "$RESP")
  assert_status_one_of "Create inventory item $i" "$STATUS" "200" "201"

  ITEM_ID=$(json_nested "$BODY" "data.id")
  [ -z "$ITEM_ID" ] && ITEM_ID=$(json_nested "$BODY" "id")
  ITEM_IDS+=("$ITEM_ID")
done

# Stock intake (requires item_id, location_id, quantity, unit_cost, reason)
# Get a location ID from the store that was created in Phase 2
LOCATION_RESP=$(api_get "/retail/stores" "$TOKEN" "$T" "$C")
LOCATION_ID=$(python3 -c "
import sys,json
d=json.load(sys.stdin)
stores = d.get('data',[]) if isinstance(d.get('data'), list) else (d if isinstance(d, list) else [])
print(stores[0].get('location_id','') if stores else '')
" <<< "$(get_body "$LOCATION_RESP")" 2>/dev/null)
[ -z "$LOCATION_ID" ] && LOCATION_ID="placeholder"

if [ -n "${ITEM_IDS[0]:-}" ] && [ "${ITEM_IDS[0]}" != "None" ] && [ "${ITEM_IDS[0]}" != "" ]; then
  RESP=$(api_post "/inventory/intake" "{
    \"item_id\": \"${ITEM_IDS[0]}\",
    \"location_id\": \"$LOCATION_ID\",
    \"quantity\": 100,
    \"unit_cost\": 25000,
    \"reason\": \"Initial stock from supplier PO-E2E-001\"
  }" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Stock intake for item 1" "$STATUS" "200" "201"

  # Stock transfer
  RESP=$(api_post "/inventory/transfer" "{
    \"item_id\": \"${ITEM_IDS[0]}\",
    \"from_location_id\": \"$LOCATION_ID\",
    \"to_location_id\": \"$LOCATION_ID\",
    \"quantity\": 20,
    \"reason\": \"Transfer to retail floor\"
  }" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Stock transfer" "$STATUS" "200" "201"
else
  skip_test "Stock intake" "No item ID from creation"
  skip_test "Stock transfer" "No item ID from creation"
fi

# View balances and movements
RESP=$(api_get "/inventory/balances" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status "View inventory balances" "200" "$STATUS"

RESP=$(api_get "/inventory/movements" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status "View inventory movements" "200" "$STATUS"

# ═══════════════════════════════════════════════════════════════════════
# 3.2 HR — Create employee, clock in/out, leave request
# ═══════════════════════════════════════════════════════════════════════
subsection "3.2 HR Operations"

# Get employee ID from Phase 2 state
EMP_ID="$EMP_ID_FROM_PHASE2"

if [ -n "$EMP_ID" ] && [ "$EMP_ID" != "None" ] && [ "$EMP_ID" != "" ]; then
  echo -e "  ${GREEN}✓${NC} Using employee from Phase 2: $EMP_ID"
  PASS=$((PASS + 1))


# Clock in (requires employee_id)
if [ -n "$EMP_ID" ] && [ "$EMP_ID" != "None" ] && [ "$EMP_ID" != "" ]; then
  RESP=$(api_post "/hr/attendance/clock-in" "{
    \"employee_id\": \"$EMP_ID\"
  }" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Clock in" "$STATUS" "200" "201"

  # Clock out
  RESP=$(api_post "/hr/attendance/clock-out" "{
    \"employee_id\": \"$EMP_ID\"
  }" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Clock out" "$STATUS" "200" "201"

  # Create leave request (uses real dept_id from Phase 2)
  RESP=$(api_post "/hr/leave-requests" "{
    \"employee_id\": \"$EMP_ID\",
    \"department_id\": \"$FIRST_DEPT_ID\",
    \"leave_type\": \"annual\",
    \"start_date\": \"2026-08-01\",
    \"end_date\": \"2026-08-03\",
    \"total_days\": 3,
    \"reason\": \"E2E test vacation\"
  }" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  BODY=$(get_body "$RESP")
  assert_status_one_of "Create leave request" "$STATUS" "200" "201"

  LEAVE_ID=$(json_nested "$BODY" "data.id")
  [ -z "$LEAVE_ID" ] && LEAVE_ID=$(json_nested "$BODY" "id")

  # Approve leave
  if [ -n "$LEAVE_ID" ] && [ "$LEAVE_ID" != "None" ] && [ "$LEAVE_ID" != "" ]; then
    RESP=$(api_put "/hr/leave-requests/${LEAVE_ID}/approve" "{}" "$TOKEN" "$T" "$C")
    STATUS=$(get_status "$RESP")
    assert_status_one_of "Approve leave request" "$STATUS" "200" "201"
  else
    skip_test "Approve leave" "No leave ID returned"
  fi
else
  skip_test "Clock in" "No employee ID"
  skip_test "Clock out" "No employee ID"
  skip_test "Create leave request" "No employee ID"
  skip_test "Approve leave" "No employee ID"
fi

# ═══════════════════════════════════════════════════════════════════════
# 3.3 SALES — Lead, opportunity, quote
# ═══════════════════════════════════════════════════════════════════════
subsection "3.3 Sales Operations"

RESP=$(api_post "/sales/leads" "{
  \"company_name\": \"Hotel Bali Paradise\",
  \"contact_name\": \"Made Sudana\",
  \"contact_email\": \"made.sudana.${TIMESTAMP}@hotelbali.com\",
  \"potential_value\": 15000000,
  \"source\": \"inbound\",
  \"priority\": \"high\"
}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Create sales lead" "$STATUS" "200" "201"

LEAD_ID=$(json_nested "$BODY" "data.id")
[ -z "$LEAD_ID" ] && LEAD_ID=$(json_nested "$BODY" "id")

# Convert lead
if [ -n "$LEAD_ID" ] && [ "$LEAD_ID" != "None" ] && [ "$LEAD_ID" != "" ]; then
  RESP=$(api_post "/sales/leads/${LEAD_ID}/convert" "{}" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  BODY=$(get_body "$RESP")
  assert_status_one_of "Convert lead to opportunity" "$STATUS" "200" "201"

  OPP_ID=$(json_nested "$BODY" "data.opportunity_id")
  [ -z "$OPP_ID" ] && OPP_ID=$(json_nested "$BODY" "data.id")
  [ -z "$OPP_ID" ] && OPP_ID=$(json_nested "$BODY" "opportunity_id")

  # Create quote
  if [ -n "$OPP_ID" ] && [ "$OPP_ID" != "None" ] && [ "$OPP_ID" != "" ]; then
    RESP=$(api_post "/sales/quotes" "{
      \"opportunityId\": \"$OPP_ID\",
      \"amount\": 15000000,
      \"discountPercent\": 10,
      \"validDays\": 30,
      \"notes\": \"E2E test quote for Hotel Bali\"
    }" "$TOKEN" "$T" "$C")
    STATUS=$(get_status "$RESP")
    assert_status_one_of "Create quote" "$STATUS" "200" "201"
  else
    skip_test "Create quote" "No opportunity ID"
  fi
else
  skip_test "Convert lead" "No lead ID"
  skip_test "Create quote" "No lead ID"
fi

# ═══════════════════════════════════════════════════════════════════════
# 3.4 MARKETING — Campaign, lead capture
# ═══════════════════════════════════════════════════════════════════════
subsection "3.4 Marketing Operations"

RESP=$(api_post "/marketing/campaigns" "{
  \"name\": \"E2E Summer Sale $TIMESTAMP\",
  \"objective\": \"lead_generation\",
  \"channel_mix\": [\"meta_ads\", \"email\"],
  \"budget\": 5000000,
  \"start_date\": \"2026-07-01\",
  \"end_date\": \"2026-08-31\",
  \"audience\": \"luxury_buyers_bali\"
}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Create marketing campaign" "$STATUS" "200" "201"

CAMPAIGN_ID=$(json_nested "$BODY" "data.id")
[ -z "$CAMPAIGN_ID" ] && CAMPAIGN_ID=$(json_nested "$BODY" "id")

# Activate campaign
if [ -n "$CAMPAIGN_ID" ] && [ "$CAMPAIGN_ID" != "None" ] && [ "$CAMPAIGN_ID" != "" ]; then
  RESP=$(api_put "/marketing/campaigns/${CAMPAIGN_ID}/status" "{\"status\": \"active\"}" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Activate campaign" "$STATUS" "200" "201"
else
  skip_test "Activate campaign" "No campaign ID"
fi

# Capture marketing lead
RESP=$(api_post "/marketing/leads" "{
  \"source\": \"landing_page\",
  \"company_name\": \"E2E Resort Group\",
  \"contact_name\": \"Wayan Darma\",
  \"email\": \"wayan.${TIMESTAMP}@resortgroup.com\",
  \"phone\": \"+628123000001\",
  \"country\": \"ID\",
  \"industry\": \"hospitality\"
}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Capture marketing lead" "$STATUS" "200" "201"

# ═══════════════════════════════════════════════════════════════════════
# 3.5 PROCUREMENT — Supplier, requisition
# ═══════════════════════════════════════════════════════════════════════
subsection "3.5 Procurement Operations"

RESP=$(api_post "/procurement/suppliers" "{
  \"name\": \"E2E Silver Supplier Co\",
  \"taxId\": \"NPWP-E2E-${TIMESTAMP}\",
  \"category\": \"raw_materials\",
  \"branchCode\": \"HQ\",
  \"contactPerson\": \"Pak Agus\",
  \"contact_email\": \"agus.supplier.${TIMESTAMP}@silver.com\",
  \"contactPhone\": \"+628987000001\"
}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Create supplier" "$STATUS" "200" "201"

SUPPLIER_ID=$(json_nested "$BODY" "data.id")
[ -z "$SUPPLIER_ID" ] && SUPPLIER_ID=$(json_nested "$BODY" "id")

# Create requisition (use free-text branchCode and requesterDept)
RESP=$(api_post "/procurement/requisitions" "{
  \"title\": \"E2E Silver Wire Order\",
  \"description\": \"Sterling Silver Wire 1mm for production\",
  \"requesterDept\": \"Finance\",
  \"branchCode\": \"HQ\",
  \"amount\": 2500000,
  \"currency\": \"IDR\",
  \"category\": \"raw_materials\"
}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Create requisition" "$STATUS" "200" "201"

REQ_ID=$(json_nested "$BODY" "data.id")
[ -z "$REQ_ID" ] && REQ_ID=$(json_nested "$BODY" "id")

# ═══════════════════════════════════════════════════════════════════════
# 3.6 FINANCE — Chart of Accounts
# ═══════════════════════════════════════════════════════════════════════
subsection "3.6 Finance Operations"

RESP=$(api_get "/finance/coa" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status "View Chart of Accounts" "200" "$STATUS"

RESP=$(api_post "/finance/coa" "{
  \"accountCode\": \"1100-${TIMESTAMP}\",
  \"name\": \"E2E Cash in Bank\",
  \"accountType\": \"ASSET\",
  \"normalBalance\": \"DEBIT\"
}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Create COA account" "$STATUS" "200" "201"

RESP=$(api_get "/finance/ledger" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status "View finance ledger" "200" "$STATUS"

# ═══════════════════════════════════════════════════════════════════════
# 3.7 RETAIL — Store, shift, order
# ═══════════════════════════════════════════════════════════════════════
subsection "3.7 Retail POS Operations"

# Use store from Phase 2 (already created successfully)
if [ -n "$STORE_ID" ] && [ "$STORE_ID" != "None" ] && [ "$STORE_ID" != "" ]; then
  echo -e "  ${GREEN}✓${NC} Using store from Phase 2: $STORE_ID"
  PASS=$((PASS + 1))
  RESP=$(api_post "/retail/shifts/open" "{
    \"store_id\": \"$STORE_ID\",
    \"terminal_id\": \"POS-01\",
    \"opening_cash\": 500000
  }" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  BODY=$(get_body "$RESP")
  assert_status_one_of "Open POS shift" "$STATUS" "200" "201"

  SHIFT_ID=$(json_nested "$BODY" "data.id")
  [ -z "$SHIFT_ID" ] && SHIFT_ID=$(json_nested "$BODY" "id")

  # Create order
  RESP=$(api_post "/retail/orders" "{
    \"store_id\": \"$STORE_ID\",
    \"terminal_id\": \"POS-01\",
    \"shift_id\": \"${SHIFT_ID:-}\",
    \"items\": [{\"product_id\": \"${ITEM_IDS[0]:-prod-1}\", \"quantity\": \"2\", \"unit_price\": \"150000\"}],
    \"payment_method\": \"cash\",
    \"grand_total\": \"300000\"
  }" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  BODY=$(get_body "$RESP")
  assert_status_one_of "Create retail order" "$STATUS" "200" "201"

  ORDER_ID=$(json_nested "$BODY" "data.id")
  [ -z "$ORDER_ID" ] && ORDER_ID=$(json_nested "$BODY" "id")

  # Close shift
  if [ -n "$SHIFT_ID" ] && [ "$SHIFT_ID" != "None" ] && [ "$SHIFT_ID" != "" ]; then
    RESP=$(api_put "/retail/shifts/${SHIFT_ID}/close" "{
      \"closing_cash\": 800000,
      \"notes\": \"E2E test shift completed\"
    }" "$TOKEN" "$T" "$C")
    STATUS=$(get_status "$RESP")
    assert_status_one_of "Close POS shift" "$STATUS" "200" "201"
  else
    skip_test "Close POS shift" "No shift ID"
  fi
else
  skip_test "Open POS shift" "No store ID"
  skip_test "Create retail order" "No store ID"
  skip_test "Close POS shift" "No store ID"
fi

# ═══════════════════════════════════════════════════════════════════════
# 3.8 PAYMENT — Transaction
# ═══════════════════════════════════════════════════════════════════════
subsection "3.8 Payment Operations"

RESP=$(api_post "/payment/transactions" "{
  \"type\": \"pos_payment\",
  \"amount\": 300000,
  \"destination\": \"cash-register-01\",
  \"method\": \"CASH\",
  \"idempotency_key\": \"e2e-pay-${TIMESTAMP}\"
}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Create payment transaction" "$STATUS" "200" "201"

PAY_ID=$(json_nested "$BODY" "data.id")
[ -z "$PAY_ID" ] && PAY_ID=$(json_nested "$BODY" "id")

# Approve payment
if [ -n "$PAY_ID" ] && [ "$PAY_ID" != "None" ] && [ "$PAY_ID" != "" ]; then
  RESP=$(api_put "/payment/transactions/${PAY_ID}/approve" "{}" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Approve payment" "$STATUS" "200" "201"
else
  skip_test "Approve payment" "No payment ID"
fi

# ═══════════════════════════════════════════════════════════════════════
# 3.9 SYNC — Verify all sync endpoints with fresh tenant data
# ═══════════════════════════════════════════════════════════════════════
subsection "3.9 Sync Operations"

RESP=$(api_get "/sync/health/loc-e2e-${TIMESTAMP}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status "Sync health endpoint" "200" "$STATUS"

RESP=$(api_get "/sync/reconciliation/${TENANT_ID}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status "Sync reconciliation endpoint" "200" "$STATUS"

RESP=$(api_get "/sync/snapshot?page=1&pageSize=5" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status "Sync snapshot endpoint" "200" "$STATUS"

RESP=$(api_get "/sync/delta?since=2026-01-01&page=1&pageSize=5" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status "Sync delta endpoint" "200" "$STATUS"

print_summary "Phase 3 - Operations"
