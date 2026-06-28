#!/bin/bash
# Verify the ecommerce pages work with data
set -e
BASE="http://localhost:3001/v1"

# Login
cat > /tmp/login.json <<'EOF'
{"email":"estela@bambusilver.com","password":"Estella2024!"}
EOF
RESP=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d @/tmp/login.json)
TOKEN=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)

echo "=== Customer Activity (GET /retail/customers) ==="
CUSTS=$(curl -s "$BASE/retail/customers" -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: tnt-3rlhko")
echo "$CUSTS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data = d.get('data', d) if isinstance(d, dict) else d
if isinstance(data, list):
    print(f'  Customers found: {len(data)}')
    for c in data[:5]:
        print(f'    • {c.get(\"name\",\"\")} | {c.get(\"email\",\"\")} | Cart: {len(c.get(\"retail_carts\",[]))} | Wishlist: {len(c.get(\"retail_wishlists\",[]))}')
else:
    print(f'  Response: {json.dumps(d)[:200]}')
" 2>/dev/null || echo "$CUSTS" | head -200

echo ""
echo "=== E-Commerce Analytics (GET /retail/analytics/ecommerce) ==="
ANALYTICS=$(curl -s "$BASE/retail/analytics/ecommerce" -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: tnt-3rlhko")
echo "$ANALYTICS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data = d.get('data', d) if isinstance(d, dict) else d
print(f'  Revenue: {data.get(\"revenue\",0)}')
print(f'  Orders: {data.get(\"orderCount\",0)}')
print(f'  Top Products: {len(data.get(\"topProducts\",[]))}')
" 2>/dev/null || echo "$ANALYTICS" | head -200

echo ""
echo "=== Channels (GET /retail/ecommerce-hub/channels) ==="
CHANS=$(curl -s "$BASE/retail/ecommerce-hub/channels" -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: tnt-3rlhko")
echo "$CHANS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data = d.get('data', d) if isinstance(d, dict) else d
if isinstance(data, list):
    print(f'  Channels: {len(data)}')
    for c in data:
        print(f'    • {c.get(\"name\",\"\")} | {c.get(\"status\",\"\")} | {c.get(\"integrationCategory\",\"\")}')
else:
    print(f'  {json.dumps(d)[:200]}')
" 2>/dev/null || echo "$CHANS" | head -200

echo ""
echo "=== Products (GET /retail/products?pageSize=5) ==="
PRODS=$(curl -s "$BASE/retail/products?pageSize=5" -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: tnt-3rlhko")
echo "$PRODS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data = d.get('data', d) if isinstance(d, dict) else d
items = data.get('items', data) if isinstance(data, dict) else data
if isinstance(items, list):
    print(f'  Products returned: {len(items)}')
    for p in items[:3]:
        print(f'    • {p.get(\"name\",\"\")[:30]} | SKU: {p.get(\"sku\",\"\")} | Price: {p.get(\"base_price\",p.get(\"selling_price\",0))}')
else:
    print(f'  {json.dumps(d)[:200]}')
" 2>/dev/null || echo "$PRODS" | head -200

echo ""
echo "=== DONE ==="
