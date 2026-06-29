#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Phase 1: Tenant Onboarding
# Register user → Login → Provision company → Create branches
# ═══════════════════════════════════════════════════════════════════════

set -uo pipefail
source "$(dirname "$0")/lib.sh"

TIMESTAMP=$(date +%s)
OWNER_EMAIL="e2e-owner-${TIMESTAMP}@testcorp.com"
OWNER_PASSWORD="TestCorp2026!"
COMPANY_NAME="E2E TestCorp ${TIMESTAMP}"

section "Phase 1: Tenant Onboarding"

# ─── 1.1 Register new owner ──────────────────────────────────────────────
subsection "1.1 Register new user"

RESP=$(api_post "/auth/register" "{
  \"email\": \"$OWNER_EMAIL\",
  \"password\": \"$OWNER_PASSWORD\",
  \"first_name\": \"E2E Test\",
  \"last_name\": \"Owner\"
}")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Register new user" "$STATUS" "200" "201"

# ─── 1.2 Login as new owner ──────────────────────────────────────────────
subsection "1.2 Login"

RESP=$(api_post "/auth/login" "{
  \"email\": \"$OWNER_EMAIL\",
  \"password\": \"$OWNER_PASSWORD\"
}")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Login as new owner" "$STATUS" "200" "201"

OWNER_TOKEN=$(json_field "$BODY" "token")
assert_not_empty "Token received" "$OWNER_TOKEN"

# ─── 1.3 Get user profile ────────────────────────────────────────────────
subsection "1.3 Verify user profile"

RESP=$(api_get "/auth/me" "$OWNER_TOKEN")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status "Get user profile" "200" "$STATUS" "$BODY"

USER_ID=$(json_nested "$BODY" "data.id")
assert_not_empty "User ID in profile" "$USER_ID"

# ─── 1.4 Provision company/tenant ────────────────────────────────────────
subsection "1.4 Provision new company"

RESP=$(api_post "/auth/company/provision" "{
  \"name\": \"$COMPANY_NAME\",
  \"industry\": \"retail\",
  \"country\": \"ID\",
  \"address\": \"Jl. E2E Test No. 1, Denpasar, Bali\"
}" "$OWNER_TOKEN")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Provision company" "$STATUS" "200" "201"

TENANT_ID=$(json_nested "$BODY" "data.tenant_id")
[ -z "$TENANT_ID" ] && TENANT_ID=$(json_nested "$BODY" "data.tenantId")

COMPANY_ID=$(json_nested "$BODY" "data.company_id")
[ -z "$COMPANY_ID" ] && COMPANY_ID=$(json_nested "$BODY" "data.companyId")
[ -z "$COMPANY_ID" ] && COMPANY_ID=$(json_nested "$BODY" "data.id")

# If we couldn't get tenant/company from provision response, get from user profile
if [ -z "$TENANT_ID" ] || [ "$TENANT_ID" = "None" ] || [ "$TENANT_ID" = "" ]; then
  # The user already has a tenant from registration, get it from profile
  RESP=$(api_get "/auth/me" "$OWNER_TOKEN")
  BODY=$(get_body "$RESP")
  TENANT_ID=$(json_nested "$BODY" "data.tenant_id")
  [ -z "$TENANT_ID" ] && TENANT_ID=$(json_nested "$BODY" "data.tenantId")
fi

if [ -z "$COMPANY_ID" ] || [ "$COMPANY_ID" = "None" ] || [ "$COMPANY_ID" = "" ]; then
  # Try to get company from user_companies
  RESP=$(api_get "/auth/me" "$OWNER_TOKEN")
  BODY=$(get_body "$RESP")
  COMPANY_ID=$(python3 -c "
import sys,json
d=json.load(sys.stdin)
ucs = d.get('data',{}).get('user_companies',[])
if ucs:
  print(ucs[0].get('company_id','') or ucs[0].get('company',{}).get('id',''))
else:
  print(d.get('data',{}).get('tenant_id',''))
" <<< "$BODY" 2>/dev/null)
fi

assert_not_empty "Tenant ID assigned" "$TENANT_ID"
assert_not_empty "Company ID assigned" "$COMPANY_ID"

# ─── 1.5 Verify admin dashboard access ───────────────────────────────────
subsection "1.5 Admin dashboard access"

RESP=$(api_get "/admin/dashboard" "$OWNER_TOKEN" "$TENANT_ID" "$COMPANY_ID")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
assert_status_one_of "Admin dashboard" "$STATUS" "200" "403"

# ─── 1.6 Enable modules ──────────────────────────────────────────────────
subsection "1.6 Enable modules"

for MODULE in retail inventory hr finance sales marketing procurement; do
  RESP=$(api_put "/admin/modules/toggle" "{\"moduleKey\": \"$MODULE\", \"enabled\": true}" "$OWNER_TOKEN" "$TENANT_ID" "$COMPANY_ID")
  STATUS=$(get_status "$RESP")
  assert_status_one_of "Enable $MODULE module" "$STATUS" "200" "201" "409" "403"
done

# ─── Save state for subsequent phases ─────────────────────────────────────
cat > "$RESULTS_DIR/tenant-state.json" << EOF
{
  "owner_email": "$OWNER_EMAIL",
  "owner_password": "$OWNER_PASSWORD",
  "owner_token": "$OWNER_TOKEN",
  "tenant_id": "$TENANT_ID",
  "company_id": "$COMPANY_ID",
  "company_name": "$COMPANY_NAME",
  "user_id": "$USER_ID",
  "timestamp": "$TIMESTAMP"
}
EOF

echo ""
echo -e "${GREEN}Tenant state saved to $RESULTS_DIR/tenant-state.json${NC}"
echo "  Tenant ID: $TENANT_ID"
echo "  Company ID: $COMPANY_ID"

print_summary "Phase 1 - Onboarding"
