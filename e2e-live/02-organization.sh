#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Phase 2: Organization Setup
# Create departments, employees, assign roles
# ═══════════════════════════════════════════════════════════════════════

set -uo pipefail
source "$(dirname "$0")/lib.sh"

# Load tenant state from Phase 1
STATE_FILE="$RESULTS_DIR/tenant-state.json"
if [ ! -f "$STATE_FILE" ]; then
  echo "ERROR: Run 01-onboarding.sh first"
  exit 1
fi

OWNER_TOKEN=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['owner_token'])")
TENANT_ID=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['tenant_id'])")
COMPANY_ID=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['company_id'])")
OWNER_EMAIL=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['owner_email'])")
OWNER_PASSWORD=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['owner_password'])")
TIMESTAMP=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['timestamp'])")

# Re-login in case token expired
RESP=$(api_post "/auth/login" "{\"email\": \"$OWNER_EMAIL\", \"password\": \"$OWNER_PASSWORD\"}")
OWNER_TOKEN=$(json_field "$(get_body "$RESP")" "token")

section "Phase 2: Organization Setup"

# ─── 2.1 Create Departments ──────────────────────────────────────────────
subsection "2.1 Create Departments"

DEPT_IDS=()
for DEPT in "Finance" "Human Resources" "Sales" "Marketing" "Retail Operations" "Warehouse" "Procurement" "IT"; do
  RESP=$(api_post "/hr/departments" "{
    \"name\": \"$DEPT\",
    \"code\": \"$(echo $DEPT | tr '[:upper:]' '[:lower:]' | tr ' ' '-')\"
  }" "$OWNER_TOKEN" "$TENANT_ID" "$COMPANY_ID")
  STATUS=$(get_status "$RESP")
  BODY=$(get_body "$RESP")
  assert_status_one_of "Create department: $DEPT" "$STATUS" "200" "201" "409"
  
  DEPT_ID=$(json_nested "$BODY" "id")
  [ -z "$DEPT_ID" ] && DEPT_ID=$(json_nested "$BODY" "data.id")
  DEPT_IDS+=("$DEPT_ID")
done

# ─── 2.2 Create Employees ────────────────────────────────────────────────
subsection "2.2 Create Employees"

declare -A EMPLOYEE_TOKENS

EMPLOYEES=(
  "finance_mgr:Budi Finance:budi.finance.${TIMESTAMP}@testcorp.com:FINANCE_MANAGER:finance"
  "hr_mgr:Siti HR:siti.hr.${TIMESTAMP}@testcorp.com:HR_MANAGER:human-resources"
  "sales_rep:Adi Sales:adi.sales.${TIMESTAMP}@testcorp.com:SALES_REP:sales"
  "marketing_mgr:Dewi Marketing:dewi.mkt.${TIMESTAMP}@testcorp.com:MARKETING_MANAGER:marketing"
  "retail_cashier:Rina Retail:rina.retail.${TIMESTAMP}@testcorp.com:RETAIL_CASHIER:retail-operations"
  "warehouse_staff:Joko Warehouse:joko.wh.${TIMESTAMP}@testcorp.com:WAREHOUSE_STAFF:warehouse"
  "procurement_mgr:Wati Procurement:wati.proc.${TIMESTAMP}@testcorp.com:PROCUREMENT_MANAGER:procurement"
  "it_admin:Rudi IT:rudi.it.${TIMESTAMP}@testcorp.com:IT_ADMIN:it"
)

for EMP_DATA in "${EMPLOYEES[@]}"; do
  IFS=':' read -r KEY NAME EMAIL ROLE DEPT <<< "$EMP_DATA"
  
  # Register user first
  RESP=$(api_post "/auth/register" "{
    \"email\": \"$EMAIL\",
    \"password\": \"TestEmp2026!\",
    \"first_name\": \"$(echo $NAME | cut -d' ' -f1)\",
    \"last_name\": \"$(echo $NAME | cut -d' ' -f2-)\"
  }")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Register $NAME" "$STATUS" "200" "201" "409"
  
  # Create employee record
  RESP=$(api_post "/hr/employees" "{
    \"employee_code\": \"EMP-${KEY}-${TIMESTAMP}\",
    \"first_name\": \"$(echo $NAME | cut -d' ' -f1)\",
    \"last_name\": \"$(echo $NAME | cut -d' ' -f2-)\",
    \"email\": \"$EMAIL\",
    \"department_id\": \"${DEPT_IDS[0]:-dept-default}\",
    \"hire_date\": \"2026-01-15\",
    \"position\": \"$ROLE\",
    \"employment_type\": \"full_time\",
    \"status\": \"active\",
    \"base_salary\": 5000000
  }" "$OWNER_TOKEN" "$TENANT_ID" "$COMPANY_ID")
  STATUS=$(get_status "$RESP")
  BODY=$(get_body "$RESP")
  assert_status_one_of "Create employee: $NAME" "$STATUS" "200" "201" "409" "400"
  
  EMP_ID=$(json_nested "$BODY" "id")
  [ -z "$EMP_ID" ] && EMP_ID=$(json_nested "$BODY" "data.id")
  
  # Login as this employee to get their token
  RESP=$(api_post "/auth/login" "{\"email\": \"$EMAIL\", \"password\": \"TestEmp2026!\"}")
  EMP_TOKEN=$(json_field "$(get_body "$RESP")" "token")
  EMPLOYEE_TOKENS[$KEY]="$EMP_TOKEN"
done

# ─── 2.3 Verify Employees Created ────────────────────────────────────────
subsection "2.3 Verify employees"

RESP=$(api_get "/hr/employees" "$OWNER_TOKEN" "$TENANT_ID" "$COMPANY_ID")
STATUS=$(get_status "$RESP")
assert_status "List employees" "200" "$STATUS"

# ─── 2.4 Create a Retail Store ────────────────────────────────────────────
subsection "2.4 Create retail store"

RESP=$(api_post "/retail/stores" "{
  \"name\": \"E2E Main Store\",
  \"code\": \"e2e-store-${TIMESTAMP}\",
  \"address\": \"Jl. Test No. 1, Bali\",
  \"type\": \"physical\"
}" "$OWNER_TOKEN" "$TENANT_ID" "$COMPANY_ID")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Create retail store" "$STATUS" "200" "201" "400" "409"

STORE_ID=$(json_nested "$BODY" "id")
[ -z "$STORE_ID" ] && STORE_ID=$(json_nested "$BODY" "data.id")

# ─── Save state ───────────────────────────────────────────────────────────
python3 -c "
import json
state = json.load(open('$STATE_FILE'))
state['store_id'] = '${STORE_ID:-}'
state['employees'] = {
$(for KEY in "${!EMPLOYEE_TOKENS[@]}"; do echo "  '$KEY': '${EMPLOYEE_TOKENS[$KEY]:-}',"; done)
}
json.dump(state, open('$STATE_FILE', 'w'), indent=2)
"

print_summary "Phase 2 - Organization"
