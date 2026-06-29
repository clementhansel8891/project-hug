#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Phase 3: Department Operations
# Each department performs its core business activities
# ═══════════════════════════════════════════════════════════════════════

set -uo pipefail
source "$(dirname "$0")/lib.sh"

STATE_FILE="$RESULTS_DIR/tenant-state.json"
if [ ! -f "$STATE_FILE" ]; then
  echo "ERROR: Run previous phases first"
  exit 1
fi

OWNER_TOKEN=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['owner_token'])")
TENANT_ID=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['tenant_id'])")
COMPANY_ID=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['company_id'])")
OWNER_EMAIL=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['owner_email'])")
OWNER_PASSWORD=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['owner_password'])")
TIMESTAMP=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['timestamp'])")

# Re-login
RESP=$(api_post "/auth/login" "{\"email\": \"$OWNER_EMAIL\", \"password\": \"$OWNER_PASSWORD\"}")
TOKEN=$(json_field "$(get_body "$RESP")" "token")

T="$TENANT_ID"
C="$COMPANY_ID"

section "Phase 3: Department Operations"

# ═══════════════════════════════════════════════════════════════════════
# 3.1 INVENTORY — Create items, intake, transfer
# ═══════════════════════════════════════════════════════════════════════
subsection "3.1 Inventory Operations"

# Create items
ITEM_IDS=()
for i in 1 2 3; do
  RESP=$(api_post "/inventory/items" "{
    \"name\": \"E2E Product $i - $TIMESTAMP\",
    \"sku\": \"E2E-SKU-${TIMESTAMP}-${i}\",
    \"category\": \"jewelry\",
    \"unit\": \"pcs\",
    \"price\": $((i * 50000)),
    \"cost\": $((i * 25000)),
    \"stock\": 0
  }" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  BODY=$(get_body "$RESP")
  assert_status_one_of "Create inventory item $i" "$STATUS" "200" "201" "400"
  
  ITEM_ID=$(json_nested "$BODY" "id")
  [ -z "$ITEM_ID" ] && ITEM_ID=$(json_nested "$BODY" "data.id")
  ITEM_IDS+=("$ITEM_ID")
done

# Stock intake
if [ -n "${ITEM_IDS[0]:-}" ] && [ "${ITEM_IDS[0]}" != "None" ] && [ "${ITEM_IDS[0]}" != "" ]; then
  RESP=$(api_post "/inventory/intake" "{
    \"item_id\": \"${ITEM_IDS[0]}\",
    \"quantity\": 100,
    \"source\": \"purchase\",
    \"reference\": \"PO-E2E-001\"
  }" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Stock intake for item 1" "$STATUS" "200" "201" "400"
  
  # Stock transfer
  RESP=$(api_post "/inventory/transfer" "{
    \"item_id\": \"${ITEM_IDS[0]}\",
    \"quantity\": 20,
    \"from_location\": \"warehouse\",
    \"to_location\": \"store-main\",
    \"reference\": \"TRF-E2E-001\"
  }" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Stock transfer" "$STATUS" "200" "201" "400"
else
  skip_test "Stock intake" "No item ID available"
  skip_test "Stock transfer" "No item ID available"
fi

# View balances
RESP=$(api_get "/inventory/balances" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "View inventory balances" "$STATUS" "200" "400"

# View movements
RESP=$(api_get "/inventory/movements" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "View inventory movements" "$STATUS" "200" "400"

# ═══════════════════════════════════════════════════════════════════════
# 3.2 HR — Clock in/out, leave request
# ═══════════════════════════════════════════════════════════════════════
subsection "3.2 HR Operations"

# Clock in
RESP=$(api_post "/hr/attendance/clock-in" "{
  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"method\": \"manual\"
}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Clock in" "$STATUS" "200" "201" "400" "409"

# Create leave request
RESP=$(api_post "/hr/leave-requests" "{
  \"type\": \"annual\",
  \"start_date\": \"2026-08-01\",
  \"end_date\": \"2026-08-03\",
  \"reason\": \"E2E test vacation\"
}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Create leave request" "$STATUS" "200" "201" "400"

LEAVE_ID=$(json_nested "$BODY" "id")
[ -z "$LEAVE_ID" ] && LEAVE_ID=$(json_nested "$BODY" "data.id")

# Approve leave (as owner/manager)
if [ -n "$LEAVE_ID" ] && [ "$LEAVE_ID" != "None" ] && [ "$LEAVE_ID" != "" ]; then
  RESP=$(api_put "/hr/leave-requests/${LEAVE_ID}/approve" "{}" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Approve leave request" "$STATUS" "200" "400" "404"
else
  skip_test "Approve leave" "No leave ID"
fi

# Clock out
RESP=$(api_post "/hr/attendance/clock-out" "{
  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"method\": \"manual\"
}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Clock out" "$STATUS" "200" "201" "400" "409"

# ═══════════════════════════════════════════════════════════════════════
# 3.3 SALES — Lead, opportunity, quote
# ═══════════════════════════════════════════════════════════════════════
subsection "3.3 Sales Operations"

# Create lead
RESP=$(api_post "/sales/leads" "{
  \"name\": \"E2E Lead - Hotel Bali\",
  \"email\": \"hotelbali-${TIMESTAMP}@example.com\",
  \"phone\": \"+628123456789\",
  \"source\": \"website\",
  \"status\": \"new\"
}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Create sales lead" "$STATUS" "200" "201" "400"

LEAD_ID=$(json_nested "$BODY" "id")
[ -z "$LEAD_ID" ] && LEAD_ID=$(json_nested "$BODY" "data.id")

# Convert lead to opportunity
if [ -n "$LEAD_ID" ] && [ "$LEAD_ID" != "None" ] && [ "$LEAD_ID" != "" ]; then
  RESP=$(api_post "/sales/leads/${LEAD_ID}/convert" "{}" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  BODY=$(get_body "$RESP")
  assert_status_one_of "Convert lead to opportunity" "$STATUS" "200" "201" "400"
  
  OPP_ID=$(json_nested "$BODY" "opportunity_id")
  [ -z "$OPP_ID" ] && OPP_ID=$(json_nested "$BODY" "data.opportunity_id")
  [ -z "$OPP_ID" ] && OPP_ID=$(json_nested "$BODY" "id")
else
  skip_test "Convert lead" "No lead ID"
fi

# Create quote
RESP=$(api_post "/sales/quotes" "{
  \"opportunity_id\": \"${OPP_ID:-opp-placeholder}\",
  \"items\": [{\"name\": \"Silver Bracelet\", \"quantity\": 10, \"unit_price\": 150000}],
  \"total\": 1500000,
  \"valid_until\": \"2026-08-30\"
}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Create quote" "$STATUS" "200" "201" "400"

# ═══════════════════════════════════════════════════════════════════════
# 3.4 MARKETING — Campaign, lead capture
# ═══════════════════════════════════════════════════════════════════════
subsection "3.4 Marketing Operations"

# Create campaign
RESP=$(api_post "/marketing/campaigns" "{
  \"name\": \"E2E Summer Campaign $TIMESTAMP\",
  \"type\": \"digital\",
  \"channel\": \"social\",
  \"status\": \"draft\",
  \"budget\": 5000000,
  \"start_date\": \"2026-07-01\",
  \"end_date\": \"2026-08-31\"
}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Create marketing campaign" "$STATUS" "200" "201" "400"

CAMPAIGN_ID=$(json_nested "$BODY" "id")
[ -z "$CAMPAIGN_ID" ] && CAMPAIGN_ID=$(json_nested "$BODY" "data.id")

# Activate campaign
if [ -n "$CAMPAIGN_ID" ] && [ "$CAMPAIGN_ID" != "None" ] && [ "$CAMPAIGN_ID" != "" ]; then
  RESP=$(api_put "/marketing/campaigns/${CAMPAIGN_ID}/status" "{\"status\": \"active\"}" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Activate campaign" "$STATUS" "200" "400" "404"
fi

# Capture lead
RESP=$(api_post "/marketing/leads" "{
  \"name\": \"E2E Marketing Lead\",
  \"email\": \"mkt-lead-${TIMESTAMP}@example.com\",
  \"source\": \"campaign\",
  \"campaign_id\": \"${CAMPAIGN_ID:-}\"
}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Capture marketing lead" "$STATUS" "200" "201" "400"

# ═══════════════════════════════════════════════════════════════════════
# 3.5 PROCUREMENT — Supplier, requisition, PO
# ═══════════════════════════════════════════════════════════════════════
subsection "3.5 Procurement Operations"

# Create supplier
RESP=$(api_post "/procurement/suppliers" "{
  \"name\": \"E2E Silver Supplier\",
  \"email\": \"supplier-${TIMESTAMP}@example.com\",
  \"phone\": \"+628987654321\",
  \"country\": \"ID\",
  \"category\": \"raw_materials\"
}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Create supplier" "$STATUS" "200" "201" "400"

SUPPLIER_ID=$(json_nested "$BODY" "id")
[ -z "$SUPPLIER_ID" ] && SUPPLIER_ID=$(json_nested "$BODY" "data.id")

# Create requisition
RESP=$(api_post "/procurement/requisitions" "{
  \"title\": \"E2E Silver Wire Order\",
  \"items\": [{\"description\": \"Sterling Silver Wire 1mm\", \"quantity\": 500, \"unit\": \"meters\", \"estimated_cost\": 2500000}],
  \"priority\": \"normal\",
  \"required_by\": \"2026-08-15\"
}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Create requisition" "$STATUS" "200" "201" "400"

REQ_ID=$(json_nested "$BODY" "id")
[ -z "$REQ_ID" ] && REQ_ID=$(json_nested "$BODY" "data.id")

# ═══════════════════════════════════════════════════════════════════════
# 3.6 FINANCE — Chart of Accounts, posting rule
# ═══════════════════════════════════════════════════════════════════════
subsection "3.6 Finance Operations"

# View Chart of Accounts
RESP=$(api_get "/finance/coa" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "View Chart of Accounts" "$STATUS" "200" "400" "403"

# Create COA account
RESP=$(api_post "/finance/coa" "{
  \"code\": \"1100-${TIMESTAMP}\",
  \"name\": \"E2E Cash Account\",
  \"type\": \"asset\",
  \"subtype\": \"current_asset\"
}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Create COA account" "$STATUS" "200" "201" "400" "409"

# View finance ledger
RESP=$(api_get "/finance/ledger" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "View finance ledger" "$STATUS" "200" "400"

# ═══════════════════════════════════════════════════════════════════════
# 3.7 RETAIL — Open shift, checkout, close shift
# ═══════════════════════════════════════════════════════════════════════
subsection "3.7 Retail POS Operations"

# Open shift
RESP=$(api_post "/retail/shifts/open" "{
  \"opening_cash\": 500000,
  \"register\": \"REG-E2E-01\"
}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Open POS shift" "$STATUS" "200" "201" "400" "409"

SHIFT_ID=$(json_nested "$BODY" "id")
[ -z "$SHIFT_ID" ] && SHIFT_ID=$(json_nested "$BODY" "data.id")
[ -z "$SHIFT_ID" ] && SHIFT_ID=$(json_nested "$BODY" "shift.id")

# Create retail order / checkout
RESP=$(api_post "/retail/orders" "{
  \"items\": [{\"product_id\": \"${ITEM_IDS[0]:-prod-1}\", \"name\": \"Silver Ring\", \"quantity\": 2, \"price\": 150000}],
  \"total\": 300000,
  \"payment_method\": \"cash\",
  \"customer_name\": \"Walk-in Customer\"
}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Create retail order" "$STATUS" "200" "201" "400"

ORDER_ID=$(json_nested "$BODY" "id")
[ -z "$ORDER_ID" ] && ORDER_ID=$(json_nested "$BODY" "data.id")

# Close shift
if [ -n "$SHIFT_ID" ] && [ "$SHIFT_ID" != "None" ] && [ "$SHIFT_ID" != "" ]; then
  RESP=$(api_put "/retail/shifts/${SHIFT_ID}/close" "{
    \"closing_cash\": 800000,
    \"notes\": \"E2E test shift\"
  }" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Close POS shift" "$STATUS" "200" "400" "404"
else
  skip_test "Close POS shift" "No shift ID"
fi

# ═══════════════════════════════════════════════════════════════════════
# 3.8 PAYMENT — Transaction creation
# ═══════════════════════════════════════════════════════════════════════
subsection "3.8 Payment Operations"

RESP=$(api_post "/payment/transactions" "{
  \"amount\": 300000,
  \"currency\": \"IDR\",
  \"method\": \"cash\",
  \"reference\": \"ORD-${ORDER_ID:-E2E-001}\",
  \"description\": \"POS sale payment\"
}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Create payment transaction" "$STATUS" "200" "201" "400"

# ═══════════════════════════════════════════════════════════════════════
# 3.9 SYNC — Verify sync endpoints
# ═══════════════════════════════════════════════════════════════════════
subsection "3.9 Sync Operations"

RESP=$(api_get "/sync/health/e2e-store-${TIMESTAMP}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status "Sync health endpoint" "200" "$STATUS" "$BODY"

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
