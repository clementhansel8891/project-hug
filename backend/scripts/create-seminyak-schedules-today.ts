/**
 * Create Work Shifts for Seminyak Store - Today
 * Fera: 8am-3pm (Morning shift)
 * Nana: 3pm-10pm (Evening shift)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_ID = 'tnt-3rlhko';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('         CREATING SEMINYAK STORE WORK SHIFTS FOR TODAY');
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
  console.log(`Creating shifts for: ${jakartaToday.toLocaleDateString('id-ID', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}\n`);

  // Fera's shift: 8am - 3pm
  const feraStart = new Date(jakartaToday);
  feraStart.setHours(8, 0, 0, 0);
  const feraEnd = new Date(jakartaToday);
  feraEnd.setHours(15, 0, 0, 0);

  // Nana's shift: 3pm - 10pm
  const nanaStart = new Date(jakartaToday);
  nanaStart.setHours(15, 0, 0, 0);
  const nanaEnd = new Date(jakartaToday);
  nanaEnd.setHours(22, 0, 0, 0);

  // Check if shifts already exist for today
  const existingShifts = await prisma.hr_work_shifts.findMany({
    where: {
      tenant_id: TENANT_ID,
      location_id: seminyakStore.location_id,
      start_time: {
        gte: jakartaToday,
        lt: new Date(jakartaToday.getTime() + 24 * 60 * 60 * 1000),
      },
      employee_id: {
        in: [fera.id, nana.id],
      },
    },
  });

  if (existingShifts.length > 0) {
    console.log(`⚠️  Found ${existingShifts.length} existing shift(s) for today`);
    console.log('   Deleting existing shifts...\n');
    
    await prisma.hr_work_shifts.deleteMany({
      where: {
        id: {
          in: existingShifts.map(s => s.id),
        },
      },
    });
  }

  // Create Fera's shift
  const feraShift = await prisma.hr_work_shifts.create({
    data: {
      tenant_id: TENANT_ID,
      company_id: seminyakStore.company_id!,
      location_id: seminyakStore.location_id!,
      employee_id: fera.id,
      schedule_id: 'manual-shift', // Placeholder - not using schedule template
      start_time: feraStart,
      end_time: feraEnd,
      notes: 'Morning shift - Seminyak POS',
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  console.log('✅ Fera Work Shift Created:');
  console.log(`   Employee: Fera (${fera.email})`);
  console.log(`   Store: ${seminyakStore.name}`);
  console.log(`   Date: ${jakartaToday.toISOString().split('T')[0]}`);
  console.log(`   Shift: MORNING (08:00 - 15:00)`);
  console.log(`   Shift ID: ${feraShift.id}\n`);

  // Create Nana's shift
  const nanaShift = await prisma.hr_work_shifts.create({
    data: {
      tenant_id: TENANT_ID,
      company_id: seminyakStore.company_id!,
      location_id: seminyakStore.location_id!,
      employee_id: nana.id,
      schedule_id: 'manual-shift', // Placeholder - not using schedule template
      start_time: nanaStart,
      end_time: nanaEnd,
      notes: 'Evening shift - Seminyak POS',
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  console.log('✅ Nana Work Shift Created:');
  console.log(`   Employee: Nana (${nana.email})`);
  console.log(`   Store: ${seminyakStore.name}`);
  console.log(`   Date: ${jakartaToday.toISOString().split('T')[0]}`);
  console.log(`   Shift: EVENING (15:00 - 22:00)`);
  console.log(`   Shift ID: ${nanaShift.id}\n`);

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('                    WORK SHIFTS CREATED SUCCESSFULLY');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log('When SPG login:');
  console.log('  • Fera logs in → System detects 8am-3pm Seminyak shift → Redirect to POS');
  console.log('  • Nana logs in → System detects 3pm-10pm Seminyak shift → Redirect to POS');
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
