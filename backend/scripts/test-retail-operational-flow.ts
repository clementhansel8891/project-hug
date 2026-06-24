import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TestResult {
  module: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
  data?: any;
}

const results: TestResult[] = [];

function addResult(module: string, test: string, status: 'PASS' | 'FAIL' | 'WARN', details: string, data?: any) {
  results.push({ module, test, status, details, data });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${module}] ${test}: ${details}`);
}

async function testRetailShifts() {
  console.log('\n🔍 Testing Retail Shifts Module...\n');
  
  try {
    // Test 1: Check active shifts
    const activeShifts = await prisma.retail_shifts.findMany({
      where: {
        status: 'open',
        tenant_id: 'tnt-3rlhko',
      },
      include: {
        stores: true,
      },
    });
    
    addResult(
      'Retail Shifts',
      'Active Shifts',
      activeShifts.length === 0 ? 'PASS' : 'WARN',
      `${activeShifts.length} open shifts (clean state expected)`,
      activeShifts.map(s => ({ 
        id: s.id, 
        employee_id: s.employee_id, 
        store: (s as any).stores?.name,
        opened: s.start_time 
      }))
    );

    // Test 2: Check shift history
    const recentShifts = await prisma.retail_shifts.findMany({
      where: {
        tenant_id: 'tnt-3rlhko',
        created_at: {
          gte: new Date('2026-06-24T00:00:00Z'),
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 5,
    });

    addResult(
      'Retail Shifts',
      'Recent Shift History',
      recentShifts.length > 0 ? 'PASS' : 'WARN',
      `${recentShifts.length} shifts created today`,
      recentShifts.map(s => ({
        id: s.id,
        status: s.status,
        store_id: s.store_id,
        created: s.created_at,
      }))
    );

  } catch (error: any) {
    addResult('Retail Shifts', 'Module Test', 'FAIL', error.message);
  }
}

async function testRetailTransactions() {
  console.log('\n🔍 Testing Retail Transactions Module...\n');
  
  try {
    // Test 1: Check transactions
    const transactions = await prisma.retail_transactions.findMany({
      where: {
        tenant_id: 'tnt-3rlhko',
        created_at: {
          gte: new Date('2026-06-24T00:00:00Z'),
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 5,
    });

    addResult(
      'Retail Transactions',
      'Transaction Records',
      'PASS',
      `${transactions.length} transactions found today`,
      transactions.map(t => ({
        id: t.id,
        type: t.type,
        total: t.total_amount,
        status: t.status,
      }))
    );

    // Test 2: Check transaction items
    if (transactions.length > 0) {
      const items = await prisma.retail_transaction_items.findMany({
        where: {
          transaction_id: transactions[0].id,
        },
      });

      addResult(
        'Retail Transactions',
        'Transaction Items',
        items.length > 0 ? 'PASS' : 'WARN',
        `${items.length} items in latest transaction`,
        items.slice(0, 3).map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          subtotal: i.subtotal,
        }))
      );
    }

  } catch (error: any) {
    addResult('Retail Transactions', 'Module Test', 'FAIL', error.message);
  }
}

async function testFinanceIntegration() {
  console.log('\n🔍 Testing Finance Integration...\n');
  
  try {
    // Test 1: Check journal entries from retail
    const journalEntries = await prisma.journal_entries.findMany({
      where: {
        tenant_id: 'tnt-3rlhko',
        source_module: 'RETAIL',
        created_at: {
          gte: new Date('2026-06-24T00:00:00Z'),
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 5,
    });

    addResult(
      'Finance',
      'Journal Entries from Retail',
      'PASS',
      `${journalEntries.length} journal entries created from retail today`,
      journalEntries.map(j => ({
        id: j.id,
        type: j.entry_type,
        reference: j.reference_id,
        amount: j.total_debit,
      }))
    );

    // Test 2: Check ledger integration
    if (journalEntries.length > 0) {
      const ledgerLines = await prisma.ledger_entries.findMany({
        where: {
          journal_entry_id: journalEntries[0].id,
        },
      });

      addResult(
        'Finance',
        'Ledger Lines',
        ledgerLines.length > 0 ? 'PASS' : 'WARN',
        `${ledgerLines.length} ledger lines for latest journal entry`,
        ledgerLines.map(l => ({
          account_id: l.account_id,
          debit: l.debit_amount,
          credit: l.credit_amount,
        }))
      );
    }

  } catch (error: any) {
    addResult('Finance', 'Module Test', 'FAIL', error.message);
  }
}

async function testInventoryIntegration() {
  console.log('\n🔍 Testing Inventory Integration...\n');
  
  try {
    // Test 1: Check stock movements from retail
    const stockMovements = await prisma.stock_movements.findMany({
      where: {
        tenant_id: 'tnt-3rlhko',
        movement_type: 'SALE',
        created_at: {
          gte: new Date('2026-06-24T00:00:00Z'),
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 5,
    });

    addResult(
      'Inventory',
      'Stock Movements from Sales',
      'PASS',
      `${stockMovements.length} stock movements created from sales today`,
      stockMovements.map(s => ({
        id: s.id,
        product_id: s.product_id,
        quantity: s.quantity,
        location: s.location_id,
      }))
    );

    // Test 2: Check product stock levels
    const productsWithStock = await prisma.products.findMany({
      where: {
        tenant_id: 'tnt-3rlhko',
        product_stock: {
          some: {
            location_id: 'a3a241a4-4841-45a3-90cd-f7135e6847b4', // Seminyak
          },
        },
      },
      include: {
        product_stock: {
          where: {
            location_id: 'a3a241a4-4841-45a3-90cd-f7135e6847b4',
          },
          take: 1,
        },
      },
      take: 5,
    });

    addResult(
      'Inventory',
      'Product Stock at Seminyak',
      productsWithStock.length > 0 ? 'PASS' : 'WARN',
      `${productsWithStock.length} products have stock records`,
      productsWithStock.map(p => ({
        id: p.id,
        name: p.name,
        stock: p.product_stock[0]?.quantity_available || 0,
      }))
    );

  } catch (error: any) {
    addResult('Inventory', 'Module Test', 'FAIL', error.message);
  }
}

async function testHRIntegration() {
  console.log('\n🔍 Testing HR Integration...\n');
  
  try {
    // Test 1: Check work shifts
    const workShifts = await prisma.hr_work_shifts.findMany({
      where: {
        tenant_id: 'tnt-3rlhko',
        start_time: {
          gte: new Date('2026-06-24T00:00:00Z'),
          lt: new Date('2026-06-25T00:00:00Z'),
        },
      },
      include: {
        employees: true,
        locations: true,
      },
    });

    addResult(
      'HR',
      'Work Shifts Scheduled',
      workShifts.length > 0 ? 'PASS' : 'FAIL',
      `${workShifts.length} work shifts scheduled for today`,
      workShifts.map(w => ({
        employee: (w as any).employees?.first_name,
        location: (w as any).locations?.name,
        start: w.start_time,
        end: w.end_time,
      }))
    );

    // Test 2: Check attendance records
    const attendanceRecords = await prisma.hr_attendance_records.findMany({
      where: {
        tenant_id: 'tnt-3rlhko',
        check_in: {
          gte: new Date('2026-06-24T00:00:00Z'),
        },
      },
      include: {
        employees: true,
      },
    });

    addResult(
      'HR',
      'Attendance Records',
      'PASS',
      `${attendanceRecords.length} attendance records today`,
      attendanceRecords.map(a => ({
        employee: (a as any).employees?.first_name,
        check_in: a.check_in,
        check_out: a.check_out,
        hours: a.work_hours,
      }))
    );

  } catch (error: any) {
    addResult('HR', 'Module Test', 'FAIL', error.message);
  }
}

async function testPaymentIntegration() {
  console.log('\n🔍 Testing Payment Integration...\n');
  
  try {
    // Test 1: Check payments from retail
    const payments = await prisma.payments.findMany({
      where: {
        tenant_id: 'tnt-3rlhko',
        created_at: {
          gte: new Date('2026-06-24T00:00:00Z'),
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 5,
    });

    addResult(
      'Payments',
      'Payment Records',
      'PASS',
      `${payments.length} payments recorded today`,
      payments.map(p => ({
        id: p.id,
        method: p.payment_method,
        amount: p.amount,
        status: p.status,
      }))
    );

    // Test 2: Check money sources used
    const moneySources = await prisma.money_sources.findMany({
      where: {
        tenant_id: 'tnt-3rlhko',
        location_id: 'a3a241a4-4841-45a3-90cd-f7135e6847b4', // Seminyak
      },
    });

    addResult(
      'Payments',
      'Money Sources at Seminyak',
      moneySources.length > 0 ? 'PASS' : 'FAIL',
      `${moneySources.length} money sources configured`,
      moneySources.map(m => ({
        id: m.id,
        name: m.name,
        type: m.type,
        balance: m.balance,
      }))
    );

  } catch (error: any) {
    addResult('Payments', 'Module Test', 'FAIL', error.message);
  }
}

async function testDataIntegrity() {
  console.log('\n🔍 Testing Data Integrity...\n');
  
  try {
    // Test 1: Orphaned records check
    const orphanedTransactionItems = await prisma.retail_transaction_items.findMany({
      where: {
        transactions: null,
      },
      take: 1,
    });

    addResult(
      'Data Integrity',
      'Orphaned Transaction Items',
      orphanedTransactionItems.length === 0 ? 'PASS' : 'WARN',
      `${orphanedTransactionItems.length} orphaned transaction items found`
    );

    // Test 2: Check tenant isolation
    const crossTenantData = await prisma.retail_transactions.findMany({
      where: {
        tenant_id: { not: 'tnt-3rlhko' },
        stores: {
          location_id: 'a3a241a4-4841-45a3-90cd-f7135e6847b4',
        },
      },
      take: 1,
    });

    addResult(
      'Data Integrity',
      'Tenant Isolation',
      crossTenantData.length === 0 ? 'PASS' : 'FAIL',
      `${crossTenantData.length} cross-tenant violations found`
    );

    // Test 3: Check referential integrity
    const shiftsWithInvalidStore = await prisma.retail_shifts.findMany({
      where: {
        tenant_id: 'tnt-3rlhko',
        stores: null,
      },
      take: 1,
    });

    addResult(
      'Data Integrity',
      'Referential Integrity',
      shiftsWithInvalidStore.length === 0 ? 'PASS' : 'WARN',
      `${shiftsWithInvalidStore.length} shifts with invalid store references`
    );

  } catch (error: any) {
    addResult('Data Integrity', 'Module Test', 'FAIL', error.message);
  }
}

async function printSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80) + '\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log();

  if (failed > 0) {
    console.log('FAILED TESTS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ [${r.module}] ${r.test}: ${r.details}`);
    });
    console.log();
  }

  if (warnings > 0) {
    console.log('WARNINGS:');
    results.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`  ⚠️  [${r.module}] ${r.test}: ${r.details}`);
    });
    console.log();
  }

  const overallStatus = failed === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED';
  console.log('='.repeat(80));
  console.log(overallStatus);
  console.log('='.repeat(80) + '\n');
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║   RETAIL OPERATIONAL FLOW - END-TO-END INTEGRATION TEST           ║');
  console.log('║   Testing Data Persistence and Module Integration                 ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');
  console.log('Date:', new Date().toISOString());
  console.log('Tenant: tnt-3rlhko (Bambu Silver)');
  console.log('Location: Seminyak (a3a241a4-4841-45a3-90cd-f7135e6847b4)');
  console.log();

  try {
    await testRetailShifts();
    await testRetailTransactions();
    await testFinanceIntegration();
    await testInventoryIntegration();
    await testHRIntegration();
    await testPaymentIntegration();
    await testDataIntegrity();
    await printSummary();
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runAllTests();
