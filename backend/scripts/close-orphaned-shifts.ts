/**
 * Close Orphaned Shifts
 * 
 * Closes any open shifts that are blocking users from starting new shifts.
 * This happens when a shift was opened at the wrong store or session was lost.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_ID = 'tnt-3rlhko';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('                     CLOSING ORPHANED SHIFTS');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Find all open shifts
  const openShifts = await prisma.retail_shifts.findMany({
    where: {
      tenant_id: TENANT_ID,
      status: 'open',
    },
    include: {
      employees: true,
      stores: true,
    },
  });

  console.log(`Found ${openShifts.length} open shifts:\n`);

  if (openShifts.length === 0) {
    console.log('✅ No orphaned shifts found. All clean!\n');
    return;
  }

  for (const shift of openShifts) {
    console.log(`Shift ID: ${shift.id}`);
    console.log(`  Employee: ${shift.employees.first_name} ${shift.employees.last_name}`);
    console.log(`  Store: ${shift.stores.name}`);
    console.log(`  Opened: ${shift.start_time}`);
    console.log(`  Opening Cash: ${shift.opening_cash}`);
    console.log('');

    // Close the shift
    await prisma.retail_shifts.update({
      where: { id: shift.id },
      data: {
        status: 'closed',
        end_time: new Date(),
        closing_cash: shift.expected_cash || shift.opening_cash, // Use expected cash as closing
        closing_note: 'Auto-closed by system cleanup script',
        updated_at: new Date(),
      },
    });

    console.log(`  ✅ Closed shift ${shift.id.slice(-6)}\n`);
  }

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`✅ ✅ ✅  CLOSED ${openShifts.length} ORPHANED SHIFTS  ✅ ✅ ✅`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log('Users can now open new shifts at the correct store.\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
