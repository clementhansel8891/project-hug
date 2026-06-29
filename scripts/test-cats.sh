#!/bin/bash
BASE="http://localhost:3001/v1"
TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"estela@bambusilver.com","password":"Estella2024!"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
echo "Categories response:"
curl -s "$BASE/inventory/categories" -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: tnt-3rlhko" | head -200
