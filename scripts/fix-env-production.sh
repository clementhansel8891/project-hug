#!/bin/bash
# The docker-compose uses .env.production, copy .env to .env.production
set -e

STOREFRONT_DIR="/home/ubuntu/bambusilver"

echo "=== Docker compose references .env.production ==="
echo "=== Copying .env to .env.production ==="
cp "$STOREFRONT_DIR/.env" "$STOREFRONT_DIR/.env.production"

echo "=== Checking docker-entrypoint for env injection ==="
cat "$STOREFRONT_DIR/docker-entrypoint.sh"

echo ""
echo "=== Rebuilding with .env.production ==="
cd "$STOREFRONT_DIR"
docker compose down 2>/dev/null || true
docker compose up -d --build 2>&1 | tail -5

sleep 5

echo ""
echo "=== Verifying env vars are injected in the built app ==="
curl -s http://localhost:3020/env-config.js 2>/dev/null || echo "No env-config.js found"

echo ""
echo "=== Storefront status ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3020/
