/**
 * Migrate Bambu Silver Users to Correct Tenant
 * 
 * Issue: Users were created in tenant tnt-pfzurx (empty)
 * Solution: Move them to tenant tnt-3rlhko (has 10k+ products and all stores)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SOURCE_TENANT = 'tnt-pfzurx';  // Wrong tenant (empty)
const TARGET_TENANT = 'tnt-3rlhko';  // Correct tenant (has products & stores)

const USER_EMAILS = [
  'estela@bambusilver.com',
  'hansel@bambusilver.com',
  'ayi@bambusilver.com',
  'dewi.alan@bambusilver.com',
  'dewa@bambusilver.com',
  'dewi@bambusilver.com',
  'gusti@bambusilver.com',
  'nyoman@bambusilver.com',
  'nana@bambusilver.com',
  'fera@bambusilver.com',
];

async function main() {
  console.log('🔄 Starting user migration to correct tenant...\n');

  // Verify target tenant exists
  const targetTenant = await prisma.tenants.findUnique({
    where: { id: TARGET_TENANT },
  });

  if (!targetTenant) {
    throw new Error(`Target tenant ${TARGET_TENANT} not found!`);
  }

  console.log(`✅ Target tenant: ${targetTenant.name} (${TARGET_TENANT})\n`);

  // Get target tenant's company
  const targetCompany = await prisma.companies.findFirst({
    where: { tenant_id: TARGET_TENANT },
  });

  if (!targetCompany) {
    throw new Error(`No company found for tenant ${TARGET_TENANT}`);
  }

  console.log(`✅ Target company: ${targetCompany.name} (${targetCompany.id})\n`);

  // Migrate each user
  let migratedCount = 0;
  const results: Array<{ email: string; status: string }> = [];

  for (const email of USER_EMAILS) {
    try {
      // Find user in source tenant
      const user = await prisma.users.findFirst({
        where: {
          email,
          tenant_id: SOURCE_TENANT,
        },
      });

      if (!user) {
        console.log(`   ⚠️  User ${email} not found in source tenant`);
        results.push({ email, status: 'NOT_FOUND' });
        continue;
      }

      // Check if user already exists in target tenant
      const existingInTarget = await prisma.users.findFirst({
        where: {
          email,
          tenant_id: TARGET_TENANT,
        },
      });

      if (existingInTarget) {
        console.log(`   ℹ️  User ${email} already exists in target tenant`);
        results.push({ email, status: 'ALREADY_EXISTS' });
        continue;
      }

      // Update user's tenant_id and company_id
      await prisma.users.update({
        where: { id: user.id },
        data: {
          tenant_id: TARGET_TENANT,
          company_id: targetCompany.id,
        },
      });

      // Update user_companies association
      await prisma.user_companies.updateMany({
        where: {
          user_id: user.id,
          tenant_id: SOURCE_TENANT,
        },
        data: {
          tenant_id: TARGET_TENANT,
          company_id: targetCompany.id,
        },
      });

      console.log(`   ✅ Migrated: ${user.first_name} ${user.last_name} (${email})`);
      results.push({ email, status: 'MIGRATED' });
      migratedCount++;
    } catch (error: any) {
      console.error(`   ❌ Error migrating ${email}:`, error.message);
      results.push({ email, status: `ERROR: ${error.message}` });
    }
  }

  console.log(`\n✅ Migration completed: ${migratedCount} users migrated\n`);

  // Generate summary report
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('                     MIGRATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Source Tenant: ${SOURCE_TENANT} (Clement's Organization)`);
  console.log(`Target Tenant: ${TARGET_TENANT} (${targetTenant.name})`);
  console.log(`Target Company: ${targetCompany.name}`);
  console.log('');
  console.log('User Migration Results:');
  results.forEach((r, idx) => {
    const icon = r.status === 'MIGRATED' ? '✅' : r.status === 'ALREADY_EXISTS' ? 'ℹ️' : '⚠️';
    console.log(`${idx + 1}. ${icon} ${r.email} - ${r.status}`);
  });
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('🎯 NEXT STEPS:');
  console.log('1. Test login with any user (e.g., hansel@bambusilver.com)');
  console.log('2. Verify access to stores: Double Six, Sahadewa, Seminyak, SS, Anchor');
  console.log('3. Verify product catalog shows 10,000+ products');
  console.log('4. Open shift and test POS transactions');
  console.log('');
  console.log('Login URL: http://150.109.15.108:3010');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Migration Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
