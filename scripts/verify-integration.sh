#!/bin/bash
# Full integration verification: ecommerce <> Zenvix core modules
set -e

TENANT="tnt-3rlhko"
CLIENT_ID="znx_chid_3c3ac6a1cbedf73d0e2dfe5a0d894691"
CLIENT_SECRET="znx_chcs_01dcd533cfe1300ba5d0f464cdead4f08d7e94bc1f3e4452fb266870130f5a24"
API_KEY="znx_ec_gw_9559c038036784e3a01344686f9f770381c12a719d635dac4a91476b0f96f78f"
BASE="http://localhost:3001/v1"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  FULL INTEGRATION VERIFICATION                               ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# 1. Products available to ecommerce
echo ""
echo "=== 1. INVENTORY → ECOMMERCE (Products Exposed) ==="
PRODUCTS=$(curl -s "$BASE/retail/public/products" \
  -H "x-tenant-id: $TENANT" \
  -H "x-client-id: $CLIENT_ID" \
  -H "x-client-secret: $CLIENT_SECRET")
PCOUNT=$(echo "$PRODUCTS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else 0)" 2>/dev/null)
echo "  Products exposed to storefront: $PCOUNT"
echo "$PRODUCTS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if isinstance(d, list) and len(d)>0:
    sample = d[:3]
    for p in sample:
        stock = p.get('stock_levels','?')
        print(f\"    • {p.get('name','')} | SKU: {p.get('sku','')} | Stock: {stock} | MaxQty: {p.get('maxQuantity','')}\")
    print(f'    ... and {len(d)-3} more')
" 2>/dev/null || true

# 2. Categories
echo ""
echo "=== 2. CATEGORIES ==="
CATS=$(curl -s "$BASE/retail/public/categories" \
  -H "x-tenant-id: $TENANT" \
  -H "x-client-id: $CLIENT_ID" \
  -H "x-client-secret: $CLIENT_SECRET")
echo "  $CATS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if isinstance(d, list):
    print(f'  Categories available: {len(d)}')
    for c in d[:5]: print(f'    • {c}')
else:
    print(f'  Response: {json.dumps(d)[:200]}')
" 2>/dev/null || echo "  $CATS"

# 3. Customer Registration (test)
echo ""
echo "=== 3. CUSTOMER REGISTRATION ==="
REG_RESULT=$(curl -s -X POST "$BASE/retail/public/auth/register" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT" \
  -H "x-client-id: $CLIENT_ID" \
  -H "x-client-secret: $CLIENT_SECRET" \
  -d '{"name":"Test Customer","email":"test-integration@bambusilver.com","password":"TestPass123!","phone":"+62812345678"}')
echo "$REG_RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if 'customer' in d:
    c = d['customer']
    print(f'  ✅ Customer registered: {c.get(\"name\",\"\")} ({c.get(\"email\",\"\")})')
    print(f'     Access token: {d.get(\"accessToken\",\"\")[:30]}...' if d.get('accessToken') else '')
elif 'message' in d and 'already' in d.get('message','').lower():
    print(f'  ⚠️  Already registered (OK)')
elif d.get('detail','') and 'already' in d.get('detail','').lower():
    print(f'  ⚠️  Already registered (OK)')
else:
    print(f'  Result: {json.dumps(d)[:200]}')
" 2>/dev/null || echo "  $REG_RESULT"

# 4. Customer Login
echo ""
echo "=== 4. CUSTOMER LOGIN ==="
LOGIN_RESULT=$(curl -s -X POST "$BASE/retail/public/auth/login" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT" \
  -H "x-client-id: $CLIENT_ID" \
  -H "x-client-secret: $CLIENT_SECRET" \
  -d '{"email":"test-integration@bambusilver.com","password":"TestPass123!"}')
CUST_TOKEN=$(echo "$LOGIN_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',''))" 2>/dev/null)
echo "$LOGIN_RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('accessToken'):
    print(f'  ✅ Login successful, token issued')
elif d.get('customer'):
    print(f'  ✅ Login successful: {d[\"customer\"].get(\"name\",\"\")}')
else:
    print(f'  Result: {json.dumps(d)[:200]}')
" 2>/dev/null || echo "  $LOGIN_RESULT"

# 5. Add to Cart (requires customer token)
echo ""
echo "=== 5. ADD TO CART ==="
if [ -n "$CUST_TOKEN" ] && [ "$CUST_TOKEN" != "" ]; then
  # Get first product ID
  FIRST_PRODUCT=$(echo "$PRODUCTS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if isinstance(d,list) and len(d)>0 else '')" 2>/dev/null)
  if [ -n "$FIRST_PRODUCT" ]; then
    CART_RESULT=$(curl -s -X POST "$BASE/retail/public/cart/items" \
      -H "Content-Type: application/json" \
      -H "x-tenant-id: $TENANT" \
      -H "Authorization: Bearer $CUST_TOKEN" \
      -d "{\"product_id\":\"$FIRST_PRODUCT\",\"quantity\":1}")
    echo "$CART_RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if 'items' in d:
    print(f'  ✅ Cart has {len(d[\"items\"])} item(s)')
elif d.get('id'):
    print(f'  ✅ Cart updated: {d.get(\"id\",\"\")[:20]}')
else:
    print(f'  Result: {json.dumps(d)[:200]}')
" 2>/dev/null || echo "  $CART_RESULT"
  else
    echo "  ⚠️  No product to add (empty catalog)"
  fi
else
  echo "  ⚠️  Skipped (no customer token)"
fi

# 6. Add to Wishlist
echo ""
echo "=== 6. ADD TO WISHLIST ==="
if [ -n "$CUST_TOKEN" ] && [ "$CUST_TOKEN" != "" ] && [ -n "$FIRST_PRODUCT" ]; then
  WISH_RESULT=$(curl -s -X POST "$BASE/retail/public/wishlist/items" \
    -H "Content-Type: application/json" \
    -H "x-tenant-id: $TENANT" \
    -H "Authorization: Bearer $CUST_TOKEN" \
    -d "{\"product_id\":\"$FIRST_PRODUCT\"}")
  echo "$WISH_RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if 'items' in d:
    print(f'  ✅ Wishlist has {len(d[\"items\"])} item(s)')
elif d.get('id'):
    print(f'  ✅ Wishlist updated')
else:
    print(f'  Result: {json.dumps(d)[:200]}')
" 2>/dev/null || echo "  $WISH_RESULT"
else
  echo "  ⚠️  Skipped (no customer token)"
fi

# 7. Event tracking (page view, cart add)
echo ""
echo "=== 7. EVENT TRACKING (Analytics) ==="
EVENT_RESULT=$(curl -s -X POST "$BASE/retail/events" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT" \
  -H "x-api-key: $API_KEY" \
  -d '{"type":"cart.add","timestamp":"2026-06-28T05:00:00.000Z","actor":{"id":"visitor-1","type":"user"},"payload":{"product_id":"test","quantity":1,"price":250000}}')
echo "$EVENT_RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('success'):
    print(f'  ✅ Event tracked: {d.get(\"engine\",{}).get(\"action\",\"\")}')
else:
    print(f'  Result: {json.dumps(d)[:200]}')
" 2>/dev/null || echo "  $EVENT_RESULT"

# 8. Order creation (payment flow)
echo ""
echo "=== 8. ORDER CREATION (Payment → Finance) ==="
if [ -n "$FIRST_PRODUCT" ]; then
  FIRST_SKU=$(echo "$PRODUCTS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['sku'] if isinstance(d,list) and len(d)>0 else '')" 2>/dev/null)
  ORDER_RESULT=$(curl -s -X POST "$BASE/retail/public/orders" \
    -H "Content-Type: application/json" \
    -H "x-tenant-id: $TENANT" \
    -H "x-client-id: $CLIENT_ID" \
    -H "x-client-secret: $CLIENT_SECRET" \
    -H "Authorization: Bearer $CUST_TOKEN" \
    -d "{\"items\":[{\"sku\":\"$FIRST_SKU\",\"quantity\":1}],\"payment_method\":\"card\",\"payment_status\":\"PAID\",\"customer\":{\"email\":\"test-integration@bambusilver.com\",\"name\":\"Test Customer\"}}")
  echo "$ORDER_RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('order_id'):
    print(f'  ✅ Order created: {d[\"order_id\"]}')
    print(f'     Status: {d.get(\"status\",\"\")} | Payment: processed')
elif d.get('detail'):
    print(f'  ❌ {d[\"detail\"]}')
else:
    print(f'  Result: {json.dumps(d)[:300]}')
" 2>/dev/null || echo "  $ORDER_RESULT"
else
  echo "  ⚠️  Skipped (no products)"
fi

# 9. WhatsApp Chat webhook
echo ""
echo "=== 9. WHATSAPP BRIDGE ==="
WA_RESULT=$(curl -s -X POST "$BASE/retail/public/chat/webhook" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT" \
  -H "x-client-id: $CLIENT_ID" \
  -H "x-client-secret: $CLIENT_SECRET" \
  -d '{"from":"+62812345678","body":"Hi, I want to ask about silver ring prices","timestamp":"2026-06-28T05:00:00.000Z"}')
echo "$WA_RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('success') or d.get('room_id') or d.get('message_id'):
    print(f'  ✅ WhatsApp message forwarded to internal chat')
else:
    print(f'  Result: {json.dumps(d)[:200]}')
" 2>/dev/null || echo "  $WA_RESULT"

# 10. Admin view — verify customer shows up
echo ""
echo "=== 10. ADMIN VIEW — Customers in Zenvix ==="
TOKEN=$(cat /tmp/zenvix_token.txt 2>/dev/null)
if [ -n "$TOKEN" ]; then
  CUST_LIST=$(curl -s "$BASE/retail/customers" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tenant-id: $TENANT")
  echo "$CUST_LIST" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data = d.get('data', d) if isinstance(d, dict) else d
if isinstance(data, list):
    print(f'  Total customers visible to admin: {len(data)}')
    for c in data[:5]:
        print(f\"    • {c.get('name','')} | {c.get('email','')} | {c.get('phone','')}\")
else:
    print(f'  Response: {json.dumps(d)[:200]}')
" 2>/dev/null || echo "  $CUST_LIST"
else
  echo "  ⚠️  No admin token (run setup-ecommerce.sh first)"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  INTEGRATION VERIFICATION COMPLETE                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
