#!/bin/bash

# Test Nana's complete shift flow after location guard fix
# Run from backend directory

API_URL="http://150.109.15.108:3001/v1"
EMAIL="nana@bambusilver.com"
PASSWORD="Nana2024!"
TENANT_ID="tnt-3rlhko"

echo "=== STEP 1: LOGIN AS NANA ==="
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

echo "$LOGIN_RESPONSE" | jq '.'

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
echo "Token: $TOKEN"

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  exit 1
fi

echo ""
echo "=== STEP 2: GET ROUTING INFO ==="
ROUTING_RESPONSE=$(curl -s -X GET "$API_URL/auth/routing-info" \
  -H "Authorization: Bearer $TOKEN")

echo "$ROUTING_RESPONSE" | jq '.'

STORE_ID=$(echo "$ROUTING_RESPONSE" | jq -r '.data.context.store_id')
LOCATION_ID=$(echo "$ROUTING_RESPONSE" | jq -r '.data.context.location_id')

echo "Store ID: $STORE_ID"
echo "Location ID: $LOCATION_ID"

echo ""
echo "=== STEP 3: OPEN SHIFT ==="
OPEN_SHIFT_RESPONSE=$(curl -s -X POST "$API_URL/retail/shifts/open" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-location-id: $LOCATION_ID" \
  -H "Content-Type: application/json" \
  -d "{\"store_id\":\"$STORE_ID\",\"opening_cash\":500000,\"terminal_id\":\"TERMINAL-01\"}")

echo "$OPEN_SHIFT_RESPONSE" | jq '.'

SHIFT_ID=$(echo "$OPEN_SHIFT_RESPONSE" | jq -r '.data.id')
echo "Shift ID: $SHIFT_ID"

if [ "$SHIFT_ID" == "null" ] || [ -z "$SHIFT_ID" ]; then
  echo "❌ Failed to open shift"
  exit 1
fi

echo ""
echo "=== STEP 4: CLOSE SHIFT ==="
CLOSE_SHIFT_RESPONSE=$(curl -s -X PUT "$API_URL/retail/shifts/$SHIFT_ID/close" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-location-id: $LOCATION_ID" \
  -H "Content-Type: application/json" \
  -d "{\"closing_cash\":500000,\"notes\":\"Test shift close after location guard fix\"}")

echo "$CLOSE_SHIFT_RESPONSE" | jq '.'

STATUS=$(echo "$CLOSE_SHIFT_RESPONSE" | jq -r '.data.status')

if [ "$STATUS" == "closed" ]; then
  echo ""
  echo "✅ SUCCESS: Shift closed successfully!"
  echo "✅ Location guard fix is working correctly"
else
  echo ""
  echo "❌ FAILED: Could not close shift"
  echo "Response: $CLOSE_SHIFT_RESPONSE"
  exit 1
fi
