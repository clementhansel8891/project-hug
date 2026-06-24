/**
 * Create Schedules for Seminyak Store - Today
 * Fera: 8am-3pm (Morning shift)
 * Nana: 3pm-10pm (Evening shift)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_ID = 'tnt-3rlhko';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('         CREATING SEMINYAK STORE SCHEDULES FOR TODAY');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Get Seminyak store
  const seminyakStore = await prisma.stores.findFirst({
    where: {
      tenant_id: TENANT_ID,
      code: 'BS-03',
    },
  });

  if (!seminyakStore) {
    throw new Error('Seminyak store not found');
  }

  console.log(`Store: ${seminyakStore.name} (${seminyakStore.code})`);
  console.log(`Location ID: ${seminyakStore.location_id}\n`);

  // Get Fera and Nana employees
  const fera = await prisma.employees.findFirst({
    where: {
      tenant_id: TENANT_ID,
      email: 'fera@bambusilver.com',
    },
  });

  const nana = await prisma.employees.findFirst({
    where: {
      tenant_id: TENANT_ID,
      email: 'nana@bambusilver.com',
    },
  });

  if (!fera || !nana) {
    throw new Error('Fera or Nana employee record not found');
  }

  console.log(`Fera Employee ID: ${fera.id}`);
  console.log(`Nana Employee ID: ${nana.id}\n`);

  // Get today's date in Jakarta timezone
  const today = new Date();
  const jakartaOffset = 7 * 60; // UTC+7 in minutes
  const localOffset = today.getTimezoneOffset();
  const offsetDiff = jakartaOffset + localOffset;
  
  const jakartaToday = new Date(today.getTime() + offsetDiff * 60 * 1000);
  jakartaToday.setHours(0, 0, 0, 0);

  console.log(`Today (Jakarta): ${jakartaToday.toISOString().split('T')[0]}`);
  console.log(`Creating schedules for: ${jakartaToday.toLocaleDateString('id-ID', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}\n`);

  // Fera's schedule: 8am - 3pm
  const feraStart = new Date(jakartaToday);
  feraStart.setHours(8, 0, 0, 0);
  const feraEnd = new Date(jakartaToday);
  feraEnd.setHours(15, 0, 0, 0);

  // Nana's schedule: 3pm - 10pm
  const nanaStart = new Date(jakartaToday);
  nanaStart.setHours(15, 0, 0, 0);
  const nanaEnd = new Date(jakartaToday);
  nanaEnd.setHours(22, 0, 0, 0);

  // Check if schedules already exist for today
  const existingSchedules = await prisma.hr_schedules.findMany({
    where: {
      tenant_id: TENANT_ID,
      location_id: seminyakStore.location_id,
      date: {
        gte: jakartaToday,
        lt: new Date(jakartaToday.getTime() + 24 * 60 * 60 * 1000),
      },
      employee_id: {
        in: [fera.id, nana.id],
      },
    },
  });

  if (existingSchedules.length > 0) {
    console.log(`⚠️  Found ${existingSchedules.length} existing schedule(s) for today`);
    console.log('   Deleting existing schedules...\n');
    
    await prisma.hr_schedules.deleteMany({
      where: {
        id: {
          in: existingSchedules.map(s => s.id),
        },
      },
    });
  }

  // Create Fera's schedule
  const feraSchedule = await prisma.hr_schedules.create({
    data: {
      tenant_id: TENANT_ID,
      company_id: seminyakStore.company_id!,
      location_id: seminyakStore.location_id!,
      employee_id: fera.id,
      date: jakartaToday,
      start_time: feraStart,
      end_time: feraEnd,
      shift_type: 'MORNING',
      status: 'CONFIRMED',
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  console.log('✅ Fera Schedule Created:');
  console.log(`   Employee: Fera (${fera.email})`);
  console.log(`   Store: ${seminyakStore.name}`);
  console.log(`   Date: ${jakartaToday.toISOString().split('T')[0]}`);
  console.log(`   Shift: MORNING (08:00 - 15:00)`);
  console.log(`   Status: CONFIRMED\n`);

  // Create Nana's schedule
  const nanaSchedule = await prisma.hr_schedules.create({
    data: {
      tenant_id: TENANT_ID,
      company_id: seminyakStore.company_id!,
      location_id: seminyakStore.location_id!,
      employee_id: nana.id,
      date: jakartaToday,
      start_time: nanaStart,
      end_time: nanaEnd,
      shift_type: 'EVENING',
      status: 'CONFIRMED',
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  console.log('✅ Nana Schedule Created:');
  console.log(`   Employee: Nana (${nana.email})`);
  console.log(`   Store: ${seminyakStore.name}`);
  console.log(`   Date: ${jakartaToday.toISOString().split('T')[0]}`);
  console.log(`   Shift: EVENING (15:00 - 22:00)`);
  console.log(`   Status: CONFIRMED\n`);

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('                    SCHEDULES CREATED SUCCESSFULLY');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log('When SPG login:');
  console.log('  • Fera logs in → System detects 8am-3pm Seminyak schedule → Redirect to POS');
  console.log('  • Nana logs in → System detects 3pm-10pm Seminyak schedule → Redirect to POS');
  console.log('  • POS context automatically set to Seminyak store');
  console.log('  • All activities tracked under correct employee + store\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
