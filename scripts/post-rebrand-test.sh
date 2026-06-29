#!/bin/bash
# Quick post-rebrand functional test
set -e
BASE="http://localhost:3001/v1"

echo "=== 1. Login ==="
cat > /tmp/login.json <<'EOF'
{"email":"estela@bambusilver.com","password":"Estella2024!"}
EOF
RESP=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d @/tmp/login.json)
TOKEN=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)
if [ -z "$TOKEN" ]; then echo "  FAIL: no token"; exit 1; fi
echo "  OK: token received"

echo ""
echo "=== 2. Inventory Dashboard ==="
DASH=$(curl -s "$BASE/inventory/dashboard" -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: tnt-3rlhko")
echo "$DASH" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data=d.get('data',d)
print(f'  Items: {data.get(\"total_items\",0)} | Stock: {data.get(\"total_on_hand_qty\",0)} | Low: {data.get(\"low_stock_count\",0)}')
" 2>/dev/null

echo ""
echo "=== 3. Retail Products ==="
PRODS=$(curl -s "$BASE/retail/products?pageSize=3" -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: tnt-3rlhko")
echo "$PRODS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data=d.get('data',d)
items=data.get('items',data) if isinstance(data,dict) else data
print(f'  Products: {len(items) if isinstance(items,list) else \"?\"} returned')
" 2>/dev/null

echo ""
echo "=== 4. Categories ==="
CATS=$(curl -s "$BASE/inventory/categories" -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: tnt-3rlhko")
echo "$CATS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data=d.get('data',d)
print(f'  Categories: {len(data) if isinstance(data,list) else \"?\"}')
" 2>/dev/null

echo ""
echo "=== 5. Customers ==="
CUSTS=$(curl -s "$BASE/retail/customers" -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: tnt-3rlhko")
echo "$CUSTS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data=d.get('data',d)
print(f'  Customers: {len(data) if isinstance(data,list) else \"?\"}')
" 2>/dev/null

echo ""
echo "=== 6. Ecommerce Channel ==="
CHAN=$(curl -s "$BASE/retail/ecommerce-hub/channels" -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: tnt-3rlhko")
echo "$CHAN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data=d.get('data',d)
print(f'  Channels: {len(data) if isinstance(data,list) else \"?\"}')
" 2>/dev/null

echo ""
echo "=== 7. Public Products (storefront) ==="
PUB=$(curl -s "$BASE/retail/public/products" -H "x-tenant-id: tnt-3rlhko" -H "x-client-id: znx_chid_3c3ac6a1cbedf73d0e2dfe5a0d894691" -H "x-client-secret: znx_chcs_01dcd533cfe1300ba5d0f464cdead4f08d7e94bc1f3e4452fb266870130f5a24")
echo "$PUB" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if isinstance(d,list):
    print(f'  Public products: {len(d)}')
else:
    print(f'  Error: {d.get(\"detail\",\"?\")[:80]}')
" 2>/dev/null

echo ""
echo "=== 8. Frontend Title Check ==="
curl -s http://localhost:3010/ | grep -o '<title>.*</title>'

echo ""
echo "=== ALL TESTS COMPLETE ==="
