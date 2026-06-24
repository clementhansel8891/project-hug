/**
 * Emergency Fix for Fera Session
 * 
 * Closes broken shifts and clears session issues
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const FERA_USER_ID = 'cb49c5ae-1871-48a7-af23-ca01132ccfb3';
const TENANT_ID = 'tnt-3rlhko';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('                  EMERGENCY FIX - FERA SESSION');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // 1. Find Fera's employee record
  const employee = await prisma.employees.findFirst({
    where: {
      user_id: FERA_USER_ID,
      tenant_id: TENANT_ID,
    },
  });

  if (!employee) {
    console.log('❌ Fera employee record not found');
    return;
  }

  console.log(`Employee: ${employee.first_name} ${employee.last_name}`);
  console.log(`Employee ID: ${employee.id}\n`);

  // 2. Close all open shifts for Fera
  const openShifts = await prisma.retail_shifts.findMany({
    where: {
      employee_id: employee.id,
      tenant_id: TENANT_ID,
      status: 'open',
    },
    include: {
      stores: true,
    },
  });

  console.log(`Found ${openShifts.length} open shifts:\n`);

  for (const shift of openShifts) {
    console.log(`Shift ID: ${shift.id}`);
    console.log(`  Store: ${shift.stores.name}`);
    console.log(`  Opened: ${shift.start_time}`);
    console.log(`  Opening Cash: ${shift.opening_cash}\n`);

    await prisma.retail_shifts.update({
      where: { id: shift.id },
      data: {
        status: 'closed',
        end_time: new Date(),
        closing_cash: shift.expected_cash || shift.opening_cash,
        closing_note: 'Emergency closed by system - location mismatch fix',
        updated_at: new Date(),
      },
    });

    console.log(`  ✅ Closed shift ${shift.id.slice(-6)}\n`);
  }

  // 3. Check work shifts configuration
  console.log('Work Shifts Configuration:');
  const workShifts = await prisma.hr_work_shifts.findMany({
    where: {
      employee_id: employee.id,
      tenant_id: TENANT_ID,
    },
    include: {
      locations: {
        include: {
          stores: true,
        },
      },
    },
    orderBy: { start_time: 'asc' },
    take: 1,
  });

  if (workShifts.length > 0) {
    const ws = workShifts[0];
    console.log(`  Location: ${ws.locations?.name} (${ws.location_id})`);
    console.log(`  Store at location: ${ws.locations?.stores?.[0]?.name || 'None'}`);
    console.log(`  Schedule: ${ws.start_time} to ${ws.end_time}\n`);
  } else {
    console.log(`  ⚠️  No work shifts found!\n`);
  }

  // 4. Verify stores at Seminyak location
  const seminyakStores = await prisma.stores.findMany({
    where: {
      tenant_id: TENANT_ID,
      location_id: 'a3a241a4-4841-45a3-90cd-f7135e6847b4', // Seminyak
      deleted_at: null,
    },
  });

  console.log(`Stores at Seminyak location: ${seminyakStores.length}`);
  seminyakStores.forEach(s => {
    console.log(`  - ${s.name} (${s.code}) [${s.id}]`);
  });
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('✅ ✅ ✅  EMERGENCY FIX COMPLETED  ✅ ✅ ✅');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log('Next steps:');
  console.log('1. Fera should clear browser cache');
  console.log('2. Fera logs out and logs in again');
  console.log('3. Should be routed to Seminyak POS');
  console.log('4. Can open fresh shift\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
