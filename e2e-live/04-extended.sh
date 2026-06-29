#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Phase 4: Extended Module Tests
# Warehouse, IT, Settings, Admin Tools, Reporting, Comms, Security
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
TIMESTAMP=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['timestamp'])")

# Re-login
RESP=$(api_post "/auth/login" "{\"email\": \"$OWNER_EMAIL\", \"password\": \"$OWNER_PASSWORD\"}")
TOKEN=$(json_field "$(get_body "$RESP")" "token")
T="$TENANT_ID"
C="$COMPANY_ID"

section "Phase 4: Extended Module Tests"

# ═══════════════════════════════════════════════════════════════════════
# 4.1 SETTINGS — Profile, preferences, locations
# ═══════════════════════════════════════════════════════════════════════
subsection "4.1 Settings"

RESP=$(api_get "/settings/profile" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Get company profile" "$STATUS" "200" "201"

RESP=$(api_put "/settings/profile" "{\"display_name\": \"E2E TestCorp Updated\", \"timezone\": \"Asia/Makassar\"}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Update company profile" "$STATUS" "200" "201"

RESP=$(api_get "/settings/preferences" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Get preferences" "$STATUS" "200" "201"

RESP=$(api_put "/settings/preferences" "{\"language\": \"id\", \"date_format\": \"DD/MM/YYYY\"}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Update preferences" "$STATUS" "200" "201"

RESP=$(api_get "/settings/roles" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Get roles list" "$STATUS" "200" "201"

RESP=$(api_get "/settings/locations" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Get locations" "$STATUS" "200" "201"

RESP=$(api_post "/settings/locations" "{\"name\": \"E2E Warehouse\", \"code\": \"WH-E2E-${TIMESTAMP}\", \"address\": \"Jl. Industri No.5\", \"type\": \"warehouse\"}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Create location" "$STATUS" "200" "201"

# ═══════════════════════════════════════════════════════════════════════
# 4.2 ADMIN TOOLS — Dashboard, audit, events, requests
# ═══════════════════════════════════════════════════════════════════════
subsection "4.2 Admin Tools"

RESP=$(api_get "/admin/dashboard" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Admin dashboard" "$STATUS" "200" "201"

RESP=$(api_get "/admin/dashboard/tactical" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Admin tactical dashboard" "$STATUS" "200" "201"

RESP=$(api_get "/admin/modules" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "List modules" "$STATUS" "200" "201"

RESP=$(api_get "/admin/audit-events" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Get audit events" "$STATUS" "200" "201"

RESP=$(api_get "/admin/audit/integrity-status" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Audit integrity status" "$STATUS" "200" "201"

RESP=$(api_get "/admin/sync/status" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Admin sync status" "$STATUS" "200" "201"

RESP=$(api_get "/admin/iot/devices" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Admin IoT devices" "$STATUS" "200" "201"

RESP=$(api_post "/admin/requests" "{\"type\": \"access\", \"title\": \"E2E Test Request\", \"detail\": \"Requesting access to analytics module\"}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Create admin request" "$STATUS" "200" "201"

REQ_ID=$(json_nested "$BODY" "data.id")
[ -z "$REQ_ID" ] && REQ_ID=$(json_nested "$BODY" "id")

if [ -n "$REQ_ID" ] && [ "$REQ_ID" != "None" ] && [ "$REQ_ID" != "" ]; then
  RESP=$(api_put "/admin/requests/${REQ_ID}/resolve" "{\"resolvedBy\": \"system\"}" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Resolve admin request" "$STATUS" "200" "201"
else
  skip_test "Resolve admin request" "No request ID"
fi

# ═══════════════════════════════════════════════════════════════════════
# 4.3 IT MODULE — Devices, provisioning, monitoring
# ═══════════════════════════════════════════════════════════════════════
subsection "4.3 IT Module"

RESP=$(api_get "/it/overview" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "IT overview" "$STATUS" "200" "201"

RESP=$(api_get "/it/devices" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "IT devices list" "$STATUS" "200" "201"

RESP=$(api_post "/it/devices" "{\"name\": \"E2E POS Terminal\", \"type\": \"POS_TERMINAL\", \"connection\": \"LAN\"}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Create IT device" "$STATUS" "200" "201"

RESP=$(api_get "/it/provisioning" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "List provisioning requests" "$STATUS" "200" "201"

RESP=$(api_post "/it/provisioning" "{\"scope\": \"full_portal\", \"reason\": \"E2E test provisioning request\"}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Create provisioning request" "$STATUS" "200" "201"

RESP=$(api_get "/it/system-health" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "IT system health" "$STATUS" "200" "201"

RESP=$(api_get "/it/topology" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "IT topology" "$STATUS" "200" "201"

RESP=$(api_get "/it/monitoring/stats" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "IT monitoring stats" "$STATUS" "200" "201"

# ═══════════════════════════════════════════════════════════════════════
# 4.4 WAREHOUSE — Bins and stock
# ═══════════════════════════════════════════════════════════════════════
subsection "4.4 Warehouse"

RESP=$(api_get "/warehouse/bins?locationId=placeholder&page=1&pageSize=20" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "List warehouse bins" "$STATUS" "200" "201"

RESP=$(api_post "/warehouse/bins?locationId=placeholder" "{\"name\": \"Bin A1\", \"code\": \"BIN-A1-${TIMESTAMP}\", \"zone\": \"receiving\"}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Create warehouse bin" "$STATUS" "200" "201"

# ═══════════════════════════════════════════════════════════════════════
# 4.5 COMMS — Bulletin, Mail, Chat, Notifications
# ═══════════════════════════════════════════════════════════════════════
subsection "4.5 Communications"

# Bulletin
RESP=$(api_get "/comms/bulletin?page=1&pageSize=10" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "List bulletins" "$STATUS" "200" "201"

RESP=$(api_post "/comms/bulletin" "{\"title\": \"E2E Announcement\", \"body\": \"This is a test announcement from E2E suite\", \"category\": \"general\"}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Create bulletin post" "$STATUS" "200" "201"

BULLETIN_ID=$(json_nested "$BODY" "data.id")
[ -z "$BULLETIN_ID" ] && BULLETIN_ID=$(json_nested "$BODY" "id")

if [ -n "$BULLETIN_ID" ] && [ "$BULLETIN_ID" != "None" ] && [ "$BULLETIN_ID" != "" ]; then
  RESP=$(api_post "/comms/bulletin/${BULLETIN_ID}/react" "{\"type\": \"LIKE\"}" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "React to bulletin" "$STATUS" "200" "201"

  RESP=$(api_post "/comms/bulletin/${BULLETIN_ID}/comment" "{\"body\": \"E2E test comment\"}" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Comment on bulletin" "$STATUS" "200" "201"
else
  skip_test "React to bulletin" "No bulletin ID"
  skip_test "Comment on bulletin" "No bulletin ID"
fi

# Mail
RESP=$(api_get "/comms/mail/messages?folder=inbox" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "List mail messages" "$STATUS" "200" "201"

RESP=$(api_post "/comms/mail/send" "{\"to\": \"test@example.com\", \"subject\": \"E2E Test Email\", \"body\": \"Hello from E2E test suite\"}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Send mail" "$STATUS" "200" "201"

# Chat
RESP=$(api_get "/comms/chat/rooms" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "List chat rooms" "$STATUS" "200" "201"

RESP=$(api_post "/comms/chat/rooms" "{\"name\": \"E2E Test Room\"}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Create chat room" "$STATUS" "200" "201"

# Notifications
RESP=$(api_get "/comms/notifications?page=1&pageSize=10" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "List notifications" "$STATUS" "200" "201"

RESP=$(api_get "/comms/notifications/counts" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Get unread counts" "$STATUS" "200" "201"

RESP=$(api_post "/comms/notifications/read-all" "{}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Mark all notifications read" "$STATUS" "200" "201"

# ═══════════════════════════════════════════════════════════════════════
# 4.6 REPORTING — Generate and check status
# ═══════════════════════════════════════════════════════════════════════
subsection "4.6 Reporting & Exports"

RESP=$(api_get "/reporting/archives" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Get report archives" "$STATUS" "200" "201"

RESP=$(api_post "/reporting/generate" "{\"report_type\": \"sales_summary\", \"format\": \"PDF\"}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Generate report" "$STATUS" "200" "201"

JOB_ID=$(json_nested "$BODY" "job_id")
if [ -n "$JOB_ID" ] && [ "$JOB_ID" != "None" ] && [ "$JOB_ID" != "" ]; then
  RESP=$(api_get "/reporting/${JOB_ID}/status" "$TOKEN" "$T" "$C")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Check report status" "$STATUS" "200" "201"
else
  skip_test "Check report status" "No job ID"
fi

# Inventory export
RESP=$(api_post "/retail/inventory/export" "{\"format\": \"csv\"}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Queue inventory export" "$STATUS" "200" "201"

# HR export
RESP=$(api_get "/hr/employees/export" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "HR employees export" "$STATUS" "200" "201" "204"

# ═══════════════════════════════════════════════════════════════════════
# 4.7 AUDIT & SECURITY
# ═══════════════════════════════════════════════════════════════════════
subsection "4.7 Audit & Security"

RESP=$(api_get "/audit/logs?page=1&pageSize=10" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Query audit logs" "$STATUS" "200" "201"

RESP=$(api_get "/audit/verify-chain" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Verify audit chain" "$STATUS" "200" "201"

RESP=$(api_get "/audit/anchors/public?page=1&pageSize=10" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Get public anchors" "$STATUS" "200" "201"

# ═══════════════════════════════════════════════════════════════════════
# 4.8 EVENTS — Domain events inspection
# ═══════════════════════════════════════════════════════════════════════
subsection "4.8 Events"

RESP=$(api_get "/events?page=1&pageSize=10" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "List domain events" "$STATUS" "200" "201"

RESP=$(api_get "/events/failed?page=1&pageSize=10" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "List failed events" "$STATUS" "200" "201"

# ═══════════════════════════════════════════════════════════════════════
# 4.9 WORKFLOW
# ═══════════════════════════════════════════════════════════════════════
subsection "4.9 Workflow"

RESP=$(api_get "/workflow/test-routing" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Workflow routing test" "$STATUS" "200" "201"

RESP=$(api_get "/workflow/list?page=1&pageSize=10" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "List workflow requests" "$STATUS" "200" "201"

# ═══════════════════════════════════════════════════════════════════════
# 4.10 PRICING
# ═══════════════════════════════════════════════════════════════════════
subsection "4.10 Pricing"

RESP=$(api_get "/pricing/quote?skuId=test-sku&location_id=test-loc" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Get pricing quote" "$STATUS" "200" "201" "404"

# ═══════════════════════════════════════════════════════════════════════
# 4.11 IT-SETTINGS
# ═══════════════════════════════════════════════════════════════════════
subsection "4.11 IT Settings"

RESP=$(api_get "/it-settings/settings" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "List IT settings" "$STATUS" "200" "201"

RESP=$(api_put "/it-settings/settings/app_theme" "{\"value\": \"dark\", \"category\": \"general\"}" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "Update IT setting" "$STATUS" "200" "201"

RESP=$(api_get "/it-settings/devices" "$TOKEN" "$T" "$C")
STATUS=$(get_status "$RESP")
assert_status_one_of "List IT-settings devices" "$STATUS" "200" "201"

print_summary "Phase 4 - Extended"
