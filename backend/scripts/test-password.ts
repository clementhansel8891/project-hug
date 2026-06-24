/**
 * Test Password Validation
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const TENANT_ID = 'tnt-3rlhko';

async function main() {
  const email = 'dewa@bambusilver.com';
  const testPassword = 'Dewa2024!';

  const user = await prisma.users.findUnique({
    where: { email },
  });

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log('User found:');
  console.log(`  Email: ${user.email}`);
  console.log(`  ID: ${user.id}`);
  console.log(`  Tenant: ${user.tenant_id}`);
  console.log(`  Status: ${user.status}`);
  console.log(`  Hash (first 20 chars): ${user.password_hash.substring(0, 20)}...`);
  console.log('');

  const isMatch = await bcrypt.compare(testPassword, user.password_hash);
  
  if (isMatch) {
    console.log('✅ Password MATCHES!');
  } else {
    console.log('❌ Password DOES NOT MATCH');
    console.log('');
    console.log('Testing with alternative passwords:');
    
    const alternatives = [
      'dewa2024!',
      'DEWA2024!',
      'Dewa2024',
      'DewaS2024!',
    ];
    
    for (const alt of alternatives) {
      const match = await bcrypt.compare(alt, user.password_hash);
      console.log(`  ${alt}: ${match ? '✅ MATCH' : '❌ no match'}`);
    }
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
