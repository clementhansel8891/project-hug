import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixNanaShift() {
  try {
    console.log('🔍 Finding Nana...');
    
    // Find Nana
    const nana = await prisma.users.findFirst({
      where: { email: 'nana@bambusilver.com' },
    });

    if (!nana) {
      console.log('❌ Nana not found');
      return;
    }

    console.log('✅ Found Nana:', nana.id);

    // Find all open retail shifts for Nana
    const openShifts = await prisma.retail_shifts.findMany({
      where: {
        employee_id: nana.id,
        status: 'open',
      },
      include: {
        stores: true,
      },
    });

    console.log(`\n📊 Found ${openShifts.length} open shift(s) for Nana`);

    for (const shift of openShifts) {
      console.log('\n--- Orphaned Shift ---');
      console.log('Shift ID:', shift.id);
      console.log('Store ID:', shift.store_id);
      console.log('Store Name:', (shift as any).stores?.name || 'Unknown');
      console.log('Store Location:', (shift as any).stores?.location_id || 'Unknown');
      console.log('Opened At:', shift.start_time);

      // Close this shift
      console.log('\n🔧 Closing orphaned shift...');
      
      await prisma.retail_shifts.update({
        where: { id: shift.id },
        data: {
          status: 'closed',
          end_time: new Date(),
          closed_by_id: nana.id,
          updated_at: new Date(),
        },
      });

      console.log('✅ Shift closed successfully');
    }

    // Now check the expected location for Seminyak
    const seminyakStore = await prisma.stores.findFirst({
      where: {
        code: 'BS-03',
        tenant_id: nana.tenant_id,
      },
    });

    if (seminyakStore) {
      console.log('\n📍 Correct Seminyak Store:');
      console.log('Store ID:', seminyakStore.id);
      console.log('Store Name:', seminyakStore.name);
      console.log('Location ID:', seminyakStore.location_id);
      console.log('Company ID:', seminyakStore.company_id);
    }

    // Check Nana's work shift for today
    const today = new Date('2026-06-24T00:00:00Z');
    const tomorrow = new Date('2026-06-25T00:00:00Z');

    const employee = await prisma.employees.findFirst({
      where: {
        user_id: nana.id,
        tenant_id: nana.tenant_id,
      },
    });

    if (employee) {
      const workShifts = await prisma.hr_work_shifts.findMany({
        where: {
          employee_id: employee.id,
          start_time: {
            gte: today,
            lt: tomorrow,
          },
        },
        include: {
          locations: true,
        },
      });

      console.log(`\n📅 Work shifts for Nana today: ${workShifts.length}`);
      
      for (const ws of workShifts) {
        console.log('\n--- Work Shift ---');
        console.log('Shift ID:', ws.id);
        console.log('Location ID:', ws.location_id);
        console.log('Location Name:', ws.locations?.name);
        console.log('Start Time:', ws.start_time);
        console.log('End Time:', ws.end_time);
      }
    } else {
      console.log('\n❌ No employee record found for Nana');
    }

    console.log('\n✅ Done! Nana should now be able to login and open a shift at the correct location.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixNanaShift();
