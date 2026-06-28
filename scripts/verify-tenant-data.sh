#!/bin/bash
# Verify tnt-3rlhko tenant data: products, branches, ecommerce, staff
set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  VERIFYING TENANT DATA: tnt-3rlhko (Bambu Silver)           ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# === PRODUCTS ===
echo ""
echo "=== 1. PRODUCTS COUNT ==="
echo "SELECT COUNT(*) AS total_products FROM item_masters WHERE tenant_id = 'tnt-3rlhko';" | docker exec -i bfs-db psql -U zenvix -d zenvix_prod -t

echo ""
echo "=== Products by status ==="
echo "SELECT status, COUNT(*) FROM item_masters WHERE tenant_id = 'tnt-3rlhko' GROUP BY status;" | docker exec -i bfs-db psql -U zenvix -d zenvix_prod

# === STORES / BRANCHES ===
echo ""
echo "=== 2. STORES / BRANCHES ==="
echo "SELECT id, name, type, status, code FROM retail_stores WHERE tenant_id = 'tnt-3rlhko' ORDER BY name;" | docker exec -i bfs-db psql -U zenvix -d zenvix_prod

# === LOCATIONS ===
echo ""
echo "=== 3. LOCATIONS ==="
echo "SELECT id, name, code FROM locations WHERE tenant_id = 'tnt-3rlhko' ORDER BY name;" | docker exec -i bfs-db psql -U zenvix -d zenvix_prod

# === ECOMMERCE CHANNELS ===
echo ""
echo "=== 4. ECOMMERCE CHANNELS ==="
echo "SELECT id, name, type, status, \"integrationCategory\" FROM retail_channels WHERE tenant_id = 'tnt-3rlhko' ORDER BY created_at DESC LIMIT 10;" | docker exec -i bfs-db psql -U zenvix -d zenvix_prod

# === ECOMMERCE CONNECTORS ===
echo ""
echo "=== 5. ECOMMERCE CONNECTORS ==="
echo "SELECT id, name, platform, domain, status FROM ecommerce_connectors WHERE tenant_id = 'tnt-3rlhko' AND deleted_at IS NULL;" | docker exec -i bfs-db psql -U zenvix -d zenvix_prod

# === STAFF / USERS ===
echo ""
echo "=== 6. STAFF ==="
echo "SELECT email, first_name, last_name FROM users WHERE tenant_id = 'tnt-3rlhko' ORDER BY first_name;" | docker exec -i bfs-db psql -U zenvix -d zenvix_prod

# === STOCK LEVELS (sample) ===
echo ""
echo "=== 7. STOCK LEVELS (total records) ==="
echo "SELECT COUNT(*) AS total_stock_records FROM stock_levels WHERE tenant_id = 'tnt-3rlhko';" | docker exec -i bfs-db psql -U zenvix -d zenvix_prod -t

echo ""
echo "=== Stock by location (top 10) ==="
echo "SELECT l.name AS location, COUNT(sl.id) AS items, SUM(sl.on_hand::numeric) AS total_on_hand FROM stock_levels sl JOIN locations l ON sl.location_id = l.id WHERE sl.tenant_id = 'tnt-3rlhko' GROUP BY l.name ORDER BY total_on_hand DESC LIMIT 10;" | docker exec -i bfs-db psql -U zenvix -d zenvix_prod

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  VERIFICATION COMPLETE                                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
