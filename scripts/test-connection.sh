#!/bin/bash
# Test the connection between the headless storefront and Zenvix backend
set -e

TENANT="tnt-3rlhko"
CLIENT_ID="znx_chid_3c3ac6a1cbedf73d0e2dfe5a0d894691"
CLIENT_SECRET="znx_chcs_01dcd533cfe1300ba5d0f464cdead4f08d7e94bc1f3e4452fb266870130f5a24"
API_KEY="znx_ec_gw_9559c038036784e3a01344686f9f770381c12a719d635dac4a91476b0f96f78f"
BRANCH_ID="f6ec35ea-b90c-46cf-ad39-4429f7d48c6e"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  TESTING HEADLESS ECOMMERCE ↔ ZENVIX CONNECTION             ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# Test 1: Storefront is alive
echo ""
echo "=== Test 1: Storefront alive (port 3020) ==="
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3020/)
if [ "$HTTP" == "200" ]; then
  echo "✅ PASS — HTTP 200"
else
  echo "❌ FAIL — HTTP $HTTP"
fi

# Test 2: Backend health
echo ""
echo "=== Test 2: Backend alive (port 3001) ==="
HEALTH=$(curl -s http://localhost:3001/ | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null)
if [ "$HEALTH" == "ok" ]; then
  echo "✅ PASS — Backend OK"
else
  echo "❌ FAIL — Backend unhealthy"
fi

# Test 3: Products endpoint (GET /retail/public/products)
echo ""
echo "=== Test 3: GET /retail/public/products ==="
PRODUCTS=$(curl -s http://localhost:3001/v1/retail/public/products \
  -H "x-tenant-id: $TENANT" \
  -H "x-client-id: $CLIENT_ID" \
  -H "x-client-secret: $CLIENT_SECRET")
echo "$PRODUCTS" | python3 -c "
import sys,json
data = json.load(sys.stdin)
if isinstance(data, list):
    print(f'✅ PASS — Got {len(data)} products')
    for p in data[:3]:
        print(f\"   • {p.get('name','')} | SKU: {p.get('sku','')} | Price: {p.get('base_price','')}\")
elif isinstance(data, dict) and data.get('success'):
    items = data.get('data', data.get('products', []))
    print(f'✅ PASS — Got {len(items)} products')
else:
    status = data.get('status','')
    detail = data.get('detail','')
    if status and int(status) >= 400:
        print(f'❌ FAIL — {status}: {detail}')
    else:
        print(f'⚠️  Response: {json.dumps(data)[:200]}')
" 2>/dev/null || echo "Parse error: $PRODUCTS"

# Test 4: Events endpoint (API key based)
echo ""
echo "=== Test 4: POST /retail/events (API Key) ==="
EVENT_RESULT=$(curl -s -X POST http://localhost:3001/v1/retail/events \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT" \
  -H "x-api-key: $API_KEY" \
  -d '{"type":"connection.test","timestamp":"2026-06-28T04:00:00.000Z","actor":{"id":"test-script","type":"system"},"payload":{}}')
echo "$EVENT_RESULT" | python3 -c "
import sys,json
data = json.load(sys.stdin)
if data.get('success'):
    print(f'✅ PASS — Event accepted: {data}')
else:
    print(f'❌ FAIL — {data.get(\"status\",\"\")}: {data.get(\"detail\",json.dumps(data)[:100])}')
" 2>/dev/null || echo "Result: $EVENT_RESULT"

# Test 5: Events via channel credentials (x-client-id/x-client-secret)
echo ""
echo "=== Test 5: POST /retail/events (Channel Credentials) ==="
AUTH_RESULT=$(curl -s -X POST http://localhost:3001/v1/retail/events \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT" \
  -H "x-client-id: $CLIENT_ID" \
  -H "x-client-secret: $CLIENT_SECRET" \
  -d '{"type":"session.start","timestamp":"2026-06-28T04:00:00.000Z","actor":{"id":"storefront-v1","type":"user"},"payload":{"source":"connection_test"}}')
echo "$AUTH_RESULT" | python3 -c "
import sys,json
data = json.load(sys.stdin)
if data.get('success'):
    print(f'✅ PASS — Event accepted via channel auth')
else:
    print(f'❌ FAIL — {data.get(\"status\",\"\")}: {data.get(\"detail\",json.dumps(data)[:100])}')
" 2>/dev/null || echo "Result: $AUTH_RESULT"

# Test 6: Categories
echo ""
echo "=== Test 6: GET /retail/public/categories ==="
CATS=$(curl -s http://localhost:3001/v1/retail/public/categories \
  -H "x-tenant-id: $TENANT" \
  -H "x-client-id: $CLIENT_ID" \
  -H "x-client-secret: $CLIENT_SECRET")
echo "$CATS" | python3 -c "
import sys,json
data = json.load(sys.stdin)
if isinstance(data, list):
    print(f'✅ PASS — Got {len(data)} categories')
elif isinstance(data, dict) and not data.get('status'):
    print(f'✅ PASS — Categories: {json.dumps(data)[:200]}')
else:
    print(f'⚠️  {data.get(\"status\",\"\")}: {data.get(\"detail\",json.dumps(data)[:100])}')
" 2>/dev/null || echo "Result: $CATS"

# Test 7: Public events endpoint (retail/public/events)
echo ""
echo "=== Test 7: POST /retail/public/events (Public Gateway) ==="
PUB_EVENT=$(curl -s -X POST http://localhost:3001/v1/retail/public/events \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT" \
  -H "x-client-id: $CLIENT_ID" \
  -H "x-client-secret: $CLIENT_SECRET" \
  -d '{"type":"page.view","timestamp":"2026-06-28T04:00:00.000Z","actor":{"id":"visitor-1","type":"user"},"payload":{"url":"/","title":"Home"}}')
echo "$PUB_EVENT" | python3 -c "
import sys,json
data = json.load(sys.stdin)
if data.get('success'):
    print(f'✅ PASS — Public event logged')
else:
    print(f'Result: {json.dumps(data)[:200]}')
" 2>/dev/null || echo "Result: $PUB_EVENT"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  CONNECTION TEST COMPLETE                                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
