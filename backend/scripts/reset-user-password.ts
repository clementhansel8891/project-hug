/**
 * Reset User Password
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'dewa@bambusilver.com';
  const newPassword = process.argv[3] || 'Dewa2024!';

  console.log(`Resetting password for: ${email}`);
  console.log(`New password will be: ${newPassword}\n`);

  const user = await prisma.users.findUnique({
    where: { email },
  });

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log(`User found: ${user.first_name} ${user.last_name}`);
  console.log(`Current tenant: ${user.tenant_id}\n`);

  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(newPassword, salt);

  await prisma.users.update({
    where: { id: user.id },
    data: {
      password_hash,
      updated_at: new Date(),
    },
  });

  console.log('✅ Password updated successfully!');
  console.log('');
  console.log('Login credentials:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${newPassword}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
