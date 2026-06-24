/**
 * Create Work Shifts for SPG Staff - Today and Future
 * 
 * Creates recurring work shifts starting from today
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_ID = 'tnt-3rlhko';
const COMPANY_ID = 'b74e21b9-4e99-42fd-857b-36bf4dee7ed5';
const SEMINYAK_LOCATION = 'a3a241a4-4841-45a3-90cd-f7135e6847b4';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('         CREATING WORK SHIFTS FOR TODAY AND NEXT 30 DAYS');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Get SPG users
  const spgUsers = await prisma.users.findMany({
    where: {
      tenant_id: TENANT_ID,
      email: { in: ['fera@bambusilver.com', 'nana@bambusilver.com'] },
    },
  });

  console.log(`Found ${spgUsers.length} SPG users\n`);

  // Get Sales department
  let salesDept = await prisma.departments.findFirst({
    where: { tenant_id: TENANT_ID, name: 'Sales' },
  });

  if (!salesDept) {
    salesDept = await prisma.departments.create({
      data: {
        tenant_id: TENANT_ID,
        company_id: COMPANY_ID,
        name: 'Sales',
        code: 'SALES',
        status: 'active',
      },
    });
  }

  for (const user of spgUsers) {
    // Get or create employee
    let employee = await prisma.employees.findFirst({
      where: { tenant_id: TENANT_ID, user_id: user.id },
    });

    if (!employee) {
      // Get position
      let position = await prisma.positions.findFirst({
        where: { tenant_id: TENANT_ID, title: 'Sales Associate' },
      });

      if (!position) {
        position = await prisma.positions.create({
          data: {
            tenant_id: TENANT_ID,
            company_id: COMPANY_ID,
            location_id: SEMINYAK_LOCATION,
            department_id: salesDept.id,
            title: 'Sales Associate',
            grade: 'STAFF',
            status: 'open',
          },
        });
      }

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
          positions: position.id,
          location_id: SEMINYAK_LOCATION,
          hire_date: new Date(),
          status: 'active',
          employment_type: 'full_time',
        },
      });
    }

    const isFera = user.email === 'fera@bambusilver.com';
    const shiftName = isFera ? 'Morning Shift' : 'Afternoon Shift';
    const startHourUTC = isFera ? 1 : 8;  // Fera: 8am Jakarta = 1am UTC, Nana: 3pm Jakarta = 8am UTC
    const endHourUTC = isFera ? 8 : 15;   // Fera: 3pm Jakarta = 8am UTC, Nana: 10pm Jakarta = 3pm UTC

    console.log(`\nCreating shifts for ${user.first_name} (${shiftName})...`);

    // Delete old shifts
    await prisma.hr_work_shifts.deleteMany({
      where: {
        tenant_id: TENANT_ID,
        employee_id: employee.id,
      },
    });

    // Get or create schedule
    let schedule = await prisma.hr_work_schedules.findFirst({
      where: {
        tenant_id: TENANT_ID,
        name: `${user.first_name} - ${shiftName}`,
      },
    });

    if (!schedule) {
      schedule = await prisma.hr_work_schedules.create({
        data: {
          tenant_id: TENANT_ID,
          company_id: COMPANY_ID,
          department_id: salesDept.id,
          created_by: user.id,
          name: `${user.first_name} - ${shiftName}`,
          status: 'active',
          start_date: new Date(),
          end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        },
      });
    }

    // Create shifts for next 30 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const shiftDate = new Date(today);
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
          location_id: SEMINYAK_LOCATION,
          start_time: startTime,
          end_time: endTime,
        },
      });
    }

    console.log(`  ✅ Created 30 days of shifts`);
    console.log(`     Time: ${startHourUTC}:00-${endHourUTC}:00 UTC (${isFera ? '8am-3pm' : '3pm-10pm'} Jakarta)`);
  }

  // Verify
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('                           VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  for (const user of spgUsers) {
    const employee = await prisma.employees.findFirst({
      where: { tenant_id: TENANT_ID, user_id: user.id },
    });

    if (employee) {
      const shifts = await prisma.hr_work_shifts.findMany({
        where: { tenant_id: TENANT_ID, employee_id: employee.id },
        orderBy: { start_time: 'asc' },
        take: 3,
      });

      console.log(`${user.first_name}:`);
      console.log(`  Employee ID: ${employee.id}`);
      console.log(`  Total shifts: ${shifts.length}`);
      console.log(`  First shift: ${shifts[0]?.start_time}`);
      console.log(`  Location: Seminyak`);
      console.log('');
    }
  }

  console.log('✅ ✅ ✅  WORK SHIFTS CREATED  ✅ ✅ ✅\n');
}

main()
  .catch(e => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
