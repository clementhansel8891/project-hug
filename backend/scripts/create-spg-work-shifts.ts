/**
 * Create Work Shifts for SPG Staff at Seminyak Store
 * 
 * Creates employee records and work schedules for Fera and Nana
 * so they can be routed to the correct store when logging in.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_ID = 'tnt-3rlhko';
const COMPANY_ID = 'b74e21b9-4e99-42fd-857b-36bf4dee7ed5'; // Bambu Silver
const SEMINYAK_STORE_ID = 'f6ec35ea-b90c-46cf-ad39-4429f7d48c6e';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('        CREATING SPG WORK SHIFTS FOR SEMINYAK STORE');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Get Seminyak store
  const seminyakStore = await prisma.stores.findUnique({
    where: { id: SEMINYAK_STORE_ID },
    include: { locations: true },
  });

  if (!seminyakStore) {
    throw new Error('Seminyak store not found');
  }

  console.log(`Store: ${seminyakStore.name} (${seminyakStore.code})`);
  console.log(`Location: ${seminyakStore.locations.name} (${seminyakStore.location_id})\n`);

  // Get Fera and Nana users
  const spgUsers = await prisma.users.findMany({
    where: {
      tenant_id: TENANT_ID,
      email: {
        in: ['fera@bambusilver.com', 'nana@bambusilver.com'],
      },
    },
  });

  console.log(`Found ${spgUsers.length} SPG users:`);
  spgUsers.forEach(u => console.log(`  - ${u.first_name} ${u.last_name} (${u.email})`));
  console.log('');

  // ========== 1. CREATE SALES DEPARTMENT ==========
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
        company_id: COMPANY_ID,
        name: 'Sales',
        code: 'SALES',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    console.log('✅ Created Sales department\n');
  } else {
    console.log('ℹ️  Sales department already exists\n');
  }

  // ========== 2. CREATE SALES POSITION ==========
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
        company_id: COMPANY_ID,
        location_id: seminyakStore.location_id,
        department_id: salesDept.id,
        title: 'Sales Associate',
        grade: 'STAFF',
        status: 'open',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    console.log('✅ Created Sales Associate position\n');
  } else {
    console.log('ℹ️  Sales Associate position already exists\n');
  }

  // ========== 3. CREATE EMPLOYEE RECORDS ==========
  console.log('👥 CREATING EMPLOYEE RECORDS');
  console.log('─────────────────────────────────────────────────────────────────────\n');

  const employees = [];

  for (const user of spgUsers) {
    let employee = await prisma.employees.findFirst({
      where: {
        tenant_id: TENANT_ID,
        user_id: user.id,
      },
    });

    if (!employee) {
      employee = await prisma.employees.create({
        data: {
          tenant_id: TENANT_ID,
          company_id: COMPANY_ID,
          user_id: user.id,
          employee_code: `EMP-${user.first_name?.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`,
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          email: user.email,
          phone: user.phone || '',
          department_id: salesDept.id,
          positions: salesPosition.id,
          location_id: seminyakStore.location_id,
          hire_date: new Date(),
          status: 'active',
          employment_type: 'full_time',
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
      console.log(`   ✅ Created employee: ${employee.first_name} ${employee.last_name}`);
    } else {
      console.log(`   ℹ️  Employee exists: ${employee.first_name} ${employee.last_name}`);
    }

    employees.push(employee);
  }

  console.log('');

  // ========== 4. CREATE WORK SCHEDULE ==========
  console.log('📅 CREATING WORK SCHEDULES');
  console.log('─────────────────────────────────────────────────────────────────────\n');

  // Create recurring schedule for the week
  for (const employee of employees) {
    const userName = spgUsers.find(u => u.id === employee.user_id);
    
    // Determine shift times based on employee
    const isFera = userName?.email === 'fera@bambusilver.com';
    const shiftName = isFera ? 'Morning Shift' : 'Afternoon Shift';
    
    // Fera: 8am-3pm Jakarta (01:00-08:00 UTC)
    // Nana: 3pm-10pm Jakarta (08:00-15:00 UTC)
    const startHourUTC = isFera ? 1 : 8;
    const endHourUTC = isFera ? 8 : 15;

    // Check if schedule already exists
    const existingSchedule = await prisma.hr_work_schedules.findFirst({
      where: {
        tenant_id: TENANT_ID,
        name: `${employee.first_name} - ${shiftName}`,
      },
    });

    if (existingSchedule) {
      console.log(`   ℹ️  Schedule exists: ${employee.first_name} - ${shiftName}`);
      continue;
    }

    // Create schedule
    const schedule = await prisma.hr_work_schedules.create({
      data: {
        tenant_id: TENANT_ID,
        company_id: COMPANY_ID,
        name: `${employee.first_name} - ${shiftName}`,
        type: 'WEEKLY',
        status: 'active',
        start_date: new Date('2026-06-01'),
        end_date: new Date('2026-12-31'),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Create work shifts for each day (Monday to Sunday)
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const shiftDate = new Date('2026-06-23'); // Monday, June 23, 2026
      shiftDate.setDate(shiftDate.getDate() + dayOffset);
      
      const startTime = new Date(shiftDate);
      startTime.setUTCHours(startHourUTC, 0, 0, 0);
      
      const endTime = new Date(shiftDate);
      endTime.setUTCHours(endHourUTC, 0, 0, 0);

      await prisma.hr_work_shifts.create({
        data: {
          tenant_id: TENANT_ID,
          company_id: COMPANY_ID,
          schedule_id: schedule.id,
          employee_id: employee.id,
          location_id: seminyakStore.location_id,
          start_time: startTime,
          end_time: endTime,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }

    console.log(`   ✅ Created schedule: ${employee.first_name} - ${shiftName}`);
    console.log(`      Time: ${startHourUTC}:00-${endHourUTC}:00 UTC (${isFera ? '8am-3pm' : '3pm-10pm'} Jakarta)`);
    console.log(`      Days: Monday to Sunday`);
  }

  console.log('');

  // ========== FINAL VERIFICATION ==========
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('                         FINAL VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  for (const employee of employees) {
    const shifts = await prisma.hr_work_shifts.findMany({
      where: {
        tenant_id: TENANT_ID,
        employee_id: employee.id,
      },
      include: {
        locations: true,
      },
    });

    const userName = spgUsers.find(u => u.id === employee.user_id);
    console.log(`${employee.first_name} ${employee.last_name}:`);
    console.log(`  Email: ${userName?.email}`);
    console.log(`  Shifts: ${shifts.length}`);
    console.log(`  Location: ${shifts[0]?.locations?.name || 'N/A'}`);
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('✅ ✅ ✅  WORK SHIFTS CREATED SUCCESSFULLY  ✅ ✅ ✅');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log('🎯 SPG staff can now login and be routed to Seminyak store\n');
  console.log('Next Steps:');
  console.log('1. Fera login: fera@bambusilver.com / Fera2024!');
  console.log('2. Should redirect to POS with Seminyak store context');
  console.log('3. Initialize shift and start transactions');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
