/**
 * Move E2E test stores to separate location
 * Keep Seminyak location clean for production use
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_ID = 'tnt-3rlhko';
const SEMINYAK_LOCATION = 'a3a241a4-4841-45a3-90cd-f7135e6847b4';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('              CLEANING E2E STORES FROM SEMINYAK LOCATION');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Find or create E2E test location
  let e2eLocation = await prisma.locations.findFirst({
    where: {
      tenant_id: TENANT_ID,
      code: 'E2E-TEST',
    },
  });

  if (!e2eLocation) {
    e2eLocation = await prisma.locations.create({
      data: {
        tenant_id: TENANT_ID,
        name: 'E2E Test Location',
        code: 'E2E-TEST',
        type: 'test',
        address: 'Test Environment',
        country: 'ID',
        currency: 'IDR',
      },
    });
    console.log(`✅ Created E2E test location: ${e2eLocation.id}\n`);
  } else {
    console.log(`ℹ️  E2E test location exists: ${e2eLocation.id}\n`);
  }

  // Find all E2E stores at Seminyak
  const e2eStores = await prisma.stores.findMany({
    where: {
      tenant_id: TENANT_ID,
      location_id: SEMINYAK_LOCATION,
      OR: [
        { name: { contains: 'E2E-' } },
        { name: { contains: 'E2E ' } },
        { code: { contains: 'E2E' } },
      ],
    },
  });

  console.log(`Found ${e2eStores.length} E2E stores at Seminyak location:\n`);

  // Move them to E2E location
  for (const store of e2eStores) {
    await prisma.stores.update({
      where: { id: store.id },
      data: { location_id: e2eLocation.id },
    });
    console.log(`  ✅ Moved: ${store.name} → E2E Test Location`);
  }

  console.log(`\n✅ Moved ${e2eStores.length} E2E stores to test location\n`);

  // Verify Seminyak now has only real stores
  const realStores = await prisma.stores.findMany({
    where: {
      tenant_id: TENANT_ID,
      location_id: SEMINYAK_LOCATION,
      deleted_at: null,
    },
  });

  console.log(`Stores remaining at Seminyak location: ${realStores.length}`);
  realStores.forEach(s => {
    console.log(`  - ${s.name} (${s.code})`);
  });
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('✅ ✅ ✅  SEMINYAK LOCATION CLEANED  ✅ ✅ ✅');
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
