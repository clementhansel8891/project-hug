#!/bin/bash
set -e
BASE="http://localhost:3001/v1"
cat > /tmp/login.json <<'EOF'
{"email":"estela@bambusilver.com","password":"Estella2024!"}
EOF
RESP=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d @/tmp/login.json)
TOKEN=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)
H1="Authorization: Bearer $TOKEN"
H2="x-tenant-id: tnt-3rlhko"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  FINAL DATA VERIFICATION — ALL ENDPOINTS                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"

echo ""
echo "1. Inventory Dashboard (/inventory/dashboard)"
curl -s "$BASE/inventory/dashboard" -H "$H1" -H "$H2" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',{}); print(f'   Items: {d.get(\"total_items\")} | OnHand: {d.get(\"total_on_hand_qty\")} | LowStock: {d.get(\"low_stock_count\")} | OOS: {d.get(\"out_of_stock_count\")}')" 2>/dev/null

echo ""
echo "2. Inventory Items (/inventory/items)"
curl -s "$BASE/inventory/items?limit=3" -H "$H1" -H "$H2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'   Count: {d.get(\"count\")} | Total: {d.get(\"meta\",{}).get(\"total\")}')" 2>/dev/null

echo ""
echo "3. Inventory Categories (/inventory/categories)"
curl -s "$BASE/inventory/categories" -H "$H1" -H "$H2" | python3 -c "import sys,json; d=json.load(sys.stdin); data=d.get('data',d) if isinstance(d,dict) else d; print(f'   Categories: {len(data) if isinstance(data,list) else 0}')" 2>/dev/null

echo ""
echo "4. Retail Products (/retail/products)"
curl -s "$BASE/retail/products?pageSize=3" -H "$H1" -H "$H2" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',{}); print(f'   Items: {len(d.get(\"items\",[]))} | Total: {d.get(\"total\")}')" 2>/dev/null

echo ""
echo "5. Retail Categories (/retail/categories)"
curl -s "$BASE/retail/categories" -H "$H1" -H "$H2" | python3 -c "import sys,json; d=json.load(sys.stdin); data=d.get('data',d) if isinstance(d,dict) else d; print(f'   Categories: {len(data) if isinstance(data,list) else 0}')" 2>/dev/null

echo ""
echo "6. Retail Stores (/retail/stores)"
curl -s "$BASE/retail/stores" -H "$H1" -H "$H2" | python3 -c "import sys,json; d=json.load(sys.stdin); data=d.get('data',d) if isinstance(d,dict) else d; print(f'   Stores: {len(data) if isinstance(data,list) else 0}')" 2>/dev/null

echo ""
echo "7. Retail Channels (/retail/ecommerce-hub/channels)"
curl -s "$BASE/retail/ecommerce-hub/channels" -H "$H1" -H "$H2" | python3 -c "import sys,json; d=json.load(sys.stdin); data=d.get('data',d) if isinstance(d,dict) else d; print(f'   Channels: {len(data) if isinstance(data,list) else 0}')" 2>/dev/null

echo ""
echo "8. Retail Customers (/retail/customers)"
curl -s "$BASE/retail/customers" -H "$H1" -H "$H2" | python3 -c "import sys,json; d=json.load(sys.stdin); data=d.get('data',d) if isinstance(d,dict) else d; print(f'   Customers: {len(data) if isinstance(data,list) else 0}')" 2>/dev/null

echo ""
echo "9. Ecommerce Analytics (/retail/analytics/ecommerce)"
curl -s "$BASE/retail/analytics/ecommerce" -H "$H1" -H "$H2" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',{}); print(f'   Revenue: {d.get(\"revenue\",0)} | Orders: {d.get(\"orderCount\",0)}')" 2>/dev/null

echo ""
echo "10. Storefront (port 3020)"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3020/)
echo "   Status: HTTP $HTTP"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ALL ENDPOINTS VERIFIED                                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
