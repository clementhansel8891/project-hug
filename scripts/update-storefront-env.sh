#!/bin/bash
# Update the headless ecommerce storefront .env with tnt-3rlhko credentials
set -e

STOREFRONT_DIR="/home/ubuntu/bambusilver"

echo "=== Backing up current .env ==="
cp "$STOREFRONT_DIR/.env" "$STOREFRONT_DIR/.env.bak.$(date +%s)" 2>/dev/null || true

echo "=== Writing new .env ==="
cat > "$STOREFRONT_DIR/.env" <<'EOF'
VITE_ZENVIX_API_URL=http://150.109.15.108:3001/v1/retail/public
VITE_ZENVIX_TENANT_ID=tnt-3rlhko
VITE_ZENVIX_CLIENT_ID=znx_chid_3c3ac6a1cbedf73d0e2dfe5a0d894691
VITE_ZENVIX_CLIENT_SECRET=znx_chcs_01dcd533cfe1300ba5d0f464cdead4f08d7e94bc1f3e4452fb266870130f5a24
VITE_ZENVIX_API_KEY=znx_ec_gw_9559c038036784e3a01344686f9f770381c12a719d635dac4a91476b0f96f78f
VITE_ZENVIX_CHANNEL_RECORD_ID=cf051a00-2fda-4c45-9606-68d949aaa171
VITE_ZENVIX_BRANCH_ID=f6ec35ea-b90c-46cf-ad39-4429f7d48c6e
VITE_WHATSAPP_OFFICE_PHONE=
EOF

echo "=== New .env contents ==="
cat "$STOREFRONT_DIR/.env"

# Check how it's running
echo ""
echo "=== Checking what serves port 3020 ==="
ss -tlnp | grep 3020 || true

echo ""
echo "=== Checking docker compose ==="
if [ -f "$STOREFRONT_DIR/docker-compose.yml" ]; then
  echo "Docker compose found:"
  cat "$STOREFRONT_DIR/docker-compose.yml"
  echo ""
  echo "=== Rebuilding storefront container ==="
  cd "$STOREFRONT_DIR"
  docker compose down 2>/dev/null || true
  docker compose up -d --build 2>&1
else
  echo "No docker-compose. Checking PM2..."
  pm2 list 2>/dev/null || true
fi

echo ""
echo "=== Waiting 10s for container to start ==="
sleep 10

echo "=== Testing storefront ==="
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3020/)
echo "Storefront HTTP status: $HTTP_CODE"

echo ""
echo "=== DONE ==="
