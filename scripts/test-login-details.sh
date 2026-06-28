#!/bin/bash
set -e
BASE="http://localhost:3001/v1"
cat > /tmp/login.json <<'EOF'
{"email":"estela@bambusilver.com","password":"Estella2024!"}
EOF
RESP=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d @/tmp/login.json)
echo "$RESP" | python3 -c "
import sys,json
d=json.load(sys.stdin)
user = d.get('user',{})
companies = user.get('user_companies',[])
print(f'Companies count: {len(companies)}')
if companies:
    print(f'First company raw keys: {list(companies[0].keys())}')
    print(f'First company: {json.dumps(companies[0], indent=2)[:500]}')
" 2>/dev/null
