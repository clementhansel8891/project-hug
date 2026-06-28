#!/bin/bash
# Test what the API returns for products
set -e
BASE="http://localhost:3001/v1"

# Login
cat > /tmp/login.json <<'EOF'
{"email":"estela@bambusilver.com","password":"Estella2024!"}
EOF
RESP=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d @/tmp/login.json)
TOKEN=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)

echo "=== 1. /retail/products (with tenant only) ==="
curl -s "$BASE/retail/products?pageSize=3" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tnt-3rlhko" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data = d.get('data', d) if isinstance(d,dict) else d
if isinstance(data, dict) and 'items' in data:
    print(f'  Items: {len(data[\"items\"])} | Total: {data.get(\"total\",\"?\")}')
elif isinstance(data, list):
    print(f'  Items: {len(data)}')
else:
    print(f'  Response: {json.dumps(d)[:300]}')
" 2>/dev/null

echo ""
echo "=== 2. /retail/products (with company_id) ==="
curl -s "$BASE/retail/products?pageSize=3" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tnt-3rlhko" \
  -H "x-company-id: b74e21b9-4e99-42fd-857b-36bf4dee7ed5" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data = d.get('data', d) if isinstance(d,dict) else d
if isinstance(data, dict) and 'items' in data:
    print(f'  Items: {len(data[\"items\"])} | Total: {data.get(\"total\",\"?\")}')
elif isinstance(data, list):
    print(f'  Items: {len(data)}')
else:
    print(f'  Response: {json.dumps(d)[:300]}')
" 2>/dev/null

echo ""
echo "=== 3. /inventory/items (core inventory endpoint) ==="
curl -s "$BASE/inventory/items?limit=3" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tnt-3rlhko" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data = d.get('data', d) if isinstance(d,dict) else d
if isinstance(data, dict):
    items = data.get('items', data.get('data', []))
    print(f'  Items: {len(items) if isinstance(items,list) else \"?\"} | Total: {data.get(\"total\",data.get(\"meta\",{}).get(\"total\",\"?\"))}')
elif isinstance(data, list):
    print(f'  Items: {len(data)}')
else:
    print(f'  Response: {json.dumps(d)[:300]}')
" 2>/dev/null

echo ""
echo "=== 4. Check if location issue ==="
curl -s "$BASE/retail/products?pageSize=3" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tnt-3rlhko" \
  -H "x-location-id: a3a241a4-4841-45a3-90cd-f7135e6847b4" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data = d.get('data', d) if isinstance(d,dict) else d
if isinstance(data, dict) and 'items' in data:
    print(f'  With Seminyak location - Items: {len(data[\"items\"])} | Total: {data.get(\"total\",\"?\")}')
elif isinstance(data, list):
    print(f'  Items: {len(data)}')
else:
    print(f'  Response: {json.dumps(d)[:300]}')
" 2>/dev/null
