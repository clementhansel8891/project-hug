#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Phase 2: Organization Setup
# Create departments, employees (directly via HR, no pre-registration needed)
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
  
  DEPT_ID=$(json_nested "$BODY" "data.id")
  [ -z "$DEPT_ID" ] && DEPT_ID=$(json_nested "$BODY" "id")
  DEPT_IDS+=("${DEPT_ID:-}")
done

# Get the first valid department ID for employee creation
FIRST_DEPT_ID="${DEPT_IDS[0]:-}"
if [ -z "$FIRST_DEPT_ID" ] || [ "$FIRST_DEPT_ID" = "None" ]; then
  # Fetch from API
  RESP=$(api_get "/hr/departments" "$OWNER_TOKEN" "$TENANT_ID" "$COMPANY_ID")
  FIRST_DEPT_ID=$(python3 -c "
import sys,json
d=json.load(sys.stdin)
depts = d.get('data',[]) if isinstance(d.get('data'), list) else (d if isinstance(d, list) else [])
print(depts[0]['id'] if depts else 'dept-fallback')
" <<< "$(get_body "$RESP")" 2>/dev/null)
fi

# ─── 2.2 Create Employees (directly via HR endpoint) ─────────────────────
subsection "2.2 Create Employees"

# The HR employee creation endpoint creates user + employee in one step
# No need to pre-register via /auth/register

EMPLOYEE_IDS=()
EMPLOYEE_DATA=(
  "Budi:Santoso:budi.santoso.${TIMESTAMP}@testcorp.com:Finance Manager"
  "Siti:Rahayu:siti.rahayu.${TIMESTAMP}@testcorp.com:HR Manager"
  "Adi:Pratama:adi.pratama.${TIMESTAMP}@testcorp.com:Sales Representative"
  "Dewi:Lestari:dewi.lestari.${TIMESTAMP}@testcorp.com:Marketing Manager"
  "Rina:Kusuma:rina.kusuma.${TIMESTAMP}@testcorp.com:Retail Cashier"
  "Joko:Widodo:joko.widodo.${TIMESTAMP}@testcorp.com:Warehouse Staff"
  "Wati:Suryani:wati.suryani.${TIMESTAMP}@testcorp.com:Procurement Officer"
  "Rudi:Hermawan:rudi.hermawan.${TIMESTAMP}@testcorp.com:IT Administrator"
)

IDX=0
for EMP in "${EMPLOYEE_DATA[@]}"; do
  IFS=':' read -r FIRST LAST EMAIL POSITION <<< "$EMP"
  IDX=$((IDX + 1))
  
  RESP=$(api_post "/hr/employees" "{
    \"employee_code\": \"EMP-${TIMESTAMP}-${IDX}\",
    \"first_name\": \"$FIRST\",
    \"last_name\": \"$LAST\",
    \"email\": \"$EMAIL\",
    \"department_id\": \"$FIRST_DEPT_ID\",
    \"hire_date\": \"2026-01-15\",
    \"position\": \"$POSITION\",
    \"employment_type\": \"full_time\",
    \"status\": \"active\",
    \"base_salary\": 5000000
  }" "$OWNER_TOKEN" "$TENANT_ID" "$COMPANY_ID")
  STATUS=$(get_status "$RESP")
  BODY=$(get_body "$RESP")
  assert_status_one_of "Create employee: $FIRST $LAST" "$STATUS" "200" "201"
  
  EMP_ID=$(json_nested "$BODY" "data.id")
  [ -z "$EMP_ID" ] && EMP_ID=$(json_nested "$BODY" "id")
  EMPLOYEE_IDS+=("${EMP_ID:-}")
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
  \"code\": \"E2E-STORE-${TIMESTAMP}\",
  \"location_id\": \"loc-e2e-${TIMESTAMP}\",
  \"type\": \"flagship\",
  \"address\": \"Jl. Test No. 1, Bali\"
}" "$OWNER_TOKEN" "$TENANT_ID" "$COMPANY_ID")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Create retail store" "$STATUS" "200" "201"

STORE_ID=$(json_nested "$BODY" "data.id")
[ -z "$STORE_ID" ] && STORE_ID=$(json_nested "$BODY" "id")

# ─── Save state ───────────────────────────────────────────────────────────
python3 -c "
import json
state = json.load(open('$STATE_FILE'))
state['store_id'] = '${STORE_ID:-}'
state['first_dept_id'] = '${FIRST_DEPT_ID:-}'
state['first_employee_id'] = '${EMPLOYEE_IDS[0]:-}'
json.dump(state, open('$STATE_FILE', 'w'), indent=2)
"

print_summary "Phase 2 - Organization"
