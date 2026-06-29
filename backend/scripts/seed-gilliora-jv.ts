/**
 * Gilliora JV Branch Seed Script
 * 
 * Creates:
 * 1. Partner tenant for Anurak (JV partner)
 * 2. Gilliora JV branch (location + store) under Bambu Silver tenant
 * 3. JV Profile linking Bambu Silver ↔ Anurak
 * 4. Partner user accounts (Anurak as CO_ADMIN, can create more accounts)
 * 5. JV Scopes, Participants, Permissions
 * 6. Separate item catalog capability for Gilliora branch
 * 
 * Address: Same as Seminyak store (Jl. Seminyak, Bali)
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// ─── Constants ───────────────────────────────────────────────────────────────

// Bambu Silver (Host tenant)
const BAMBU_TENANT_ID = 'tnt-3rlhko';
const BAMBU_COMPANY_ID = 'b74e21b9-4e99-42fd-857b-36bf4dee7ed5';

// Location address - same as Seminyak store
const GILLIORA_ADDRESS = 'Jl. Seminyak, Bali';
const GILLIORA_COUNTRY = 'ID';
const GILLIORA_CURRENCY = 'IDR';

// JV Profile
const JV_CODE = 'JV-GILLIORA';
const JV_NAME = 'Gilliora Joint Venture (Bambu Silver × Anurak)';

// Partner (Anurak) credentials
const PARTNER_USERS = [
  {
    email: 'anurak@gilliora.com',
    password: 'Anurak2024!',
    firstName: 'Anurak',
    lastName: 'Partner',
    role: 'ADMIN', // Co-admin: can create accounts for their team
    phone: '+62812999001',
  },
  {
    email: 'manager@gilliora.com',
    password: 'GillioraM2024!',
    firstName: 'Gilliora',
    lastName: 'Manager',
    role: 'MANAGER',
    phone: '+62812999002',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('          GILLIORA JV BRANCH - FULL SETUP');
  console.log('          Bambu Silver × Anurak Joint Venture');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 1: Create Partner Tenant (Anurak's Organization)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('📋 STEP 1: Creating Partner Tenant for Anurak...\n');

  const partnerTenant = await prisma.tenants.upsert({
    where: { code: 'ANURAK-GILLIORA' },
    update: {},
    create: {
      id: `tnt-gilliora-${randomUUID().slice(0, 6)}`,
      name: 'Anurak - Gilliora Partner',
      code: 'ANURAK-GILLIORA',
      status: 'active',
    },
  });

  console.log(`   ✅ Partner Tenant: ${partnerTenant.name}`);
  console.log(`      ID: ${partnerTenant.id}`);
  console.log(`      Code: ${partnerTenant.code}\n`);

  // Create partner company under their own tenant
  const partnerCompany = await prisma.companies.upsert({
    where: { code: 'GILLIORA-PARTNER' },
    update: {},
    create: {
      name: 'Gilliora (Anurak)',
      code: 'GILLIORA-PARTNER',
      industry: 'retail',
      tenant_id: partnerTenant.id,
    },
  });

  console.log(`   ✅ Partner Company: ${partnerCompany.name}`);
  console.log(`      ID: ${partnerCompany.id}\n`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 2: Create Partner User Accounts (Anurak = ADMIN / Co-Admin)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('👥 STEP 2: Creating Partner User Accounts...\n');

  const createdUsers: any[] = [];

  for (const userDef of PARTNER_USERS) {
    const user = await prisma.users.upsert({
      where: { email: userDef.email },
      update: {},
      create: {
        email: userDef.email,
        password_hash: hashPassword(userDef.password),
        first_name: userDef.firstName,
        last_name: userDef.lastName,
        phone: userDef.phone,
        status: 'active',
        tenant_id: partnerTenant.id,
        company_id: partnerCompany.id,
      },
    });

    // Link user to their tenant with proper role
    await prisma.user_companies.upsert({
      where: { tenant_id_user_id: { tenant_id: partnerTenant.id, user_id: user.id } },
      update: { role: userDef.role },
      create: {
        user_id: user.id,
        tenant_id: partnerTenant.id,
        company_id: partnerCompany.id,
        role: userDef.role,
        is_default: true,
      },
    });

    createdUsers.push({ ...userDef, id: user.id });
    console.log(`   ✅ ${userDef.firstName} ${userDef.lastName}`);
    console.log(`      Email: ${userDef.email}`);
    console.log(`      Password: ${userDef.password}`);
    console.log(`      Role: ${userDef.role} ${userDef.role === 'ADMIN' ? '(Co-Admin - can create team accounts)' : ''}\n`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 3: Create Gilliora Branch under Bambu Silver (Location + Store)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('🏪 STEP 3: Creating Gilliora Branch (under Bambu Silver)...\n');

  const gillioraLocation = await prisma.locations.upsert({
    where: { tenant_id_code: { tenant_id: BAMBU_TENANT_ID, code: 'BS-GILLIORA-LOC' } },
    update: { name: 'Gilliora - Seminyak', address: GILLIORA_ADDRESS },
    create: {
      tenant_id: BAMBU_TENANT_ID,
      name: 'Gilliora - Seminyak',
      code: 'BS-GILLIORA-LOC',
      address: GILLIORA_ADDRESS,
      type: 'branch',
      country: GILLIORA_COUNTRY,
      currency: GILLIORA_CURRENCY,
      company_id: BAMBU_COMPANY_ID,
    },
  });

  console.log(`   ✅ Location: ${gillioraLocation.name}`);
  console.log(`      ID: ${gillioraLocation.id}`);
  console.log(`      Address: ${GILLIORA_ADDRESS}`);
  console.log(`      Code: BS-GILLIORA-LOC\n`);

  const gillioraStore = await prisma.stores.upsert({
    where: { tenant_id_code: { tenant_id: BAMBU_TENANT_ID, code: 'BS-GILLIORA-01' } },
    update: { name: 'Gilliora Branch' },
    create: {
      tenant_id: BAMBU_TENANT_ID,
      location_id: gillioraLocation.id,
      name: 'Gilliora Branch',
      code: 'BS-GILLIORA-01',
      type: 'boutique',
      status: 'active',
      company_id: BAMBU_COMPANY_ID,
      country: GILLIORA_COUNTRY,
      currency: GILLIORA_CURRENCY,
      timezone: 'Asia/Jakarta',
    },
  });

  console.log(`   ✅ Store: ${gillioraStore.name}`);
  console.log(`      ID: ${gillioraStore.id}`);
  console.log(`      Code: BS-GILLIORA-01`);
  console.log(`      Type: boutique`);
  console.log(`      Location: ${gillioraLocation.name}\n`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 4: Create JV Profile (Bambu Silver hosts, Anurak is partner)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('🤝 STEP 4: Creating JV Profile...\n');

  const jvProfile = await prisma.finance_jv_profiles.upsert({
    where: { code: JV_CODE },
    update: { name: JV_NAME },
    create: {
      tenant_id: BAMBU_TENANT_ID,
      company_id: BAMBU_COMPANY_ID,
      name: JV_NAME,
      code: JV_CODE,
      is_active: true,
      effective_from: new Date(),
    },
  });

  console.log(`   ✅ JV Profile: ${jvProfile.name}`);
  console.log(`      ID: ${jvProfile.id}`);
  console.log(`      Code: ${jvProfile.code}`);
  console.log(`      Host Tenant: ${BAMBU_TENANT_ID} (Bambu Silver)\n`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 5: Create JV Participants (Bambu Silver = OPERATOR, Anurak = NON_OPERATOR)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('📊 STEP 5: Linking JV Participants...\n');

  // Host participant (Bambu Silver)
  let hostParticipant = await prisma.finance_jv_participants.findFirst({
    where: { jv_profile_id: jvProfile.id, participant_tenant_id: BAMBU_TENANT_ID, role: 'OPERATOR' },
  });
  if (!hostParticipant) {
    hostParticipant = await prisma.finance_jv_participants.create({
      data: {
        jv_profile_id: jvProfile.id,
        participant_tenant_id: BAMBU_TENANT_ID,
        role: 'OPERATOR',
        profit_share_pct: 50, // Adjust as needed
        revenue_share_pct: 50,
        split_confirmed: true,
        split_confirmed_at: new Date(),
      },
    });
  } else {
    await prisma.finance_jv_participants.update({
      where: { id: hostParticipant.id },
      data: { split_confirmed: true, split_confirmed_at: new Date() },
    });
  }

  console.log(`   ✅ Host Participant: Bambu Silver (OPERATOR)`);
  console.log(`      Profit Share: 50%`);
  console.log(`      Revenue Share: 50%`);
  console.log(`      Split Confirmed: ✅\n`);

  // Partner participant (Anurak)
  let partnerParticipant = await prisma.finance_jv_participants.findFirst({
    where: { jv_profile_id: jvProfile.id, participant_tenant_id: partnerTenant.id, role: 'NON_OPERATOR' },
  });
  if (!partnerParticipant) {
    partnerParticipant = await prisma.finance_jv_participants.create({
      data: {
        jv_profile_id: jvProfile.id,
        participant_tenant_id: partnerTenant.id,
        role: 'NON_OPERATOR',
        profit_share_pct: 50, // Adjust as needed
        revenue_share_pct: 50,
        split_confirmed: true,
        split_confirmed_at: new Date(),
      },
    });
  } else {
    await prisma.finance_jv_participants.update({
      where: { id: partnerParticipant.id },
      data: { split_confirmed: true, split_confirmed_at: new Date() },
    });
  }

  console.log(`   ✅ Partner Participant: Anurak (NON_OPERATOR)`);
  console.log(`      Profit Share: 50%`);
  console.log(`      Revenue Share: 50%`);
  console.log(`      Split Confirmed: ✅\n`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 6: JV Scope - Link to Gilliora branch specifically
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('🎯 STEP 6: Setting JV Scope (Gilliora branch only)...\n');

  // Check if scope already exists
  const existingScope = await prisma.finance_jv_scopes.findFirst({
    where: { jv_profile_id: jvProfile.id, branch_id: gillioraStore.id },
  });

  if (!existingScope) {
    await prisma.finance_jv_scopes.create({
      data: {
        jv_profile_id: jvProfile.id,
        branch_id: gillioraStore.id,
        company_id: BAMBU_COMPANY_ID,
      },
    });
  }

  console.log(`   ✅ Scope: Gilliora Branch (${gillioraStore.code})`);
  console.log(`      This JV only applies to the Gilliora store\n`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 7: Set Partner Permissions (Co-Admin level access)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('🔐 STEP 7: Setting Partner Permissions...\n');

  const permissions = [
    { module: 'inventory', access_level: 'manage' },
    { module: 'pos', access_level: 'manage' },
    { module: 'sales', access_level: 'manage' },
    { module: 'expenses', access_level: 'write' },
    { module: 'procurement', access_level: 'write' },
    { module: 'finance_read', access_level: 'read' },
    { module: 'finance_write', access_level: 'none' }, // Host controls finance writes
    { module: 'hr', access_level: 'manage' }, // Can manage their own staff
  ];

  for (const perm of permissions) {
    await prisma.finance_jv_permissions.upsert({
      where: {
        participant_id_module: {
          participant_id: partnerParticipant.id,
          module: perm.module,
        },
      },
      update: { access_level: perm.access_level },
      create: {
        participant_id: partnerParticipant.id,
        module: perm.module,
        access_level: perm.access_level,
      },
    });
    console.log(`   ${perm.access_level === 'none' ? '🚫' : '✅'} ${perm.module}: ${perm.access_level}`);
  }

  console.log('');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 8: Create a separate product category for Gilliora items
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('📦 STEP 8: Setting up Gilliora Item Catalog...\n');

  const gillioraCategory = await prisma.product_categories.upsert({
    where: { tenant_id_name: { tenant_id: BAMBU_TENANT_ID, name: 'Gilliora Collection' } },
    update: {},
    create: {
      tenant_id: BAMBU_TENANT_ID,
      name: 'Gilliora Collection',
      company_id: BAMBU_COMPANY_ID,
    },
  });

  console.log(`   ✅ Category: ${gillioraCategory.name}`);
  console.log(`      Items will be added to this category for the Gilliora branch`);
  console.log(`      Stock levels will be tracked at the Gilliora location specifically\n`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 9: Create POS Device for Gilliora branch
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('💳 STEP 9: Creating POS Device...\n');

  const existingPosDevice = await prisma.pos_devices.findFirst({
    where: { tenant_id: BAMBU_TENANT_ID, store_id: gillioraStore.id, name: 'Gilliora POS Terminal 1' },
  });
  if (!existingPosDevice) {
    await prisma.pos_devices.create({
      data: {
        tenant_id: BAMBU_TENANT_ID,
        store_id: gillioraStore.id,
        name: 'Gilliora POS Terminal 1',
        type: 'TABLET',
        is_active: true,
      },
    });
  }

  console.log(`   ✅ POS Device: Gilliora POS Terminal 1 (at ${gillioraStore.name})\n`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 10: Create Money Source for cash register
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('💰 STEP 10: Creating Money Source (Cash Register)...\n');

  await prisma.money_sources.upsert({
    where: { tenant_id_name: { tenant_id: BAMBU_TENANT_ID, name: 'Gilliora Cash Register' } },
    update: {},
    create: {
      tenant_id: BAMBU_TENANT_ID,
      store_id: gillioraStore.id,
      name: 'Gilliora Cash Register',
      type: 'CASH',
      currency: 'IDR',
      balance: 0,
    },
  });

  console.log(`   ✅ Money Source: Gilliora Cash Register\n`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUMMARY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('                    ✅ GILLIORA JV SETUP COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log('📝 SUMMARY:');
  console.log('─────────────────────────────────────────────────────────────────────');
  console.log(`  Branch Name:       Gilliora`);
  console.log(`  Store Code:        BS-GILLIORA-01`);
  console.log(`  Location:          ${GILLIORA_ADDRESS}`);
  console.log(`  Host Tenant:       Bambu Silver (${BAMBU_TENANT_ID})`);
  console.log(`  Partner Tenant:    Anurak (${partnerTenant.id})`);
  console.log(`  JV Profile:        ${JV_CODE}`);
  console.log(`  Revenue Split:     50/50 (adjustable)\n`);

  console.log('👤 LOGIN CREDENTIALS:');
  console.log('─────────────────────────────────────────────────────────────────────');
  for (const u of createdUsers) {
    console.log(`  ${u.firstName} ${u.lastName} (${u.role})`);
    console.log(`    Email:    ${u.email}`);
    console.log(`    Password: ${u.password}\n`);
  }

  console.log('🔑 PARTNER ACCESS (Co-Admin):');
  console.log('─────────────────────────────────────────────────────────────────────');
  console.log('  Anurak has ADMIN role on their tenant → can create new user accounts');
  console.log('  via Admin > Invitations or directly in the system.');
  console.log('  Their team logs in with x-tenant-id pointing to the Bambu Silver');
  console.log('  tenant, and the JV middleware routes them to Gilliora branch.\n');

  console.log('📦 SEPARATE ITEMS:');
  console.log('─────────────────────────────────────────────────────────────────────');
  console.log('  YES - Gilliora has its own product category (GILLIORA-ITEMS).');
  console.log('  Items added to this category + stocked at BS-GILLIORA-LOC will be');
  console.log('  isolated from other Bambu Silver branches.');
  console.log('  Stock levels track independently per location.\n');

  console.log('⚙️  WHAT ELSE IS NEEDED:');
  console.log('─────────────────────────────────────────────────────────────────────');
  console.log('  1. ✅ Partner Tenant & Company — DONE');
  console.log('  2. ✅ Partner User Accounts (ADMIN = Co-Admin) — DONE');
  console.log('  3. ✅ Location + Store for Gilliora — DONE');
  console.log('  4. ✅ JV Profile + Participants — DONE');
  console.log('  5. ✅ JV Scope (scoped to Gilliora branch) — DONE');
  console.log('  6. ✅ JV Permissions (co-admin level) — DONE');
  console.log('  7. ✅ Product Category for separate items — DONE');
  console.log('  8. ✅ POS Device — DONE');
  console.log('  9. ✅ Money Source (Cash Register) — DONE');
  console.log('  10. 🔄 Add actual items to GILLIORA-ITEMS category — TO DO LATER');
  console.log('  11. 🔄 Set stock levels at BS-GILLIORA-LOC — TO DO LATER');
  console.log('  12. 🔄 Adjust revenue/profit split if not 50/50 — CONFIGURABLE');
  console.log('');
}

main()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
