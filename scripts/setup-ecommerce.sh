#!/bin/bash
# Reset password for estela then login
set -e

BASE="http://localhost:3001/v1"
TENANT="tnt-3rlhko"

# Reset password first
echo "=== Resetting password for estela@bambusilver.com ==="
cat > /tmp/zenvix_reset.json <<'EOF'
{"email":"estela@bambusilver.com","newPassword":"Estella2024!"}
EOF

RESET_RESP=$(curl -s -X POST "$BASE/auth/reset-password-direct" \
  -H "Content-Type: application/json" \
  -d @/tmp/zenvix_reset.json)
echo "Reset response: $RESET_RESP"

# Now login
echo ""
echo "=== Authenticating as estela@bambusilver.com ==="
cat > /tmp/zenvix_login.json <<'EOF'
{"email":"estela@bambusilver.com","password":"Estella2024!"}
EOF

RESPONSE=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d @/tmp/zenvix_login.json)

TOKEN=$(echo "$RESPONSE" | python3 -c "
import sys,json
d=json.load(sys.stdin)
t = d.get('token') or d.get('access_token') or d.get('data',{}).get('token','')
print(t if t else '')
" 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" == "None" ] || [ "$TOKEN" == "" ]; then
  echo "Login failed: $RESPONSE"
  exit 1
fi

echo "Authenticated! Token: ${TOKEN:0:50}..."

# List stores
echo ""
echo "=== Stores in tnt-3rlhko ==="
curl -s "$BASE/retail/stores" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" | python3 -c "
import sys,json
data = json.load(sys.stdin)
if isinstance(data, dict) and 'data' in data:
    data = data['data']
if isinstance(data, list):
    for s in data:
        print(f\"  {s.get('id','')} | {s.get('name','')} | type={s.get('type','')} | loc={s.get('location_id','')}\")
    print(f'  Total: {len(data)} stores')
else:
    print(json.dumps(data, indent=2))
" 2>/dev/null || true

# List channels
echo ""
echo "=== Channels in tnt-3rlhko ==="
curl -s "$BASE/retail/ecommerce-hub/channels" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" | python3 -c "
import sys,json
data = json.load(sys.stdin)
if isinstance(data, dict) and 'data' in data:
    data = data['data']
if isinstance(data, list):
    for c in data:
        print(f\"  {c.get('id','')} | {c.get('name','')} | cat={c.get('integrationCategory','')} | status={c.get('status','')}\")
    print(f'  Total: {len(data)} channels')
else:
    print(json.dumps(data, indent=2))
" 2>/dev/null || true

# List locations
echo ""
echo "=== Locations in tnt-3rlhko ==="
curl -s "$BASE/hr/locations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" | python3 -c "
import sys,json
data = json.load(sys.stdin)
if isinstance(data, dict) and 'data' in data:
    data = data['data']
if isinstance(data, list):
    for loc in data:
        print(f\"  {loc.get('id','')} | {loc.get('name','')} | code={loc.get('code','')}\")
    print(f'  Total: {len(data)} locations')
else:
    print(json.dumps(data, indent=2))
" 2>/dev/null || true

echo "$TOKEN" > /tmp/zenvix_token.txt
echo "$TENANT" > /tmp/zenvix_tenant.txt
echo ""
echo "=== Token saved ==="
