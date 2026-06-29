#!/bin/bash
echo "=== Public Products (storefront view) ==="
RESULT=$(curl -s http://localhost:3001/v1/retail/public/products \
  -H "x-tenant-id: tnt-3rlhko" \
  -H "x-client-id: znx_chid_3c3ac6a1cbedf73d0e2dfe5a0d894691" \
  -H "x-client-secret: znx_chcs_01dcd533cfe1300ba5d0f464cdead4f08d7e94bc1f3e4452fb266870130f5a24")
echo "$RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if isinstance(d, list):
    print(f'Products returned to storefront: {len(d)}')
    for p in d[:5]:
        print(f'  • {p.get(\"name\",\"\")[:40]} | SKU: {p.get(\"sku\",\"\")} | Price: {p.get(\"price\",0)} | Stock: {p.get(\"stock_levels\",\"\")}')
elif isinstance(d, dict) and d.get('detail'):
    print(f'Error: {d.get(\"detail\")}')
else:
    print(f'Response: {json.dumps(d)[:200]}')
"

echo ""
echo "=== Channel Products in DB ==="
echo "SELECT COUNT(*) as channel_products FROM retail_channel_products WHERE tenant_id = 'tnt-3rlhko' AND visible = true;" | docker exec -i bfs-db psql -U zenvix -d zenvix_prod -t
