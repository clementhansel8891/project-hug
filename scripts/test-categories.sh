#!/bin/bash
set -e
BASE="http://localhost:3001/v1"
cat > /tmp/login.json <<'EOF'
{"email":"estela@bambusilver.com","password":"Estella2024!"}
EOF
RESP=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d @/tmp/login.json)
TOKEN=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)

echo "=== /inventory/categories ==="
curl -s "$BASE/inventory/categories" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tnt-3rlhko" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data = d.get('data', d) if isinstance(d,dict) else d
if isinstance(data, list):
    print(f'  Categories: {len(data)}')
    for c in data[:5]:
        print(f'    • {c.get(\"name\",c.get(\"id\",\"\"))}')
else:
    print(f'  Response: {json.dumps(d)[:300]}')
" 2>/dev/null

echo ""
echo "=== /retail/categories ==="
curl -s "$BASE/retail/categories" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tnt-3rlhko" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data = d.get('data', d) if isinstance(d,dict) else d
if isinstance(data, list):
    print(f'  Categories: {len(data)}')
    for c in data[:5]:
        print(f'    • {c.get(\"name\",c.get(\"id\",\"\"))}')
else:
    print(f'  Response: {json.dumps(d)[:300]}')
" 2>/dev/null
