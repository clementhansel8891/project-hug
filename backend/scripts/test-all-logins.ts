/**
 * Test All Bambu Silver User Logins
 */

import axios from 'axios';

interface UserCredential {
  email: string;
  password: string;
  name: string;
  role: string;
}

const API_URL = process.env.API_URL || 'http://localhost:3001';

const USERS: UserCredential[] = [
  // Management Team
  { email: 'estela@bambusilver.com', password: 'Estela2024!', name: 'Estela Owner', role: 'OWNER' },
  { email: 'hansel@bambusilver.com', password: 'Hansel2024!', name: 'Hansel Superadmin', role: 'SUPERADMIN' },
  { email: 'ayi@bambusilver.com', password: 'Ayi2024!', name: 'Ayi Admin', role: 'SUPERADMIN' },
  { email: 'dewi.alan@bambusilver.com', password: 'Dewi2024!', name: 'Dewi Alan', role: 'ADMIN' },
  
  // Sales Team (SPG)
  { email: 'dewa@bambusilver.com', password: 'Dewa2024!', name: 'Dewa Sales', role: 'EMPLOYEE' },
  { email: 'dewi@bambusilver.com', password: 'DewiS2024!', name: 'Dewi Sales', role: 'EMPLOYEE' },
  { email: 'gusti@bambusilver.com', password: 'Gusti2024!', name: 'Gusti Sales', role: 'EMPLOYEE' },
  { email: 'nyoman@bambusilver.com', password: 'Nyoman2024!', name: 'Nyoman Sales', role: 'EMPLOYEE' },
  { email: 'nana@bambusilver.com', password: 'Nana2024!', name: 'Nana Sales', role: 'EMPLOYEE' },
  { email: 'fera@bambusilver.com', password: 'Fera2024!', name: 'Fera Sales', role: 'EMPLOYEE' },
];

async function testLogin(userCred: UserCredential): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const response = await axios.post(
      `${API_URL}/v1/auth/login`,
      {
        email: userCred.email,
        password: userCred.password,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (response.data.success && response.data.token) {
      return {
        success: true,
        message: 'Login successful',
        data: {
          token: response.data.token.substring(0, 20) + '...',
          user: response.data.user,
        },
      };
    } else {
      return {
        success: false,
        message: 'Login failed: No token received',
      };
    }
  } catch (error: any) {
    if (error.response) {
      return {
        success: false,
        message: `HTTP ${error.response.status}: ${error.response.data.detail || error.response.data.message || 'Unknown error'}`,
      };
    } else if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        message: 'Connection refused - API server not reachable',
      };
    } else {
      return {
        success: false,
        message: error.message || 'Unknown error',
      };
    }
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('         TESTING ALL BAMBU SILVER USER LOGINS');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`API URL: ${API_URL}`);
  console.log(`Total Users: ${USERS.length}\n`);

  let successCount = 0;
  let failCount = 0;

  // Test Management Team
  console.log('MANAGEMENT TEAM:');
  console.log('─────────────────────────────────────────────────────────────────────\n');
  
  for (const userCred of USERS.filter(u => ['OWNER', 'SUPERADMIN', 'ADMIN'].includes(u.role))) {
    const result = await testLogin(userCred);
    
    if (result.success) {
      console.log(`✅ ${userCred.name} (${userCred.role})`);
      console.log(`   Email: ${userCred.email}`);
      console.log(`   Token: ${result.data?.token}`);
      console.log(`   Tenant: ${result.data?.user?.tenant_id || 'N/A'}`);
      console.log(`   Companies: ${result.data?.user?.user_companies?.length || 0}\n`);
      successCount++;
    } else {
      console.log(`❌ ${userCred.name} (${userCred.role})`);
      console.log(`   Email: ${userCred.email}`);
      console.log(`   Error: ${result.message}\n`);
      failCount++;
    }
  }

  // Test Sales Team
  console.log('SALES TEAM (SPG):');
  console.log('─────────────────────────────────────────────────────────────────────\n');
  
  for (const userCred of USERS.filter(u => u.role === 'EMPLOYEE')) {
    const result = await testLogin(userCred);
    
    if (result.success) {
      console.log(`✅ ${userCred.name}`);
      console.log(`   Email: ${userCred.email}`);
      console.log(`   Token: ${result.data?.token}`);
      console.log(`   Tenant: ${result.data?.user?.tenant_id || 'N/A'}`);
      console.log(`   Companies: ${result.data?.user?.user_companies?.length || 0}\n`);
      successCount++;
    } else {
      console.log(`❌ ${userCred.name}`);
      console.log(`   Email: ${userCred.email}`);
      console.log(`   Error: ${result.message}\n`);
      failCount++;
    }
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('                         TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  console.log(`Total Users: ${USERS.length}`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}\n`);

  if (successCount === USERS.length) {
    console.log('🎉 ALL LOGINS WORKING PERFECTLY!\n');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('                    READY FOR PRODUCTION USE');
    console.log('═══════════════════════════════════════════════════════════════════════\n');
    console.log('All users can now:');
    console.log('  1. Login at: http://150.109.15.108:3010');
    console.log('  2. Access their respective modules');
    console.log('  3. SPG can open shifts and use POS terminal');
    console.log('  4. Management can access dashboards and reports\n');
  } else {
    console.log('⚠️  SOME LOGINS FAILED - REVIEW ERRORS ABOVE\n');
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Fatal Error:', e);
    process.exit(1);
  });
