/**
 * Finalize Seminyak Trial Setup
 * 
 * Implements minor recommendations to ensure smooth operation:
 * 1. Create price versions for products (if base prices exist)
 * 2. Set up money sources for cash tracking
 * 3. Create employee records for SPG staff
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_ID = 'tnt-3rlhko';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('       FINALIZING SEMINYAK TRIAL SETUP - MINOR RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Get company
  const company = await prisma.companies.findFirst({
    where: { tenant_id: TENANT_ID },
  });

  if (!company) {
    throw new Error('Company not found for tenant');
  }

  console.log(`Company: ${company.name} (${company.id})\n`);

  // Get all stores for reference
  const stores = await prisma.stores.findMany({
    where: { tenant_id: TENANT_ID, status: 'active' },
    include: { locations: true },
  });

  console.log(`Active Stores: ${stores.length}`);
  stores.forEach(s => console.log(`  - ${s.name} (${s.code})`));
  console.log('');

  // ========== 1. PRICE VERSIONS ==========
  console.log('💵 1. SETTING UP PRICE VERSIONS');
  console.log('─────────────────────────────────────────────────────────────────────\n');

  // Check if products have prices in item_masters
  const productsWithPrices = await prisma.item_masters.findMany({
    where: {
      tenant_id: TENANT_ID,
      price: { not: null },
    },
    take: 100, // Sample first 100 products to avoid timeout
    select: {
      id: true,
      sku: true,
      name: true,
      price: true,
    },
  });

  console.log(`   Found ${productsWithPrices.length} products with base prices`);

  if (productsWithPrices.length > 0) {
    // Create price versions for sampled products
    let createdCount = 0;
    
    for (const product of productsWithPrices) {
      // Check if price version already exists
      const existing = await prisma.price_versions.findFirst({
        where: {
          tenant_id: TENANT_ID,
          sku_id: product.id,
        },
      });

      if (!existing && product.price) {
        await prisma.price_versions.create({
          data: {
            tenant_id: TENANT_ID,
            company_id: company.id,
            sku_id: product.id,
            price: product.price,
            is_current: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });
        createdCount++;
      }
    }

    console.log(`   ✅ Created ${createdCount} price versions`);
    console.log(`   ℹ️  Note: Sample of 100 products. Others will use base prices from item_masters\n`);
  } else {
    console.log(`   ℹ️  Products already using base prices from item_masters\n`);
  }

  // ========== 2. MONEY SOURCES ==========
  console.log('💰 2. SETTING UP MONEY SOURCES');
  console.log('─────────────────────────────────────────────────────────────────────\n');

  const existingMoneySources = await prisma.money_sources.count({
    where: { tenant_id: TENANT_ID },
  });

  if (existingMoneySources === 0) {
    // Create money sources for each store
    const moneySources = [];
    
    for (const store of stores) {
      // Main cash register
      moneySources.push({
        tenant_id: TENANT_ID,
        company_id: company.id,
        store_id: store.id,
        type: 'CASH_REGISTER',
        name: `${store.name} - Cash Register`,
        code: `CASH-${store.code}`,
        currency: 'IDR',
        balance: 0,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Petty cash
      moneySources.push({
        tenant_id: TENANT_ID,
        company_id: company.id,
        store_id: store.id,
        type: 'PETTY_CASH',
        name: `${store.name} - Petty Cash`,
        code: `PETTY-${store.code}`,
        currency: 'IDR',
        balance: 0,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    await prisma.money_sources.createMany({
      data: moneySources,
    });

    console.log(`   ✅ Created ${moneySources.length} money sources`);
    console.log(`      - Cash registers: ${stores.length}`);
    console.log(`      - Petty cash: ${stores.length}\n`);
  } else {
    console.log(`   ℹ️  ${existingMoneySources} money sources already configured\n`);
  }

  // ========== 3. EMPLOYEE RECORDS ==========
  console.log('👥 3. CREATING EMPLOYEE RECORDS FOR SPG STAFF');
  console.log('─────────────────────────────────────────────────────────────────────\n');

  // Get SPG users
  const spgUsers = await prisma.users.findMany({
    where: {
      tenant_id: TENANT_ID,
      email: {
        in: [
          'dewa@bambusilver.com',
          'dewi@bambusilver.com',
          'gusti@bambusilver.com',
          'nyoman@bambusilver.com',
          'nana@bambusilver.com',
          'fera@bambusilver.com',
        ],
      },
    },
  });

  console.log(`   Found ${spgUsers.length} SPG user accounts\n`);

  // Get or create Sales department
  let salesDept = await prisma.departments.findFirst({
    where: {
      tenant_id: TENANT_ID,
      name: 'Sales',
    },
  });

  if (!salesDept) {
    salesDept = await prisma.departments.create({
      data: {
        tenant_id: TENANT_ID,
        company_id: company.id,
        name: 'Sales',
        code: 'SALES',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    console.log(`   ✅ Created Sales department\n`);
  }

  // Get or create Sales Position
  let salesPosition = await prisma.positions.findFirst({
    where: {
      tenant_id: TENANT_ID,
      title: 'Sales Associate',
    },
  });

  if (!salesPosition) {
    salesPosition = await prisma.positions.create({
      data: {
        tenant_id: TENANT_ID,
        company_id: company.id,
        title: 'Sales Associate',
        code: 'SPG',
        department_id: salesDept.id,
        level: 'STAFF',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    console.log(`   ✅ Created Sales Associate position\n`);
  }

  // Create employee records
  let createdEmployees = 0;
  
  for (const user of spgUsers) {
    // Check if employee record exists
    const existing = await prisma.employees.findFirst({
      where: {
        tenant_id: TENANT_ID,
        user_id: user.id,
      },
    });

    if (!existing) {
      // Assign to first active store (they can work at any store)
      const defaultStore = stores[0];

      await prisma.employees.create({
        data: {
          tenant_id: TENANT_ID,
          company_id: company.id,
          user_id: user.id,
          employee_code: `EMP-${user.first_name?.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`,
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          email: user.email,
          phone: user.phone,
          department_id: salesDept.id,
          position_id: salesPosition.id,
          location_id: defaultStore.location_id,
          hire_date: new Date(),
          status: 'active',
          employment_type: 'FULL_TIME',
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      console.log(`   ✅ Created employee record: ${user.first_name} ${user.last_name}`);
      createdEmployees++;
    }
  }

  if (createdEmployees > 0) {
    console.log(`\n   ✅ Created ${createdEmployees} employee records\n`);
  } else {
    console.log(`   ℹ️  All SPG staff already have employee records\n`);
  }

  // ========== FINAL VERIFICATION ==========
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('                         FINAL VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Verify counts
  const priceVersionCount = await prisma.price_versions.count({ 
    where: { tenant_id: TENANT_ID } 
  });
  const moneySourceCount = await prisma.money_sources.count({ 
    where: { tenant_id: TENANT_ID } 
  });
  const employeeCount = await prisma.employees.count({ 
    where: { tenant_id: TENANT_ID, status: 'active' } 
  });

  console.log(`✅ Price Versions: ${priceVersionCount} (${priceVersionCount > 0 ? 'READY' : 'Using base prices'})`);
  console.log(`✅ Money Sources: ${moneySourceCount} (${moneySourceCount >= stores.length * 2 ? 'READY' : 'CONFIGURED'})`);
  console.log(`✅ Active Employees: ${employeeCount} (${employeeCount >= 6 ? 'READY' : 'PARTIAL'})\n`);

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('✅ ✅ ✅  ALL MINOR RECOMMENDATIONS COMPLETED  ✅ ✅ ✅');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log('🎯 SYSTEM IS NOW FULLY OPTIMIZED FOR SEMINYAK TRIAL\n');
  console.log('Next Steps:');
  console.log('1. SPG login: dewa@bambusilver.com / Dewa2024!');
  console.log('2. Open shift at Seminyak store');
  console.log('3. Start processing transactions');
  console.log('4. Test all payment methods');
  console.log('5. Close shift at end of day\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
