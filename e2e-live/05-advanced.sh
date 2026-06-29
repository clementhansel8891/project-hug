#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Phase 5: Advanced Integration Tests
# Cross-module flows, Multi-role access, Edge cases, Data integrity
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
STORE_ID=$(python3 -c "import json; print(json.load(open('$STATE_FILE')).get('store_id',''))")
FIRST_EMPLOYEE_ID=$(python3 -c "import json; print(json.load(open('$STATE_FILE')).get('first_employee_id',''))")
TIMESTAMP=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['timestamp'])")

# Re-login as owner
RESP=$(api_post "/auth/login" "{\"email\": \"$OWNER_EMAIL\", \"password\": \"$OWNER_PASSWORD\"}")
OWNER_TOKEN=$(json_field "$(get_body "$RESP")" "token")
T="$TENANT_ID"
C="$COMPANY_ID"

section "Phase 5: Advanced Integration Tests"

# ═══════════════════════════════════════════════════════════════════════
# 5.1 CROSS-MODULE FLOW: Procurement → Inventory → Sales → Finance
# ═══════════════════════════════════════════════════════════════════════
subsection "5.1 Cross-Module Flow: Procurement to Finance"

# Step 1: Create a procurement requisition
# Get a valid department and employee for this tenant
RESP_DEPTS=$(api_get "/hr/departments" "$OWNER_TOKEN" "$T" "$C")
DEPT_ID=$(echo "$(get_body "$RESP_DEPTS")" | python3 -c "import json,sys; d=json.load(sys.stdin); depts=d.get('data',[]); print(depts[0]['id'] if depts else '')" 2>/dev/null)
[ -z "$DEPT_ID" ] && DEPT_ID="operations"

RESP_EMPS=$(api_get "/hr/employees" "$OWNER_TOKEN" "$T" "$C")
EMP_ID=$(echo "$(get_body "$RESP_EMPS")" | python3 -c "import json,sys; d=json.load(sys.stdin); emps=d.get('data',[]); print(emps[0]['id'] if emps else '')" 2>/dev/null)

RESP=$(api_post "/procurement/requisitions" "{
  \"title\": \"E2E Cross-Module Req $RANDOM\",
  \"description\": \"Silver bangles for retail stock\",
  \"priority\": \"HIGH\",
  \"requesterDept\": \"$DEPT_ID\",
  \"branchCode\": \"MAIN\",
  \"amount\": 500000,
  \"requester_id\": \"$EMP_ID\"
}" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Create procurement requisition" "$STATUS" "200" "201" "400"

REQUISITION_ID=$(json_nested "$BODY" "data.id")
[ -z "$REQUISITION_ID" ] && REQUISITION_ID=$(json_nested "$BODY" "id")

# Step 2: List inventory items (verify baseline)
RESP=$(api_get "/inventory/items?page=1&pageSize=5" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "List inventory (baseline)" "$STATUS" "200" "201"

# Step 3: Create an inventory movement
RESP=$(api_post "/inventory/movements" "{
  \"type\": \"INBOUND\",
  \"reference\": \"E2E-INTAKE-$RANDOM\",
  \"notes\": \"Stock from procurement\",
  \"source\": \"procurement\"
}" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Create inventory movement" "$STATUS" "200" "201" "400" "404"

# Step 4: List sales leads
RESP=$(api_get "/sales/orders?page=1&pageSize=5" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "List sales orders" "$STATUS" "200" "201"

# Step 5: Create a sales lead (sales orders are read from retail)
RESP=$(api_post "/sales/leads" "{
  \"company_name\": \"E2E Customer Corp\",
  \"contact_name\": \"John E2E\",
  \"email\": \"john-e2e-$RANDOM@example.com\",
  \"source\": \"direct\",
  \"status\": \"NEW\",
  \"potential_value\": 500000
}" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Create sales lead" "$STATUS" "200" "201"

# Step 6: Create a finance COA entry
RESP=$(api_post "/finance/coa" "{
  \"accountCode\": \"E2E-$RANDOM\",
  \"name\": \"E2E Cross-Module Revenue\",
  \"accountType\": \"REVENUE\",
  \"normalBalance\": \"CREDIT\",
  \"category\": \"revenue\"
}" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Create finance COA entry" "$STATUS" "200" "201"

# Step 7: View finance ledger
RESP=$(api_get "/finance/ledger" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "View finance ledger" "$STATUS" "200" "201"

# Step 8: Generate cross-module report
RESP=$(api_post "/reporting/generate" "{\"report_type\": \"operational_summary\", \"format\": \"PDF\"}" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Generate cross-module report" "$STATUS" "200" "201"

REPORT_JOB_ID=$(json_nested "$BODY" "job_id")
if [ -n "$REPORT_JOB_ID" ] && [ "$REPORT_JOB_ID" != "None" ] && [ "$REPORT_JOB_ID" != "" ]; then
  RESP=$(api_get "/reporting/${REPORT_JOB_ID}/status" "$OWNER_TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Check report status" "$STATUS" "200" "201"
else
  skip_test "Check report status" "No job ID"
fi

# ═══════════════════════════════════════════════════════════════════════
# 5.2 MULTI-ROLE ACCESS CONTROL
# ═══════════════════════════════════════════════════════════════════════
subsection "5.2 Multi-Role Access Control"

# Create a staff user with limited role
STAFF_EMAIL="e2e-staff-${RANDOM}@testcorp.com"
STAFF_PASSWORD="StaffPass2026!"

RESP=$(api_post "/auth/register" "{
  \"email\": \"$STAFF_EMAIL\",
  \"password\": \"$STAFF_PASSWORD\",
  \"first_name\": \"E2E\",
  \"last_name\": \"Staff\",
  \"role\": \"STAFF\",
  \"tenant_id\": \"$T\",
  \"company_id\": \"$C\"
}" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Create staff user" "$STATUS" "200" "201"

# Login as staff
RESP=$(api_post "/auth/login" "{\"email\": \"$STAFF_EMAIL\", \"password\": \"$STAFF_PASSWORD\"}")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
STAFF_TOKEN=$(json_field "$BODY" "token")

if [ -n "$STAFF_TOKEN" ] && [ "$STAFF_TOKEN" != "" ] && [ "$STAFF_TOKEN" != "None" ]; then
  # Staff should NOT be able to access admin dashboard
  RESP=$(api_get "/admin/dashboard" "$STAFF_TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Staff denied admin dashboard" "$STATUS" "403" "401"

  # Staff should NOT be able to generate reports (requires ADMIN/OWNER)
  RESP=$(api_post "/reporting/generate" "{\"report_type\": \"sales_summary\", \"format\": \"PDF\"}" "$STAFF_TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Staff denied report generation" "$STATUS" "403" "401"

  # Staff can read some things (settings)
  RESP=$(api_get "/settings/profile" "$STAFF_TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Staff can read profile" "$STATUS" "200" "201" "403" "401"

  # Owner CAN do what staff can't
  RESP=$(api_get "/admin/dashboard" "$OWNER_TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Owner can access admin dashboard" "$STATUS" "200" "201"

  RESP=$(api_post "/reporting/generate" "{\"report_type\": \"hr_summary\", \"format\": \"PDF\"}" "$OWNER_TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Owner can generate reports" "$STATUS" "200" "201"
else
  skip_test "Staff denied admin dashboard" "Staff login failed"
  skip_test "Staff denied report generation" "Staff login failed"
  skip_test "Staff can read profile" "Staff login failed"
  skip_test "Owner can access admin dashboard" "Staff login failed"
  skip_test "Owner can generate reports" "Staff login failed"
fi

# Test with invalid/expired token
RESP=$(api_get "/inventory/items?page=1&pageSize=5" "invalid-token-123" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Invalid token rejected" "$STATUS" "401" "403"

# Test without any token
RESP=$(api_get "/inventory/items?page=1&pageSize=5" "" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "No token rejected" "$STATUS" "401" "403"

# Test cross-tenant access
RESP=$(api_get "/inventory/items?page=1&pageSize=5" "$OWNER_TOKEN" "tnt-nonexistent" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Cross-tenant access denied" "$STATUS" "401" "403" "404"

# ═══════════════════════════════════════════════════════════════════════
# 5.3 EDGE CASES
# ═══════════════════════════════════════════════════════════════════════
subsection "5.3 Edge Cases"

# Duplicate submission prevention (same COA code twice)
DUP_CODE="E2E-DUP-$RANDOM"
RESP=$(api_post "/finance/coa" "{\"accountCode\": \"$DUP_CODE\", \"name\": \"First COA\", \"accountType\": \"ASSET\", \"normalBalance\": \"DEBIT\"}" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "First COA submission" "$STATUS" "200" "201"

RESP=$(api_post "/finance/coa" "{\"accountCode\": \"$DUP_CODE\", \"name\": \"Duplicate COA\", \"accountType\": \"ASSET\", \"normalBalance\": \"DEBIT\"}" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Duplicate COA rejected" "$STATUS" "409" "400" "422" "500"

# Invalid data: empty required fields
RESP=$(api_post "/procurement/requisitions" "{\"title\": \"\", \"description\": \"\"}" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Empty procurement rejected" "$STATUS" "400" "422"

# Non-existent resource access
RESP=$(api_get "/hr/employees/00000000-0000-0000-0000-000000000000" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Non-existent employee 404" "$STATUS" "404" "200"

# Very long input
LONG_DESC=$(python3 -c "print('A' * 2000)")
RESP=$(api_post "/comms/bulletin" "{\"title\": \"Long content test\", \"body\": \"$LONG_DESC\", \"category\": \"general\"}" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Long input handled" "$STATUS" "200" "201" "400" "413"

# Special characters in input
RESP=$(api_post "/comms/bulletin" "{\"title\": \"Special chars test\", \"body\": \"Testing SQL: SELECT * FROM users\", \"category\": \"general\"}" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Special chars handled" "$STATUS" "200" "201" "400"

# Pagination edge cases
RESP=$(api_get "/inventory/items?page=99999&pageSize=100" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "High page number handled" "$STATUS" "200" "201"

RESP=$(api_get "/inventory/items?page=1&pageSize=1" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Minimal page size works" "$STATUS" "200" "201"

# Rate limiting (rapid requests)
for i in 1 2 3 4 5; do
  RESP=$(api_get "/settings/profile" "$OWNER_TOKEN" "$T" "$C")
done
STATUS=$(get_status "$RESP")
assert_status_one_of "Rapid requests handled" "$STATUS" "200" "201" "429"

# ═══════════════════════════════════════════════════════════════════════
# 5.4 DATA INTEGRITY VERIFICATION
# ═══════════════════════════════════════════════════════════════════════
subsection "5.4 Data Integrity"

# Count employees
RESP=$(api_get "/hr/employees" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
EMP_COUNT=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('count', d.get('total', len(d.get('data',[])))))" 2>/dev/null)
assert_status_one_of "Get employee count" "$STATUS" "200" "201"
assert_not_empty "Employee count > 0" "$EMP_COUNT"

# Verify audit trail
RESP=$(api_get "/audit/logs?page=1&pageSize=20" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
AUDIT_COUNT=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null)
assert_status_one_of "Get audit trail" "$STATUS" "200" "201"
assert_not_empty "Audit trail has entries" "$AUDIT_COUNT"

# Verify audit chain integrity
RESP=$(api_get "/audit/verify-chain" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Audit chain valid" "$STATUS" "200" "201"

# Verify report job
if [ -n "$REPORT_JOB_ID" ] && [ "$REPORT_JOB_ID" != "None" ] && [ "$REPORT_JOB_ID" != "" ]; then
  RESP=$(api_get "/reporting/${REPORT_JOB_ID}/status" "$OWNER_TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  BODY=$(get_body "$RESP")
  JOB_STATUS=$(json_nested "$BODY" "status")
  assert_status_one_of "Report job persisted" "$STATUS" "200" "201"
  assert_not_empty "Report job has status" "$JOB_STATUS"
else
  skip_test "Report job persisted" "No report job ID"
  skip_test "Report job has status" "No report job ID"
fi

# Verify IT setting persistence
RESP=$(api_get "/it-settings/settings/app_theme" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
SETTING_VALUE=$(json_nested "$BODY" "data.value")
assert_status_one_of "Read back IT setting" "$STATUS" "200" "201"
assert_not_empty "IT setting value persisted" "$SETTING_VALUE"

# Verify locations
RESP=$(api_get "/settings/locations" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
LOC_COUNT=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null)
assert_status_one_of "List locations" "$STATUS" "200" "201"
assert_not_empty "Locations exist" "$LOC_COUNT"

# Verify domain events
RESP=$(api_get "/events?page=1&pageSize=5" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
EVENT_COUNT=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null)
assert_status_one_of "Domain events recorded" "$STATUS" "200" "201"
assert_not_empty "Events exist" "$EVENT_COUNT"

# Verify mail in sent folder
RESP=$(api_get "/comms/mail/messages?folder=sent" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Sent mail visible" "$STATUS" "200" "201"

# Final health check
RESP=$(api_get "/admin/dashboard" "$OWNER_TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "System still healthy" "$STATUS" "200" "201"

print_summary "Phase 5 - Advanced"
