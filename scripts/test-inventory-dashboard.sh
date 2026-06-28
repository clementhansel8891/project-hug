#!/bin/bash
set -e
BASE="http://localhost:3001/v1"
cat > /tmp/login.json <<'EOF'
{"email":"estela@bambusilver.com","password":"Estella2024!"}
EOF
RESP=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d @/tmp/login.json)
TOKEN=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)

echo "=== Inventory Dashboard ==="
curl -s "$BASE/inventory/dashboard" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tnt-3rlhko" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data = d.get('data', d) if isinstance(d,dict) else d
print(f'  Total Items: {data.get(\"total_items\",\"?\")}')
print(f'  On-Hand Qty: {data.get(\"total_on_hand_qty\",\"?\")}')
print(f'  Low Stock: {data.get(\"low_stock_count\",\"?\")}')
print(f'  Out of Stock: {data.get(\"out_of_stock_count\",\"?\")}')
print(f'  Valuation: {data.get(\"total_valuation\",\"?\")}')
print(f'  Capital: {data.get(\"capital_value\",\"?\")}')
" 2>/dev/null
