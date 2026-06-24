/**
 * Bambu Silver Tenant Data Cleanup & Seeding Script
 * 
 * Purpose:
 * - Clean up unwanted data for tenant Bambu Silver
 * - Set up proper branches: Double Six, Sahadewa, Seminyak, SS Anchor
 * - Create user accounts with proper roles
 * - Generate login credentials report
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Tenant identifier for Bambu Silver
const TENANT_ID = 'tnt-pfzurx';
const COMPANY_NAME = 'Bambu Silver';

// Branch definitions
const BRANCHES = [
  { code: 'DBL-SIX', name: 'Double Six', address: 'Jl. Double Six, Seminyak, Bali' },
  { code: 'SAHADEWA', name: 'Sahadewa', address: 'Jl. Sahadewa, Denpasar, Bali' },
  { code: 'SEMINYAK', name: 'Seminyak', address: 'Jl. Seminyak, Bali' },
  { code: 'SS-ANCHOR', name: 'SS Anchor', address: 'Sunset Strip, Seminyak, Bali' },
];

// User definitions with roles
const USERS = [
  {
    email: 'estela@bambusilver.com',
    password: 'Estela2024!',
    firstName: 'Estela',
    lastName: 'Owner',
    role: 'OWNER',
    phone: '+62812345001',
  },
  {
    email: 'hansel@bambusilver.com',
    password: 'Hansel2024!',
    firstName: 'Hansel',
    lastName: 'Superadmin',
    role: 'SUPERADMIN',
    phone: '+62812345002',
  },
  {
    email: 'ayi@bambusilver.com',
    password: 'Ayi2024!',
    firstName: 'Ayi',
    lastName: 'Admin',
    role: 'ADMIN',
    phone: '+62812345003',
  },
  {
    email: 'dewi.alan@bambusilver.com',
    password: 'Dewi2024!',
    firstName: 'Dewi',
    lastName: 'Alan',
    role: 'ADMIN',
    phone: '+62812345004',
  },
  // Sales team
  {
    email: 'dewa@bambusilver.com',
    password: 'Dewa2024!',
    firstName: 'Dewa',
    lastName: 'Sales',
    role: 'EMPLOYEE',
    phone: '+62812345005',
  },
  {
    email: 'dewi@bambusilver.com',
    password: 'DewiS2024!',
    firstName: 'Dewi',
    lastName: 'Sales',
    role: 'EMPLOYEE',
    phone: '+62812345006',
  },
  {
    email: 'gusti@bambusilver.com',
    password: 'Gusti2024!',
    firstName: 'Gusti',
    lastName: 'Sales',
    role: 'EMPLOYEE',
    phone: '+62812345007',
  },
  {
    email: 'nyoman@bambusilver.com',
    password: 'Nyoman2024!',
    firstName: 'Nyoman',
    lastName: 'Sales',
    role: 'EMPLOYEE',
    phone: '+62812345008',
  },
  {
    email: 'nana@bambusilver.com',
    password: 'Nana2024!',
    firstName: 'Nana',
    lastName: 'Sales',
    role: 'EMPLOYEE',
    phone: '+62812345009',
  },
  {
    email: 'fera@bambusilver.com',
    password: 'Fera2024!',
    firstName: 'Fera',
    lastName: 'Sales',
    role: 'EMPLOYEE',
    phone: '+62812345010',
  },
];

async function main() {
  console.log('🚀 Starting Bambu Silver data cleanup and seeding...\n');

  // ===== STEP 1: Verify tenant exists =====
  console.log('📋 Step 1: Verifying tenant...');
  const tenant = await prisma.tenants.findUnique({
    where: { id: TENANT_ID },
  });

  if (!tenant) {
    throw new Error(`Tenant ${TENANT_ID} not found!`);
  }
  console.log(`✅ Found tenant: ${tenant.name}\n`);

  // ===== STEP 2: Get the main company =====
  console.log('📋 Step 2: Finding main company...');
  const company = await prisma.companies.findFirst({
    where: {
      tenant_id: TENANT_ID,
      name: COMPANY_NAME,
    },
  });

  if (!company) {
    throw new Error(`Company ${COMPANY_NAME} not found for tenant ${TENANT_ID}`);
  }
  console.log(`✅ Found company: ${company.name} (${company.id})\n`);

  // ===== STEP 3: Clean up unwanted branches =====
  console.log('📋 Step 3: Cleaning up unwanted branches...');
  const wantedBranchCodes = BRANCHES.map(b => b.code);
  
  const unwantedBranches = await prisma.branches.findMany({
    where: {
      tenant_id: TENANT_ID,
      code: { notIn: wantedBranchCodes },
    },
  });

  if (unwantedBranches.length > 0) {
    console.log(`   Found ${unwantedBranches.length} unwanted branches to remove:`);
    unwantedBranches.forEach(b => console.log(`   - ${b.name} (${b.code})`));
    
    // Delete related data first (locations, retail locations, etc.)
    for (const branch of unwantedBranches) {
      await prisma.locations.deleteMany({
        where: { branch_id: branch.id },
      });
      
      await prisma.retail_locations.deleteMany({
        where: { branch_id: branch.id },
      });
    }
    
    await prisma.branches.deleteMany({
      where: {
        tenant_id: TENANT_ID,
        code: { notIn: wantedBranchCodes },
      },
    });
    console.log(`   ✅ Removed ${unwantedBranches.length} unwanted branches\n`);
  } else {
    console.log('   ✅ No unwanted branches found\n');
  }

  // ===== STEP 4: Create or update branches =====
  console.log('📋 Step 4: Setting up branches...');
  const createdBranches = [];
  
  for (const branchDef of BRANCHES) {
    const existing = await prisma.branches.findFirst({
      where: {
        tenant_id: TENANT_ID,
        code: branchDef.code,
      },
    });

    if (existing) {
      console.log(`   ℹ️  Branch ${branchDef.name} already exists`);
      createdBranches.push(existing);
    } else {
      const branch = await prisma.branches.create({
        data: {
          tenant_id: TENANT_ID,
          company_id: company.id,
          code: branchDef.code,
          name: branchDef.name,
          address: branchDef.address,
          status: 'ACTIVE',
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
      console.log(`   ✅ Created branch: ${branch.name} (${branch.code})`);
      createdBranches.push(branch);
    }
  }
  console.log(`✅ ${createdBranches.length} branches ready\n`);

  // ===== STEP 5: Create primary location for company =====
  console.log('📋 Step 5: Setting up primary location...');
  let primaryLocation = await prisma.locations.findFirst({
    where: {
      tenant_id: TENANT_ID,
      company_id: company.id,
      branch_id: createdBranches[0].id,
    },
  });

  if (!primaryLocation) {
    primaryLocation = await prisma.locations.create({
      data: {
        tenant_id: TENANT_ID,
        company_id: company.id,
        branch_id: createdBranches[0].id,
        name: 'HQ - Double Six',
        address: createdBranches[0].address,
        type: 'WAREHOUSE',
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    console.log(`   ✅ Created primary location\n`);
  } else {
    console.log(`   ℹ️  Primary location already exists\n`);
  }

  // Update company with primary location
  await prisma.companies.update({
    where: { id: company.id },
    data: { primary_location_id: primaryLocation.id },
  });

  // ===== STEP 6: Clean up and create users =====
  console.log('📋 Step 6: Setting up users...');
  const loginCredentials: Array<{
    name: string;
    email: string;
    password: string;
    role: string;
    status: string;
  }> = [];

  for (const userDef of USERS) {
    // Check if user exists
    let user = await prisma.users.findFirst({
      where: {
        email: userDef.email,
        tenant_id: TENANT_ID,
      },
    });

    if (user) {
      console.log(`   ℹ️  User ${userDef.email} already exists`);
      loginCredentials.push({
        name: `${userDef.firstName} ${userDef.lastName}`,
        email: userDef.email,
        password: userDef.password,
        role: userDef.role,
        status: 'EXISTING',
      });
    } else {
      // Create new user
      const hashedPassword = await bcrypt.hash(userDef.password, 10);
      
      user = await prisma.users.create({
        data: {
          tenant_id: TENANT_ID,
          company_id: company.id,
          email: userDef.email,
          password_hash: hashedPassword,
          first_name: userDef.firstName,
          last_name: userDef.lastName,
          phone: userDef.phone,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // Create user_companies association
      await prisma.user_companies.create({
        data: {
          user_id: user.id,
          tenant_id: TENANT_ID,
          company_id: company.id,
          role: userDef.role,
          is_default: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      console.log(`   ✅ Created user: ${userDef.firstName} ${userDef.lastName} (${userDef.role})`);
      loginCredentials.push({
        name: `${userDef.firstName} ${userDef.lastName}`,
        email: userDef.email,
        password: userDef.password,
        role: userDef.role,
        status: 'NEW',
      });
    }
  }

  console.log(`\n✅ ${USERS.length} users ready\n`);

  // ===== STEP 7: Generate login report =====
  console.log('📋 Step 7: Generating login credentials report...\n');
  
  const reportLines = [
    '═══════════════════════════════════════════════════════════════════════',
    '                   BAMBU SILVER - LOGIN CREDENTIALS',
    '═══════════════════════════════════════════════════════════════════════',
    '',
    `Tenant: ${COMPANY_NAME}`,
    `Application URL: http://150.109.15.108:3010`,
    `Generated: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
    '',
    '═══════════════════════════════════════════════════════════════════════',
    '                          MANAGEMENT TEAM',
    '═══════════════════════════════════════════════════════════════════════',
    '',
  ];

  // Management users (Owner, Superadmin, Admin)
  const managementUsers = loginCredentials.filter(u => 
    ['OWNER', 'SUPERADMIN', 'ADMIN'].includes(u.role)
  );

  managementUsers.forEach((cred, idx) => {
    reportLines.push(`${idx + 1}. ${cred.name} (${cred.role})`);
    reportLines.push(`   Email: ${cred.email}`);
    reportLines.push(`   Password: ${cred.password}`);
    reportLines.push(`   Status: ${cred.status}`);
    reportLines.push('');
  });

  reportLines.push('═══════════════════════════════════════════════════════════════════════');
  reportLines.push('                            SALES TEAM');
  reportLines.push('═══════════════════════════════════════════════════════════════════════');
  reportLines.push('');

  // Sales users
  const salesUsers = loginCredentials.filter(u => u.role === 'EMPLOYEE');

  salesUsers.forEach((cred, idx) => {
    reportLines.push(`${idx + 1}. ${cred.name}`);
    reportLines.push(`   Email: ${cred.email}`);
    reportLines.push(`   Password: ${cred.password}`);
    reportLines.push(`   Status: ${cred.status}`);
    reportLines.push('');
  });

  reportLines.push('═══════════════════════════════════════════════════════════════════════');
  reportLines.push('                          BRANCH INFORMATION');
  reportLines.push('═══════════════════════════════════════════════════════════════════════');
  reportLines.push('');

  createdBranches.forEach((branch, idx) => {
    reportLines.push(`${idx + 1}. ${branch.name} (${branch.code})`);
    reportLines.push(`   Address: ${branch.address}`);
    reportLines.push(`   Status: ${branch.status}`);
    reportLines.push('');
  });

  reportLines.push('═══════════════════════════════════════════════════════════════════════');
  reportLines.push('                        IMPORTANT NOTES');
  reportLines.push('═══════════════════════════════════════════════════════════════════════');
  reportLines.push('');
  reportLines.push('1. Please change your password after first login');
  reportLines.push('2. Keep these credentials secure and confidential');
  reportLines.push('3. Contact IT support if you have any login issues');
  reportLines.push('4. OWNER and SUPERADMIN have full system access');
  reportLines.push('5. ADMIN has administrative access to assigned modules');
  reportLines.push('6. EMPLOYEE (Sales) has access to POS and sales functions');
  reportLines.push('');
  reportLines.push('═══════════════════════════════════════════════════════════════════════');

  const report = reportLines.join('\n');
  console.log('\n' + report);

  // Save report to file
  const fs = require('fs');
  const reportPath = './bambu-silver-credentials-report.txt';
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\n💾 Report saved to: ${reportPath}\n`);

  console.log('✅ ✅ ✅ Data cleanup and seeding completed successfully! ✅ ✅ ✅\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
