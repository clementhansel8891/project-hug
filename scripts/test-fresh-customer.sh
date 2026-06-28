#!/bin/bash
# Test with a fresh customer to verify the full flow
set -e

TENANT="tnt-3rlhko"
CLIENT_ID="znx_chid_3c3ac6a1cbedf73d0e2dfe5a0d894691"
CLIENT_SECRET="znx_chcs_01dcd533cfe1300ba5d0f464cdead4f08d7e94bc1f3e4452fb266870130f5a24"
API_KEY="znx_ec_gw_9559c038036784e3a01344686f9f770381c12a719d635dac4a91476b0f96f78f"
BASE="http://localhost:3001/v1"

TIMESTAMP=$(date +%s)
TEST_EMAIL="customer-${TIMESTAMP}@bambusilver.com"

echo "=== FRESH CUSTOMER TEST ==="
echo "Email: $TEST_EMAIL"

# 1. Register
echo ""
echo "--- Register ---"
REG=$(curl -s -X POST "$BASE/retail/public/auth/register" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT" \
  -H "x-client-id: $CLIENT_ID" \
  -H "x-client-secret: $CLIENT_SECRET" \
  -d "{\"name\":\"Fresh Test Customer\",\"email\":\"$TEST_EMAIL\",\"password\":\"SecurePass2024!\",\"phone\":\"+62899${TIMESTAMP:0:7}\"}")
echo "$REG" | python3 -m json.tool 2>/dev/null || echo "$REG"

# Extract token
ACCESS_TOKEN=$(echo "$REG" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',''))" 2>/dev/null)

# 2. Login
echo ""
echo "--- Login ---"
LOGIN=$(curl -s -X POST "$BASE/retail/public/auth/login" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT" \
  -H "x-client-id: $CLIENT_ID" \
  -H "x-client-secret: $CLIENT_SECRET" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"SecurePass2024!\"}")
echo "$LOGIN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('accessToken'):
    print(f'  ✅ Login OK — token: {d[\"accessToken\"][:30]}...')
elif d.get('customer'):
    print(f'  ✅ Login OK — customer: {d[\"customer\"].get(\"name\",\"\")}')
else:
    print(f'  ❌ {json.dumps(d)[:200]}')
" 2>/dev/null || echo "$LOGIN"

# Use login token if reg token failed
LOGIN_TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',''))" 2>/dev/null)
TOKEN="${ACCESS_TOKEN:-$LOGIN_TOKEN}"

if [ -z "$TOKEN" ] || [ "$TOKEN" == "" ]; then
  echo "  No token available. Cannot test cart/wishlist/orders."
  exit 0
fi

# 3. Get products and pick first one with stock
echo ""
echo "--- Products ---"
PRODUCTS=$(curl -s "$BASE/retail/public/products" \
  -H "x-tenant-id: $TENANT" \
  -H "x-client-id: $CLIENT_ID" \
  -H "x-client-secret: $CLIENT_SECRET")
FIRST_ID=$(echo "$PRODUCTS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if isinstance(d,list) and len(d)>0 else '')" 2>/dev/null)
FIRST_SKU=$(echo "$PRODUCTS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['sku'] if isinstance(d,list) and len(d)>0 else '')" 2>/dev/null)
echo "  First product: $FIRST_SKU ($FIRST_ID)"

# 4. Add to Cart
echo ""
echo "--- Add to Cart ---"
CART=$(curl -s -X POST "$BASE/retail/public/cart/items" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"product_id\":\"$FIRST_ID\",\"quantity\":2}")
echo "$CART" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if 'items' in d:
    print(f'  ✅ Cart: {len(d[\"items\"])} items')
    for i in d['items'][:3]:
        print(f'    • {i.get(\"name\",i.get(\"product_id\",\"\"))} qty={i.get(\"quantity\",\"\")}')
else:
    print(f'  Result: {json.dumps(d)[:200]}')
" 2>/dev/null || echo "$CART"

# 5. Add to Wishlist
echo ""
echo "--- Add to Wishlist ---"
WISH=$(curl -s -X POST "$BASE/retail/public/wishlist/items" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"product_id\":\"$FIRST_ID\"}")
echo "$WISH" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if 'items' in d:
    print(f'  ✅ Wishlist: {len(d[\"items\"])} items')
else:
    print(f'  Result: {json.dumps(d)[:200]}')
" 2>/dev/null || echo "$WISH"

# 6. Place Order
echo ""
echo "--- Place Order ---"
ORDER=$(curl -s -X POST "$BASE/retail/public/orders" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT" \
  -H "x-client-id: $CLIENT_ID" \
  -H "x-client-secret: $CLIENT_SECRET" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"items\":[{\"sku\":\"$FIRST_SKU\",\"quantity\":1}],\"payment_method\":\"card\",\"payment_status\":\"PAID\",\"customer\":{\"email\":\"$TEST_EMAIL\",\"name\":\"Fresh Test Customer\"}}")
echo "$ORDER" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('order_id'):
    print(f'  ✅ Order created: {d[\"order_id\"]} | Status: {d.get(\"status\",\"\")}')
else:
    print(f'  Result: {json.dumps(d)[:300]}')
" 2>/dev/null || echo "$ORDER"

# 7. Verify customer visible in admin
echo ""
echo "--- Admin: Customers ---"
ADMIN_TOKEN=$(cat /tmp/zenvix_token.txt 2>/dev/null)
if [ -n "$ADMIN_TOKEN" ]; then
  CUSTS=$(curl -s "$BASE/retail/customers" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "x-tenant-id: $TENANT")
  echo "$CUSTS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data = d.get('data', d) if isinstance(d, dict) else d
if isinstance(data, list):
    print(f'  Total customers: {len(data)}')
    for c in data[:5]:
        print(f'    • {c.get(\"name\",\"\")} | {c.get(\"email\",\"\")}')
else:
    print(f'  {json.dumps(d)[:200]}')
" 2>/dev/null || echo "$CUSTS"
fi

echo ""
echo "=== DONE ==="
