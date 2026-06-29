#!/bin/bash
cd /home/ubuntu/bambusilver

# The problem: zenvixClient.ts uses import.meta.env which is empty at Docker build time
# Fix: use the runtime-env getters that read from window.__ENV__

# Add runtime-env import at the top (after first import statement)
sed -i '/^import axios/a import { getZenvixApiUrl, getZenvixTenantId, getZenvixClientId, getZenvixClientSecret, getZenvixApiKey } from "@/config/runtime-env";' src/lib/zenvixClient.ts

# Replace the const declarations
sed -i 's|^const BASE_URL =$|const BASE_URL = getZenvixApiUrl() \|\| "";|' src/lib/zenvixClient.ts
sed -i 's|^const BASE_URL =.*import.meta.*|const BASE_URL = getZenvixApiUrl() \|\| "";|' src/lib/zenvixClient.ts
sed -i 's|.*import.meta.env.VITE_ZENVIX_API_URL.*||' src/lib/zenvixClient.ts

sed -i 's|^const TENANT_ID = import.meta.*|const TENANT_ID = getZenvixTenantId();|' src/lib/zenvixClient.ts
sed -i 's|^const CLIENT_ID = import.meta.*|const CLIENT_ID = getZenvixClientId();|' src/lib/zenvixClient.ts
sed -i 's|^const CLIENT_SECRET = import.meta.*|const CLIENT_SECRET = getZenvixClientSecret();|' src/lib/zenvixClient.ts
sed -i 's|^const API_KEY = import.meta.*|const API_KEY = getZenvixApiKey();|' src/lib/zenvixClient.ts

echo "=== Result (first 35 lines) ==="
head -35 src/lib/zenvixClient.ts

echo ""
echo "=== Rebuilding container ==="
docker compose down
docker compose build --no-cache 2>&1 | tail -5
docker compose up -d
echo "Done!"
