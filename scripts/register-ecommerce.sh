#!/bin/bash
# Register headless ecommerce storefront under tnt-3rlhko (Bambu Silver)
set -e

BASE="http://localhost:3001/v1"
TOKEN=$(cat /tmp/zenvix_token.txt)
TENANT="tnt-3rlhko"

# Anchor location for the ecommerce branch (using Seminyak as primary/flagship)
ANCHOR_LOCATION="a3a241a4-4841-45a3-90cd-f7135e6847b4"

echo "Using tenant: $TENANT"
echo "Token: ${TOKEN:0:30}..."

# ═══════════════════════════════════════════════════════════
# Step 1: Register E-Commerce as Virtual Branch
# ═══════════════════════════════════════════════════════════
echo ""
echo "=== Step 1: Registering E-Commerce Virtual Branch ==="

cat > /tmp/register_branch.json <<EOF
{
  "name": "Bambu Silver Online Store",
  "type": "ecommerce",
  "location_id": "$ANCHOR_LOCATION",
  "platform": "custom",
  "domain": "150.109.15.108:3020",
  "status": "active",
  "channel": {
    "name": "Bambu Silver Headless Storefront",
    "type": "OWNED",
    "sync_frequency": "realtime",
    "integration_category": "HEADLESS"
  }
}
EOF

REGISTER_RESULT=$(curl -s -X POST "$BASE/retail/ecommerce-hub/register-branch" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" \
  -H "Content-Type: application/json" \
  -d @/tmp/register_branch.json)

echo "Register result:"
echo "$REGISTER_RESULT" | python3 -m json.tool 2>/dev/null || echo "$REGISTER_RESULT"

# ═══════════════════════════════════════════════════════════
# Step 2: Create a HEADLESS Channel with Client Credentials
# ═══════════════════════════════════════════════════════════
echo ""
echo "=== Step 2: Creating HEADLESS Channel ==="

cat > /tmp/create_channel.json <<'EOF'
{
  "name": "Bambu Silver Online Shop",
  "type": "HEADLESS",
  "adapterType": "CUSTOM",
  "syncFrequency": "realtime",
  "integrationCategory": "HEADLESS",
  "settings": {
    "domain": "150.109.15.108:3020",
    "platform": "custom",
    "description": "Main headless ecommerce storefront for Bambu Silver jewelry"
  }
}
EOF

CHANNEL_RESULT=$(curl -s -X POST "$BASE/retail/ecommerce-hub/channels" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" \
  -H "Content-Type: application/json" \
  -d @/tmp/create_channel.json)

echo "Channel creation result:"
echo "$CHANNEL_RESULT" | python3 -m json.tool 2>/dev/null || echo "$CHANNEL_RESULT"

# Extract credentials
CHANNEL_ID=$(echo "$CHANNEL_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); data=d.get('data',d); print(data.get('channel',{}).get('id',''))" 2>/dev/null)
CLIENT_ID=$(echo "$CHANNEL_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); data=d.get('data',d); print(data.get('plainClientId',''))" 2>/dev/null)
CLIENT_SECRET=$(echo "$CHANNEL_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); data=d.get('data',d); print(data.get('plainClientSecret',''))" 2>/dev/null)

# ═══════════════════════════════════════════════════════════
# Step 3: Create Ecommerce Connector (API Key for events)
# ═══════════════════════════════════════════════════════════
echo ""
echo "=== Step 3: Creating Ecommerce Connector (API Key) ==="

# Use Seminyak store as the linked branch
STORE_ID="f6ec35ea-b90c-46cf-ad39-4429f7d48c6e"

cat > /tmp/create_connector.json <<EOF
{
  "name": "Bambu Silver Online Gateway",
  "platform": "custom",
  "domain": "150.109.15.108:3020",
  "branchIds": ["$STORE_ID"],
  "settings": {
    "description": "Headless storefront event gateway for order syncing and inventory"
  }
}
EOF

CONNECTOR_RESULT=$(curl -s -X POST "$BASE/retail/ecommerce-hub/connectors" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" \
  -H "Content-Type: application/json" \
  -d @/tmp/create_connector.json)

echo "Connector creation result:"
echo "$CONNECTOR_RESULT" | python3 -m json.tool 2>/dev/null || echo "$CONNECTOR_RESULT"

API_KEY=$(echo "$CONNECTOR_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); data=d.get('data',d); print(data.get('plainApiKey',''))" 2>/dev/null)

# ═══════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  HEADLESS ECOMMERCE CREDENTIALS FOR tnt-3rlhko              ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Channel ID:     $CHANNEL_ID"
echo "║  Client ID:      $CLIENT_ID"
echo "║  Client Secret:  $CLIENT_SECRET"
echo "║  API Key:        $API_KEY"
echo "║  Tenant:         $TENANT"
echo "║  Branch ID:      $STORE_ID"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  .env for storefront:                                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "VITE_ZENVIX_API_URL=http://150.109.15.108:3001/v1/retail/public"
echo "VITE_ZENVIX_TENANT_ID=$TENANT"
echo "VITE_ZENVIX_CLIENT_ID=$CLIENT_ID"
echo "VITE_ZENVIX_CLIENT_SECRET=$CLIENT_SECRET"
echo "VITE_ZENVIX_API_KEY=$API_KEY"
echo "VITE_ZENVIX_CHANNEL_RECORD_ID=$CHANNEL_ID"
echo "VITE_ZENVIX_BRANCH_ID=$STORE_ID"

# Save credentials
cat > /tmp/ecommerce_credentials.txt <<CREDS
CHANNEL_ID=$CHANNEL_ID
CLIENT_ID=$CLIENT_ID
CLIENT_SECRET=$CLIENT_SECRET
API_KEY=$API_KEY
TENANT=$TENANT
STORE_ID=$STORE_ID
CREDS

echo ""
echo "=== DONE. Credentials saved to /tmp/ecommerce_credentials.txt ==="
