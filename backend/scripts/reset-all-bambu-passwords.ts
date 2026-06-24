/**
 * Reset All Bambu Silver User Passwords
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const TENANT_ID = 'tnt-3rlhko';

interface UserCredential {
  email: string;
  password: string;
  name: string;
  role: string;
}

const USERS: UserCredential[] = [
  // Management Team
  { email: 'estela@bambusilver.com', password: 'Estela2024!', name: 'Estela Owner', role: 'OWNER' },
  { email: 'hansel@bambusilver.com', password: 'Hansel2024!', name: 'Hansel Superadmin', role: 'SUPERADMIN' },
  { email: 'ayi@bambusilver.com', password: 'Ayi2024!', name: 'Ayi Admin', role: 'ADMIN' },
  { email: 'dewi.alan@bambusilver.com', password: 'Dewi2024!', name: 'Dewi Alan', role: 'ADMIN' },
  
  // Sales Team (SPG)
  { email: 'dewa@bambusilver.com', password: 'Dewa2024!', name: 'Dewa Sales', role: 'EMPLOYEE' },
  { email: 'dewi@bambusilver.com', password: 'DewiS2024!', name: 'Dewi Sales', role: 'EMPLOYEE' },
  { email: 'gusti@bambusilver.com', password: 'Gusti2024!', name: 'Gusti Sales', role: 'EMPLOYEE' },
  { email: 'nyoman@bambusilver.com', password: 'Nyoman2024!', name: 'Nyoman Sales', role: 'EMPLOYEE' },
  { email: 'nana@bambusilver.com', password: 'Nana2024!', name: 'Nana Sales', role: 'EMPLOYEE' },
  { email: 'fera@bambusilver.com', password: 'Fera2024!', name: 'Fera Sales', role: 'EMPLOYEE' },
];

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('         RESETTING ALL BAMBU SILVER USER PASSWORDS');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  let successCount = 0;
  let failCount = 0;
  const results: Array<{ email: string; status: string; message: string }> = [];

  for (const userCred of USERS) {
    try {
      const user = await prisma.users.findUnique({
        where: { email: userCred.email },
      });

      if (!user) {
        console.log(`❌ ${userCred.name} (${userCred.email}) - NOT FOUND`);
        failCount++;
        results.push({
          email: userCred.email,
          status: 'FAILED',
          message: 'User not found',
        });
        continue;
      }

      // Hash the new password
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(userCred.password, salt);

      // Update the user's password
      await prisma.users.update({
        where: { id: user.id },
        data: {
          password_hash,
          updated_at: new Date(),
        },
      });

      console.log(`✅ ${userCred.name} (${userCred.email}) - Password reset successfully`);
      successCount++;
      results.push({
        email: userCred.email,
        status: 'SUCCESS',
        message: `Password: ${userCred.password}`,
      });
    } catch (error: any) {
      console.log(`❌ ${userCred.name} (${userCred.email}) - ERROR: ${error.message}`);
      failCount++;
      results.push({
        email: userCred.email,
        status: 'FAILED',
        message: error.message,
      });
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('                         RESET SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  console.log(`Total Users: ${USERS.length}`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}\n`);

  if (successCount === USERS.length) {
    console.log('🎉 ALL PASSWORDS RESET SUCCESSFULLY!\n');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('                      LOGIN CREDENTIALS');
    console.log('═══════════════════════════════════════════════════════════════════════\n');
    
    console.log('MANAGEMENT TEAM:');
    console.log('─────────────────────────────────────────────────────────────────────');
    USERS.filter(u => ['OWNER', 'SUPERADMIN', 'ADMIN'].includes(u.role)).forEach(u => {
      console.log(`${u.name} (${u.role})`);
      console.log(`  Email: ${u.email}`);
      console.log(`  Password: ${u.password}\n`);
    });

    console.log('SALES TEAM (SPG):');
    console.log('─────────────────────────────────────────────────────────────────────');
    USERS.filter(u => u.role === 'EMPLOYEE').forEach(u => {
      console.log(`${u.name}`);
      console.log(`  Email: ${u.email}`);
      console.log(`  Password: ${u.password}\n`);
    });
  }
}

main()
  .catch((e) => {
    console.error('Fatal Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
