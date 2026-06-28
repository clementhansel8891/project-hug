#!/bin/bash
# Reset superadmin password and verify login
set -e
BASE="http://localhost:3001/v1"

echo "=== Resetting hansel@bambusilver.com password ==="
cat > /tmp/reset.json <<'EOF'
{"email":"hansel@bambusilver.com","newPassword":"Hansel2024!"}
EOF

curl -s -X POST "$BASE/auth/reset-password-direct" \
  -H "Content-Type: application/json" \
  -d @/tmp/reset.json | python3 -m json.tool

echo ""
echo "=== Testing login ==="
cat > /tmp/login.json <<'EOF'
{"email":"hansel@bambusilver.com","password":"Hansel2024!"}
EOF

RESP=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d @/tmp/login.json)

echo "$RESP" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('token'):
    user = d.get('user',{})
    companies = user.get('user_companies',[])
    print(f'✅ Login successful')
    print(f'   User: {user.get(\"first_name\")} {user.get(\"last_name\")} ({user.get(\"email\")})')
    print(f'   Tenant: {user.get(\"tenant_id\")}')
    print(f'   Companies: {len(companies)}')
    for c in companies:
        print(f'     • {c.get(\"role\")} in {c.get(\"company\",{}).get(\"name\",\"\")} (tenant: {c.get(\"tenant_id\")})')
else:
    print(f'❌ Login failed: {json.dumps(d)[:200]}')
"

echo ""
echo "=== Credentials ==="
echo "Email: hansel@bambusilver.com"
echo "Password: Hansel2024!"
echo "Role: SUPERADMIN"
echo "Tenant: tnt-3rlhko"
