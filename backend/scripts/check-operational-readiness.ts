/**
 * Comprehensive Operational Readiness Check
 * For Bambu Silver Seminyak Store Trial
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_ID = 'tnt-3rlhko';
const SEMINYAK_STORE_CODE = 'BS-03';

interface ReadinessMetric {
  module: string;
  metric: string;
  status: 'READY' | 'WARNING' | 'NOT_READY';
  count?: number;
  details?: string;
  recommendation?: string;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('          BAMBU SILVER - OPERATIONAL READINESS CHECK');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`Tenant: ${TENANT_ID} (Estella's Organization)`);
  console.log(`Trial Store: Seminyak (${SEMINYAK_STORE_CODE})`);
  console.log(`Date: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const results: ReadinessMetric[] = [];

  // ========== 1. STORES & LOCATIONS ==========
  console.log('📍 1. STORES & LOCATIONS');
  console.log('─────────────────────────────────────────────────────────────────────\n');

  const stores = await prisma.stores.count({ where: { tenant_id: TENANT_ID } });
  const activeStores = await prisma.stores.count({ 
    where: { tenant_id: TENANT_ID, status: 'active' } 
  });
  
  const seminyakStore = await prisma.stores.findFirst({
    where: { tenant_id: TENANT_ID, code: SEMINYAK_STORE_CODE },
    include: { locations: true },
  });

  results.push({
    module: 'STORES',
    metric: 'Total Stores',
    status: stores >= 5 ? 'READY' : 'WARNING',
    count: stores,
    details: `${activeStores} active stores`,
  });

  if (seminyakStore) {
    console.log(`   ✅ Seminyak Store: ${seminyakStore.name} (${seminyakStore.code})`);
    console.log(`      Status: ${seminyakStore.status}`);
    console.log(`      Location: ${seminyakStore.locations?.name || 'N/A'}\n`);
    results.push({
      module: 'STORES',
      metric: 'Seminyak Store',
      status: seminyakStore.status === 'active' ? 'READY' : 'NOT_READY',
      details: `${seminyakStore.name} - ${seminyakStore.status}`,
    });
  } else {
    console.log(`   ❌ Seminyak Store NOT FOUND\n`);
    results.push({
      module: 'STORES',
      metric: 'Seminyak Store',
      status: 'NOT_READY',
      details: 'Store not found',
      recommendation: 'Create Seminyak store with code BS-03',
    });
  }

  // ========== 2. INVENTORY ==========
  console.log('📦 2. INVENTORY');
  console.log('─────────────────────────────────────────────────────────────────────\n');

  const products = await prisma.item_masters.count({ where: { tenant_id: TENANT_ID } });
  const stockLevels = await prisma.stock_levels.count({ where: { tenant_id: TENANT_ID } });
  
  const totalStock = await prisma.stock_levels.aggregate({
    where: { tenant_id: TENANT_ID },
    _sum: { on_hand: true },
  });

  const seminyakStock = seminyakStore?.location_id 
    ? await prisma.stock_levels.count({ 
        where: { 
          tenant_id: TENANT_ID,
          location_id: seminyakStore.location_id,
        } 
      })
    : 0;

  console.log(`   Products (Item Masters): ${products.toLocaleString()}`);
  console.log(`   Stock Levels: ${stockLevels.toLocaleString()}`);
  console.log(`   Total Stock On Hand: ${totalStock._sum?.on_hand?.toString() || '0'}`);
  console.log(`   Seminyak Stock Items: ${seminyakStock}\n`);

  results.push(
    {
      module: 'INVENTORY',
      metric: 'Products',
      status: products >= 100 ? 'READY' : products > 0 ? 'WARNING' : 'NOT_READY',
      count: products,
      recommendation: products < 100 ? 'Add more products for realistic trial' : undefined,
    },
    {
      module: 'INVENTORY',
      metric: 'Stock Levels',
      status: stockLevels > 0 ? 'READY' : 'NOT_READY',
      count: stockLevels,
      recommendation: stockLevels === 0 ? 'CRITICAL: Assign stock to locations' : undefined,
    },
    {
      module: 'INVENTORY',
      metric: 'Seminyak Stock',
      status: seminyakStock > 0 ? 'READY' : 'NOT_READY',
      count: seminyakStock,
      recommendation: seminyakStock === 0 ? 'CRITICAL: Assign stock to Seminyak location' : undefined,
    }
  );

  // ========== 3. FINANCE ==========
  console.log('💰 3. FINANCE');
  console.log('─────────────────────────────────────────────────────────────────────\n');

  const chartAccounts = await prisma.finance_chart_of_accounts.count({ 
    where: { tenant_id: TENANT_ID } 
  });
  
  const fiscalPeriods = await prisma.finance_fiscal_periods.count({ 
    where: { tenant_id: TENANT_ID } 
  });
  
  const openPeriods = await prisma.finance_fiscal_periods.count({ 
    where: { tenant_id: TENANT_ID, status: 'OPEN' } 
  });

  const journalEntries = await prisma.finance_journal_entries.count({ 
    where: { tenant_id: TENANT_ID } 
  });

  console.log(`   Chart of Accounts: ${chartAccounts}`);
  console.log(`   Fiscal Periods: ${fiscalPeriods} (${openPeriods} open)`);
  console.log(`   Journal Entries: ${journalEntries}\n`);

  results.push(
    {
      module: 'FINANCE',
      metric: 'Chart of Accounts',
      status: chartAccounts >= 10 ? 'READY' : chartAccounts > 0 ? 'WARNING' : 'NOT_READY',
      count: chartAccounts,
      recommendation: chartAccounts === 0 ? 'CRITICAL: Set up chart of accounts' : undefined,
    },
    {
      module: 'FINANCE',
      metric: 'Fiscal Periods',
      status: openPeriods > 0 ? 'READY' : 'NOT_READY',
      count: fiscalPeriods,
      details: `${openPeriods} open periods`,
      recommendation: openPeriods === 0 ? 'CRITICAL: Create and open fiscal period for current month' : undefined,
    }
  );

  // ========== 4. RETAIL OPERATIONS ==========
  console.log('🛒 4. RETAIL OPERATIONS');
  console.log('─────────────────────────────────────────────────────────────────────\n');

  const retailOrders = await prisma.retail_orders.count({ where: { tenant_id: TENANT_ID } });
  const retailShifts = await prisma.retail_shifts.count({ where: { tenant_id: TENANT_ID } });
  const openShifts = await prisma.retail_shifts.count({ 
    where: { tenant_id: TENANT_ID, status: 'open' } 
  });
  
  const customers = await prisma.retail_customers.count({ where: { tenant_id: TENANT_ID } });
  const channels = await prisma.retail_channels.count({ where: { tenant_id: TENANT_ID } });

  console.log(`   Retail Orders: ${retailOrders}`);
  console.log(`   Retail Shifts: ${retailShifts} (${openShifts} currently open)`);
  console.log(`   Customers: ${customers}`);
  console.log(`   Retail Channels: ${channels}\n`);

  results.push(
    {
      module: 'RETAIL',
      metric: 'Shift System',
      status: 'READY',
      details: `${retailShifts} historical shifts, ${openShifts} open`,
      recommendation: openShifts > 0 ? 'INFO: There are open shifts - may need to close before trial' : undefined,
    },
    {
      module: 'RETAIL',
      metric: 'Historical Orders',
      status: 'READY',
      count: retailOrders,
      details: retailOrders > 0 ? 'System has transaction history' : 'Fresh system - no orders yet',
    }
  );

  // ========== 5. HR & EMPLOYEES ==========
  console.log('👥 5. HR & EMPLOYEES');
  console.log('─────────────────────────────────────────────────────────────────────\n');

  const employees = await prisma.employees.count({ where: { tenant_id: TENANT_ID } });
  const activeEmployees = await prisma.employees.count({ 
    where: { tenant_id: TENANT_ID, status: 'active' } 
  });
  
  const departments = await prisma.departments.count({ where: { tenant_id: TENANT_ID } });
  const positions = await prisma.positions.count({ where: { tenant_id: TENANT_ID } });

  console.log(`   Employees: ${employees} (${activeEmployees} active)`);
  console.log(`   Departments: ${departments}`);
  console.log(`   Positions: ${positions}\n`);

  results.push(
    {
      module: 'HR',
      metric: 'Employees',
      status: activeEmployees >= 6 ? 'READY' : activeEmployees > 0 ? 'WARNING' : 'NOT_READY',
      count: activeEmployees,
      details: `${employees} total, ${activeEmployees} active`,
      recommendation: activeEmployees === 0 ? 'Create employee records for SPG staff' : undefined,
    }
  );

  // ========== 6. USERS & ACCESS ==========
  console.log('🔐 6. USERS & ACCESS');
  console.log('─────────────────────────────────────────────────────────────────────\n');

  const users = await prisma.users.count({ where: { tenant_id: TENANT_ID } });
  const activeUsers = await prisma.users.count({ 
    where: { tenant_id: TENANT_ID, status: 'active' } 
  });

  const usersByRole = await prisma.user_companies.groupBy({
    by: ['role'],
    where: { tenant_id: TENANT_ID },
    _count: true,
  });

  console.log(`   Total Users: ${users}`);
  console.log(`   Active Users: ${activeUsers}`);
  console.log(`   Users by Role:`);
  usersByRole.forEach(r => {
    console.log(`      - ${r.role}: ${r._count} users`);
  });
  console.log('');

  results.push({
    module: 'ACCESS',
    metric: 'Active Users',
    status: activeUsers >= 10 ? 'READY' : activeUsers > 0 ? 'WARNING' : 'NOT_READY',
    count: activeUsers,
    details: usersByRole.map(r => `${r.role}:${r._count}`).join(', '),
  });

  // ========== 7. PRICING ==========
  console.log('💵 7. PRICING & PROMOTIONS');
  console.log('─────────────────────────────────────────────────────────────────────\n');

  const priceVersions = await prisma.price_versions.count({ where: { tenant_id: TENANT_ID } });
  const activePrices = await prisma.price_versions.count({ 
    where: { 
      tenant_id: TENANT_ID, 
      active: true 
    } 
  });
  
  const promotions = await prisma.retail_promotions.count({ where: { tenant_id: TENANT_ID } });
  const activePromotions = await prisma.retail_promotions.count({ 
    where: { tenant_id: TENANT_ID, status: 'active' } 
  });

  console.log(`   Price Versions: ${priceVersions} (${activePrices} active)`);
  console.log(`   Promotions: ${promotions} (${activePromotions} active)\n`);

  results.push(
    {
      module: 'PRICING',
      metric: 'Price Versions',
      status: activePrices > 0 ? 'READY' : 'WARNING',
      count: activePrices,
      recommendation: activePrices === 0 ? 'Create price version or ensure products have base prices' : undefined,
    }
  );

  // ========== 8. PAYMENT CONFIGURATION ==========
  console.log('💳 8. PAYMENT CONFIGURATION');
  console.log('─────────────────────────────────────────────────────────────────────\n');

  const paymentTxns = await prisma.payment_transactions.count({ where: { tenant_id: TENANT_ID } });
  const moneySources = await prisma.money_sources.count({ where: { tenant_id: TENANT_ID } });

  console.log(`   Payment Transactions (Historical): ${paymentTxns}`);
  console.log(`   Money Sources: ${moneySources}\n`);

  results.push({
    module: 'PAYMENT',
    metric: 'Payment System',
    status: 'READY',
    details: `${moneySources} money sources configured`,
    recommendation: moneySources === 0 ? 'Optional: Configure money sources for cash tracking' : undefined,
  });

  // ========== 9. PRODUCT CATEGORIES ==========
  console.log('📂 9. PRODUCT CATEGORIES');
  console.log('─────────────────────────────────────────────────────────────────────\n');

  const categories = await prisma.product_categories.count({ where: { tenant_id: TENANT_ID } });

  console.log(`   Product Categories: ${categories}\n`);

  results.push({
    module: 'CATALOG',
    metric: 'Categories',
    status: categories > 0 ? 'READY' : 'WARNING',
    count: categories,
    recommendation: categories === 0 ? 'Optional: Create product categories for better organization' : undefined,
  });

  // ========== SUMMARY ==========
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('                           READINESS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const ready = results.filter(r => r.status === 'READY').length;
  const warning = results.filter(r => r.status === 'WARNING').length;
  const notReady = results.filter(r => r.status === 'NOT_READY').length;
  const total = results.length;

  console.log(`✅ READY: ${ready}/${total}`);
  console.log(`⚠️  WARNING: ${warning}/${total}`);
  console.log(`❌ NOT READY: ${notReady}/${total}\n`);

  // Critical blockers
  const blockers = results.filter(r => r.status === 'NOT_READY' && r.recommendation?.includes('CRITICAL'));
  
  if (blockers.length > 0) {
    console.log('🚫 CRITICAL BLOCKERS:');
    blockers.forEach((b, idx) => {
      console.log(`   ${idx + 1}. ${b.module} - ${b.metric}: ${b.recommendation}`);
    });
    console.log('');
  }

  // Recommendations
  const recommendations = results.filter(r => r.recommendation && !r.recommendation.includes('CRITICAL'));
  
  if (recommendations.length > 0) {
    console.log('💡 RECOMMENDATIONS:');
    recommendations.forEach((r, idx) => {
      console.log(`   ${idx + 1}. ${r.module} - ${r.metric}: ${r.recommendation}`);
    });
    console.log('');
  }

  // Final verdict
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  if (notReady > 0) {
    console.log('⚠️  VERDICT: NOT READY FOR TRIAL');
    console.log(`   ${notReady} critical issue(s) must be resolved first\n`);
  } else if (warning > 2) {
    console.log('⚠️  VERDICT: READY WITH CAUTIONS');
    console.log(`   ${warning} item(s) need attention but trial can proceed\n`);
  } else {
    console.log('✅ VERDICT: READY FOR TRIAL');
    console.log('   All systems operational for Seminyak store trial\n');
  }

  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
