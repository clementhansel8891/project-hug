import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkNanaShift() {
  try {
    // Find Nana user first
    const nanaUser = await prisma.users.findFirst({
      where: {
        email: 'nana@bambusilver.com',
      },
    });

    if (!nanaUser) {
      console.log('❌ Nana user not found');
      return;
    }

    console.log('✅ Found Nana user:', {
      id: nanaUser.id,
      email: nanaUser.email,
      tenant_id: nanaUser.tenant_id,
    });

    // Find Nana employee record
    const nana = await prisma.employees.findFirst({
      where: {
        user_id: nanaUser.id,
      },
    });

    if (!nana) {
      console.log('❌ Nana employee record not found for user_id:', nanaUser.id);
      return;
    }

    console.log('✅ Found Nana employee:', {
      id: nana.id,
      user_id: nana.user_id,
      tenant_id: nana.tenant_id,
    });

    // Find Nana's shift today
    const today = new Date('2026-06-24T00:00:00Z');
    const tomorrow = new Date('2026-06-25T00:00:00Z');

    const shifts = await prisma.hr_work_shifts.findMany({
      where: {
        employee_id: nana.id,
        start_time: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        locations: {
          include: {
            stores: true,
          },
        },
      },
    });

    console.log(`\n📅 Found ${shifts.length} shift(s) for Nana on 2026-06-24:`);
    
    for (const shift of shifts) {
      console.log('\n--- Shift Details ---');
      console.log('Shift ID:', shift.id);
      console.log('Location ID:', shift.location_id);
      console.log('Location Name:', shift.locations?.name);
      console.log('Start Time:', shift.start_time);
      console.log('End Time:', shift.end_time);
      console.log('Stores at location:', shift.locations?.stores?.length || 0);
      
      if (shift.locations?.stores) {
        shift.locations.stores.forEach((store: any) => {
          console.log(`  - Store: ${store.name} (${store.code}) - ID: ${store.id}`);
        });
      }
    }

    // Check if there are any active retail shifts for Nana
    if (nana.user_id) {
      const activeRetailShifts = await prisma.retail_shifts.findMany({
        where: {
          employee_id: nana.user_id,
          status: 'open',
        },
      });

      console.log(`\n🏪 Active retail shifts for Nana: ${activeRetailShifts.length}`);
      
      for (const shift of activeRetailShifts) {
        console.log('\n--- Active Retail Shift ---');
        console.log('Shift ID:', shift.id);
        console.log('Store ID:', shift.store_id);
        console.log('Start Time:', shift.start_time);
        console.log('End Time:', shift.end_time);
        
        // Get store details separately
        const store = await prisma.stores.findUnique({
          where: { id: shift.store_id },
        });
        console.log('Store Name:', store?.name);
        console.log('Store Location ID:', store?.location_id);
      }
    }

    // Check locations
    const seminyakLocation = await prisma.locations.findUnique({
      where: { id: 'a3a241a4-4841-45a3-90cd-f7135e6847b4' },
    });

    const wrongLocation = await prisma.locations.findUnique({
      where: { id: 'a370e7ca-c1f7-4180-8824-846eaa6a3c8e' },
    });

    console.log('\n📍 Location Check:');
    console.log('Seminyak (correct):', seminyakLocation?.name, '- ID:', seminyakLocation?.id);
    console.log('Wrong location:', wrongLocation?.name, '- ID:', wrongLocation?.id);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNanaShift();
