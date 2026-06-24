/**
 * Check stores and current shifts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_ID = 'tnt-3rlhko';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('                    CHECKING STORES AND SHIFTS');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Check all stores
  const stores = await prisma.stores.findMany({
    where: { tenant_id: TENANT_ID },
    select: {
      id: true,
      name: true,
      code: true,
      location_id: true,
    },
  });

  console.log(`Found ${stores.length} stores:\n`);
  stores.forEach((store, i) => {
    console.log(`${i + 1}. ${store.name} (${store.code})`);
    console.log(`   ID: ${store.id}`);
    console.log(`   Location ID: ${store.location_id}\n`);
  });

  // Check active shifts
  const now = new Date();
  const shifts = await prisma.hr_work_shifts.findMany({
    where: {
      tenant_id: TENANT_ID,
      start_time: { lte: now },
      end_time: { gte: now },
    },
    include: {
      employees: {
        select: { first_name: true, last_name: true, email: true },
      },
      locations: {
        include: {
          stores: {
            select: { id: true, name: true, code: true },
          },
        },
      },
    },
  });

  console.log(`\nFound ${shifts.length} active shift(s):\n`);
  shifts.forEach((shift, i) => {
    const name = `${shift.employees?.first_name} ${shift.employees?.last_name}`;
    console.log(`${i + 1}. ${name} (${shift.employees?.email})`);
    console.log(`   Shift ID: ${shift.id}`);
    console.log(`   Location ID: ${shift.location_id}`);
    console.log(`   Store: ${shift.locations?.stores?.[0]?.name || 'N/A'} (${shift.locations?.stores?.[0]?.code || 'N/A'})`);
    console.log(`   Store ID: ${shift.locations?.stores?.[0]?.id || 'N/A'}`);
    console.log(`   Start: ${shift.start_time?.toISOString()}`);
    console.log(`   End: ${shift.end_time?.toISOString()}\n`);
  });

  // Check all shifts for today (regardless of active status)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayShifts = await prisma.hr_work_shifts.findMany({
    where: {
      tenant_id: TENANT_ID,
      start_time: {
        gte: today,
        lt: tomorrow,
      },
    },
    include: {
      employees: {
        select: { first_name: true, last_name: true, email: true },
      },
    },
  });

  console.log(`\nAll shifts scheduled for today: ${todayShifts.length}\n`);
  todayShifts.forEach((shift, i) => {
    const name = `${shift.employees?.first_name} ${shift.employees?.last_name}`;
    console.log(`${i + 1}. ${name} (${shift.employees?.email})`);
    console.log(`   Location ID: ${shift.location_id}`);
    console.log(`   Start: ${shift.start_time?.toISOString()}`);
    console.log(`   End: ${shift.end_time?.toISOString()}\n`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
