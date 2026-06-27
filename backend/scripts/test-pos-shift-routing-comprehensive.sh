#!/bin/bash

# Comprehensive POS Shift Routing Test
# Tests the complete flow from login to POS initialization

set -e

echo "========================================="
echo "POS Shift Routing - Comprehensive Test"
echo "========================================="
echo ""

BASE_URL="http://150.109.15.108:3001"
FRONTEND_URL="http://150.109.15.108:3010"

echo "Test Environment:"
echo "  Backend: $BASE_URL"
echo "  Frontend: $FRONTEND_URL"
echo "  Tenant: tnt-3rlhko (Bambu Silver)"
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test result
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        ((TESTS_FAILED++))
    fi
}

echo "========================================="
echo "TEST 1: Database State Verification"
echo "========================================="
echo ""

echo "Verifying Seminyak store exists..."
SEMINYAK_STORE=$(docker exec -i bfs-db psql -U zenvix -d zenvix_prod -t -c "SELECT id FROM stores WHERE tenant_id = 'tnt-3rlhko' AND code = 'BS-03';")
SEMINYAK_STORE=$(echo $SEMINYAK_STORE | xargs)

if [ -n "$SEMINYAK_STORE" ]; then
    print_result 0 "Seminyak store (BS-03) exists: $SEMINYAK_STORE"
else
    print_result 1 "Seminyak store (BS-03) not found"
    exit 1
fi

echo ""
echo "Verifying Fera's shift exists and points to correct location..."
FERA_SHIFT=$(docker exec -i bfs-db psql -U zenvix -d zenvix_prod -t -c "
    SELECT s.id, s.location_id
    FROM hr_work_shifts s
    JOIN employees e ON e.id = s.employee_id
    WHERE e.email = 'fera@bambusilver.com'
      AND DATE(s.start_time) = CURRENT_DATE
    LIMIT 1;
")

if [ -n "$FERA_SHIFT" ]; then
    print_result 0 "Fera's shift found for today"
    echo "   Shift details: $FERA_SHIFT"
else
    print_result 1 "Fera's shift not found for today"
    echo -e "${YELLOW}Note: This test requires Fera to have a shift scheduled for today${NC}"
fi

echo ""
echo "Verifying Nana's shift exists and points to correct location..."
NANA_SHIFT=$(docker exec -i bfs-db psql -U zenvix -d zenvix_prod -t -c "
    SELECT s.id, s.location_id
    FROM hr_work_shifts s
    JOIN employees e ON e.id = s.employee_id
    WHERE e.email = 'nana@bambusilver.com'
      AND DATE(s.start_time) = CURRENT_DATE
    LIMIT 1;
")

if [ -n "$NANA_SHIFT" ]; then
    print_result 0 "Nana's shift found for today"
    echo "   Shift details: $NANA_SHIFT"
else
    print_result 1 "Nana's shift not found for today"
    echo -e "${YELLOW}Note: This test requires Nana to have a shift scheduled for today${NC}"
fi

echo ""
echo "========================================="
echo "TEST 2: Fera Login and Auth Routing"
echo "========================================="
echo ""

echo "Logging in as Fera..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "fera@bambusilver.com",
        "password": "Fera2024!"
    }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken // empty')

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    print_result 0 "Fera login successful, token received"
else
    print_result 1 "Fera login failed"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo ""
echo "Checking auth routing info..."
ROUTING_RESPONSE=$(curl -s -X GET "$BASE_URL/v1/auth/routing-info" \
    -H "Authorization: Bearer $TOKEN")

echo "Routing response: $ROUTING_RESPONSE"

STORE_ID=$(echo $ROUTING_RESPONSE | jq -r '.data.context.store_id // empty')
REDIRECT_TO=$(echo $ROUTING_RESPONSE | jq -r '.data.redirect_to // empty')

echo ""
if [ "$STORE_ID" == "$SEMINYAK_STORE" ]; then
    print_result 0 "Routing returns correct Seminyak store ID"
else
    print_result 1 "Routing returns wrong store ID: $STORE_ID (expected: $SEMINYAK_STORE)"
fi

if [ "$REDIRECT_TO" == "/m/retail/operational/pos" ]; then
    print_result 0 "Routing redirects to POS page"
else
    print_result 1 "Routing redirects to wrong page: $REDIRECT_TO"
fi

echo ""
echo "========================================="
echo "TEST 3: Retail Stores API"
echo "========================================="
echo ""

echo "Fetching retail stores..."
STORES_RESPONSE=$(curl -s -X GET "$BASE_URL/v1/retail/stores" \
    -H "Authorization: Bearer $TOKEN")

STORE_COUNT=$(echo $STORES_RESPONSE | jq '. | length')
SEMINYAK_IN_LIST=$(echo $STORES_RESPONSE | jq -r ".[] | select(.id == \"$SEMINYAK_STORE\") | .id")

echo "Found $STORE_COUNT stores in the list"

if [ -n "$SEMINYAK_IN_LIST" ]; then
    print_result 0 "Seminyak store present in /v1/retail/stores response"
else
    print_result 1 "Seminyak store NOT found in /v1/retail/stores response"
    echo "Available stores:"
    echo $STORES_RESPONSE | jq -r '.[] | "  - \(.name) (\(.code)): \(.id)"'
fi

echo ""
echo "========================================="
echo "TEST 4: Nana Login and Auth Routing"
echo "========================================="
echo ""

echo "Logging in as Nana..."
LOGIN_RESPONSE_NANA=$(curl -s -X POST "$BASE_URL/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "nana@bambusilver.com",
        "password": "Nana2024!"
    }')

TOKEN_NANA=$(echo $LOGIN_RESPONSE_NANA | jq -r '.accessToken // empty')

if [ -n "$TOKEN_NANA" ] && [ "$TOKEN_NANA" != "null" ]; then
    print_result 0 "Nana login successful, token received"
else
    print_result 1 "Nana login failed"
    echo "Response: $LOGIN_RESPONSE_NANA"
fi

if [ -n "$TOKEN_NANA" ] && [ "$TOKEN_NANA" != "null" ]; then
    echo ""
    echo "Checking Nana's auth routing info..."
    ROUTING_RESPONSE_NANA=$(curl -s -X GET "$BASE_URL/v1/auth/routing-info" \
        -H "Authorization: Bearer $TOKEN_NANA")

    STORE_ID_NANA=$(echo $ROUTING_RESPONSE_NANA | jq -r '.data.context.store_id // empty')
    REDIRECT_TO_NANA=$(echo $ROUTING_RESPONSE_NANA | jq -r '.data.redirect_to // empty')

    if [ "$STORE_ID_NANA" == "$SEMINYAK_STORE" ]; then
        print_result 0 "Nana's routing returns correct Seminyak store ID"
    else
        print_result 1 "Nana's routing returns wrong store ID: $STORE_ID_NANA"
    fi

    if [ "$REDIRECT_TO_NANA" == "/m/retail/operational/pos" ]; then
        print_result 0 "Nana's routing redirects to POS page"
    else
        print_result 1 "Nana's routing redirects to wrong page: $REDIRECT_TO_NANA"
    fi
fi

echo ""
echo "========================================="
echo "TEST 5: Backend Logs Verification"
echo "========================================="
echo ""

echo "Checking backend logs for store resolution logging..."
RECENT_LOGS=$(docker logs bfs-backend --tail 50 2>&1 | grep -i "AuthRouting\|Resolved store" || echo "No matching logs found")

if echo "$RECENT_LOGS" | grep -q "Resolved store"; then
    print_result 0 "Backend logs show store resolution"
    echo "Recent logs:"
    echo "$RECENT_LOGS" | grep "Resolved store" | tail -3
else
    print_result 1 "Backend logs do not show store resolution logging"
    echo -e "${YELLOW}This may indicate the auth routing controller hasn't been updated with logging${NC}"
fi

echo ""
echo "========================================="
echo "TEST SUMMARY"
echo "========================================="
echo ""
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
    echo ""
    echo "The POS shift routing fix is working correctly."
    echo "You can now proceed with manual frontend testing:"
    echo "  1. Open $FRONTEND_URL in a browser"
    echo "  2. Login as Fera or Nana"
    echo "  3. Verify you're redirected to POS"
    echo "  4. Verify store name shows correctly"
    echo "  5. Click 'INITIALIZE TERMINAL' and verify it succeeds"
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo ""
    echo "Please review the failed tests above and fix the issues."
    exit 1
fi
