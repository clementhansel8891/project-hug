import { v4 as uuidv4 } from 'uuid';

const API_BASE = 'http://127.0.0.1:3001/v1';

async function api(path: string, method: string = 'GET', body?: any, token?: string, tenantId?: string, extraHeaders: Record<string, string> = {}) {
  const headers: any = {
    'Content-Type': 'application/json',
    ...extraHeaders
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (tenantId) headers['x-tenant-id'] = tenantId;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data: any = await res.json();
  return { status: res.status, data };
}

async function runMultiTenantTest() {
  console.log(`\n====================================================`);
  console.log(`🚀 STARTING MULTI-TENANT & RBAC VALIDATION`);
  console.log(`====================================================\n`);

  try {
    // 1. Setup Tenant A
    console.log('[1] Setting up Tenant A (Retail Enterprise)...');
    const userA = { email: `owner-a-${Date.now()}@test.com`, password: 'password123', first_name: 'Owner', last_name: 'A' };
    await api('/auth/register', 'POST', userA);
    const loginA = await api('/auth/login', 'POST', { email: userA.email, password: userA.password });
    const tokenA = loginA.data.token;
    
    const provA = await api('/auth/company/provision', 'POST', { 
      name: 'Tenant A Corp', 
      industry: 'RETAIL',
      country: 'Indonesia',
      address: 'Jakarta'
    }, tokenA);
    const tenantA = provA.data.data.tenant_id;
    const locA = provA.data.data.location_id;
    console.log(`✅ Tenant A Provisioned: ${tenantA} (Loc: ${locA})`);

    console.log('[1.1] Creating Store for Tenant A...');
    const storeA = await api('/retail/stores', 'POST', {
      name: 'Main Store A',
      code: 'STORE-A',
      location_id: locA,
      type: 'flagship'
    }, tokenA, tenantA);
    console.log('[DEBUG] Store A Response:', JSON.stringify(storeA.data));

    // 2. Setup Tenant B
    console.log('\n[2] Setting up Tenant B (Food Service)...');
    const userB = { email: `owner-b-${Date.now()}@test.com`, password: 'password123', first_name: 'Owner', last_name: 'B' };
    await api('/auth/register', 'POST', userB);
    const loginB = await api('/auth/login', 'POST', { email: userB.email, password: userB.password });
    const tokenB = loginB.data.token;
    
    const provB = await api('/auth/company/provision', 'POST', { name: 'Tenant B Corp', industry: 'RETAIL', country: 'Indonesia', address: 'Bali' }, tokenB);
    const tenantB = provB.data.data.tenant_id;
    const locB = provB.data.data.location_id;
    console.log(`✅ Tenant B Provisioned: ${tenantB} (Loc: ${locB})`);

    console.log('[2.1] Creating Store for Tenant B...');
    const storeB = await api('/retail/stores', 'POST', {
      name: 'Main Store B',
      code: 'STORE-B',
      location_id: locB,
      type: 'flagship'
    }, tokenB, tenantB);
    console.log('[DEBUG] Store B Response:', JSON.stringify(storeB.data));

    // 3. Test Isolation
    console.log('\n[3] Testing Data Isolation...');
    
    // Create Product in Tenant A
    const pA = await api('/inventory/items', 'POST', { 
      sku: 'SKU-A-ISOLATION', 
      name: 'Product A Isolation', 
      category: 'ELECTRONICS', 
      uom: 'pcs', 
      base_price: 100, 
      status: 'active' 
    }, tokenA, tenantA);
    
    if (!pA.data.data) {
      console.error('❌ Failed to create product in Tenant A:', JSON.stringify(pA.data));
      process.exit(1);
    }
    const productIdA = pA.data.data.id;
    console.log(`- Created Product A in Tenant A (ID: ${productIdA}).`);

    // Try to access Tenant A using Token B
    console.log(`- Attempting to access Tenant A data using Tenant B credentials...`);
    const isolationTest = await api(`/inventory/items`, 'GET', null, tokenB, tenantA);
    if (isolationTest.status === 401 || isolationTest.status === 403) {
      console.log(`✅ SUCCESS: Access Denied to unauthorized tenant (Status ${isolationTest.status}).`);
    } else {
      console.error(`❌ FAILURE: Data Leak! Tenant B could access Tenant A's products (Status ${isolationTest.status}).`);
      process.exit(1);
    }

    // Try to access Tenant B's nonexistent product from Tenant A
    console.log(`- Verifying Tenant A cannot see cross-tenant IDs...`);
    const crossIdTest = await api(`/inventory/items`, 'GET', null, tokenA, tenantB);
    if (crossIdTest.status === 401 || crossIdTest.status === 403) {
      console.log(`✅ SUCCESS: Access Denied to Tenant B for User A (Status ${crossIdTest.status}).`);
    } else {
      console.error(`❌ FAILURE: Tenant A could access Tenant B context! (Status ${crossIdTest.status}).`);
      process.exit(1);
    }

    // 4. Test RBAC (OWNER Restrictions)
    console.log('\n[4] Testing RBAC (Role-Based Access Control)...');
    
    // Test that OWNER cannot access SYSTEM routes
    console.log(`- Verifying OWNER cannot access SYSTEM routes (Infrastructure)...`);
    const systemTest = await api('/admin/infra/outbox-status', 'GET', null, tokenA, tenantA);
    if (systemTest.status === 403) {
      console.log(`✅ SUCCESS: OWNER blocked from system routes (Status 403).`);
    } else {
      console.warn(`⚠️ WARNING: OWNER accessed system route? (Status ${systemTest.status}). Check RolesGuard logic.`);
    }

    // Test that OWNER can access their own admin routes
    console.log(`- Verifying OWNER can access their own Dashboard...`);
    const adminTest = await api('/admin/dashboard', 'GET', null, tokenA, tenantA);
    if (adminTest.status === 200) {
      console.log(`✅ SUCCESS: OWNER can access their own Admin Dashboard.`);
    } else {
      console.error(`❌ FAILURE: OWNER denied from their own Dashboard! (Status ${adminTest.status}).`);
      process.exit(1);
    }

    console.log(`\n====================================================`);
    console.log(`📊 MULTI-TENANT & RBAC VALIDATION PASSED`);
    console.log(`====================================================`);
  } catch (error) {
    console.error(`\n❌ VALIDATION FAILED:`);
    console.error(error);
    process.exit(1);
  }
}

runMultiTenantTest();
