# Implementation Steps - Retail Operational Readiness

**Status**: IMPLEMENTATION PLAN  
**Date**: June 24, 2026

---

## Current Status Summary

✅ **Already Working**:
- Logout button exists in POSLayout (top right)
- Work shifts created for Fera and Nana
- Store routing fixed (Seminyak)
- Shift creation working

⏳ **Needs Implementation**:
- Attendance tracking on login/logout
- Role-based access control for SPG users
- Comprehensive operational testing
- Data integrity verification

---

## STEP 1: Add Attendance Tracking (HIGHEST PRIORITY)

### 1.1 Create Attendance Service Backend

**File**: `backend/src/modules/hr/services/hr-attendance.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../persistence/prisma.service';
import { TenantContext } from '../../../gateway/tenant-context.interface';

@Injectable()
export class HRAttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create attendance record when employee logs in
   */
  async clockIn(ctx: TenantContext, employeeId: string, storeId?: string) {
    // Find active work shift for today
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const workShift = await this.prisma.hr_work_shifts.findFirst({
      where: {
        tenant_id: ctx.tenant_id,
        employee_id: employeeId,
        start_time: { lte: now },
        end_time: { gte: now },
      },
    });

    // Create attendance record
    const attendance = await this.prisma.hr_attendance_records.create({
      data: {
        tenant_id: ctx.tenant_id,
        company_id: ctx.company_id,
        employee_id: employeeId,
        shift_id: workShift?.id,
        store_id: storeId,
        check_in: now,
        status: 'PRESENT',
        work_date: todayStart,
        created_at: now,
        updated_at: now,
      },
    });

    console.log(`[Attendance] Clock-in recorded for employee ${employeeId}`);
    return attendance;
  }

  /**
   * Update attendance record when employee logs out
   */
  async clockOut(ctx: TenantContext, employeeId: string) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Find today's attendance record
    const attendance = await this.prisma.hr_attendance_records.findFirst({
      where: {
        tenant_id: ctx.tenant_id,
        employee_id: employeeId,
        work_date: todayStart,
        check_out: null, // Still clocked in
      },
      orderBy: { check_in: 'desc' },
    });

    if (!attendance) {
      console.warn(`[Attendance] No active clock-in found for employee ${employeeId}`);
      return null;
    }

    // Calculate work hours
    const checkIn = new Date(attendance.check_in);
    const workHours = (now.getTime() - checkIn.getTime()) / (1000 * 60 * 60); // Hours

    // Update attendance with clock-out
    const updated = await this.prisma.hr_attendance_records.update({
      where: { id: attendance.id },
      data: {
        check_out: now,
        work_hours: workHours,
        updated_at: now,
      },
    });

    console.log(`[Attendance] Clock-out recorded for employee ${employeeId}. Hours: ${workHours.toFixed(2)}`);
    return updated;
  }

  /**
   * Get today's attendance for an employee
   */
  async getTodayAttendance(ctx: TenantContext, employeeId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return this.prisma.hr_attendance_records.findFirst({
      where: {
        tenant_id: ctx.tenant_id,
        employee_id: employeeId,
        work_date: todayStart,
      },
      orderBy: { check_in: 'desc' },
    });
  }
}
```

### 1.2 Update Auth Controller to Track Attendance

**File**: `backend/src/core/auth/auth.controller.ts` (modify login endpoint)

```typescript
// After successful login, create attendance record
if (user.role === 'EMPLOYEE') {
  const employee = await this.prisma.employees.findFirst({
    where: { user_id: user.id, tenant_id: user.tenant_id },
  });

  if (employee) {
    // Get store from routing info if available
    const storeId = routingInfo?.context?.store_id;
    
    await this.attendanceService.clockIn(
      { tenant_id: user.tenant_id, company_id: user.company_id },
      employee.id,
      storeId
    );
  }
}
```

### 1.3 Create Attendance API Endpoint

**File**: `backend/src/modules/hr/hr.controller.ts` (add endpoint)

```typescript
@Post('attendance/clock-out')
async clockOut(@Req() request: RequestWithTenant) {
  const userId = request.user.sub;
  
  const employee = await this.prisma.employees.findFirst({
    where: { 
      user_id: userId, 
      tenant_id: request.tenant.tenant_id 
    },
  });

  if (!employee) {
    throw new BadRequestException('Employee record not found');
  }

  const attendance = await this.attendanceService.clockOut(
    request.tenant,
    employee.id
  );

  return {
    success: true,
    data: attendance,
  };
}
```

### 1.4 Update Frontend Logout to Call Clock-Out

**File**: `src/contexts/AuthContext.tsx` (modify logout function)

```typescript
const logout = async () => {
  try {
    // Call clock-out API before logging out
    await apiClient.post('/v1/hr/attendance/clock-out', {}, {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });
  } catch (error) {
    console.error('[Auth] Clock-out failed:', error);
    // Continue with logout even if clock-out fails
  }

  // Existing logout logic
  setSession(initialSession);
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
  navigate('/login');
};
```

---

## STEP 2: Implement Role-Based Access Control

### 2.1 Create Route Guard Component

**File**: `src/components/guards/RoleGuard.tsx`

```typescript
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  allowedPaths?: string[];
}

export function RoleGuard({ children, allowedRoles, allowedPaths }: RoleGuardProps) {
  const { session } = useAuth();
  const location = useLocation();

  const userRole = session.role || 'GUEST';

  // If roles specified, check role
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    // For EMPLOYEE role, redirect to POS
    if (userRole === 'EMPLOYEE') {
      return <Navigate to="/m/retail/operational/pos" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  // If paths specified, check current path
  if (allowedPaths && userRole === 'EMPLOYEE') {
    const isAllowed = allowedPaths.some(path => 
      location.pathname.startsWith(path)
    );

    if (!isAllowed) {
      return <Navigate to="/m/retail/operational/pos" replace />;
    }
  }

  return <>{children}</>;
}
```

### 2.2 Apply Route Guard to Dashboard

**File**: `src/App.tsx` or routing file

```typescript
// Protect dashboard route
<Route
  path="/core/dashboard"
  element={
    <RoleGuard allowedRoles={['ADMIN', 'MANAGER', 'ACCOUNTANT']}>
      <Dashboard />
    </RoleGuard>
  }
/>

// Allow retail operational for EMPLOYEE
<Route
  path="/m/retail/operational/*"
  element={
    <RoleGuard allowedRoles={['ADMIN', 'MANAGER', 'EMPLOYEE']}>
      <RetailOperational />
    </RoleGuard>
  }
/>
```

### 2.3 Add Backend Permission Check

**File**: `backend/src/core/auth/guards/rbac.guard.ts`

```typescript
const ROLE_PERMISSIONS = {
  EMPLOYEE: [
    'retail:pos:access',
    'retail:sales:create',
    'retail:inventory:view',
    'retail:shifts:manage',
  ],
  MANAGER: [
    'retail:*',
    'core:dashboard:view',
    'hr:*',
  ],
  ADMIN: ['*'],
};

// In guard logic
if (userRole === 'EMPLOYEE') {
  // Block non-retail routes
  if (!requestPath.startsWith('/v1/retail/operational')) {
    throw new ForbiddenException('Access denied');
  }
}
```

---

## STEP 3: Operational Testing Checklist

Create a structured testing session document that tracks all test scenarios.

**File**: `TEST_SESSION_TEMPLATE.md`

```markdown
# Retail Operational Test Session

**Date**: ___________
**Tester**: ___________
**Environment**: Production / Staging
**Store**: Seminyak

---

## User 1: Fera (Morning Shift)

### Login & Setup
- [ ] Time: 8:00 AM
- [ ] Login successful: fera@bambusilver.com
- [ ] Redirected to Seminyak POS: YES / NO
- [ ] Attendance record created: YES / NO (ID: _______)

### Shift Initialization
- [ ] Initialize terminal clicked
- [ ] Opening cash declared: IDR _________
- [ ] Shift opened successfully: YES / NO
- [ ] Shift ID: ___________

### Transaction Tests

#### Test 1: Simple Cash Sale
- [ ] Product searched: ___________
- [ ] Added to cart
- [ ] Total: IDR _________
- [ ] Payment: Cash IDR _________
- [ ] Change: IDR _________
- [ ] Order ID: ___________
- [ ] Stock updated: YES / NO

... (continue for all test cases)

### Data Verification Queries
Run after completing all tests and document results.
```

---

## STEP 4: Create Automated Test Script

**File**: `backend/scripts/test-retail-operational.ts`

```typescript
/**
 * Automated Retail Operational Test Script
 * 
 * Tests all POS functions and verifies data integrity
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const API_URL = 'http://150.109.15.108:3001/v1';
const TENANT_ID = 'tnt-3rlhko';

async function runTests() {
  console.log('Starting Retail Operational Tests...\n');

  // Test 1: Verify work shifts exist
  await testWorkShifts();

  // Test 2: Verify attendance records
  await testAttendance();

  // Test 3: Verify recent orders
  await testOrders();

  // Test 4: Verify stock movements
  await testStockMovements();

  // Test 5: Verify shifts
  await testShifts();

  // Test 6: Check data integrity
  await checkDataIntegrity();

  console.log('\n✅ All tests completed!');
}

async function testWorkShifts() {
  console.log('📅 Testing Work Shifts...');
  
  const shifts = await prisma.hr_work_shifts.findMany({
    where: {
      tenant_id: TENANT_ID,
      employee: {
        email: {
          in: ['fera@bambusilver.com', 'nana@bambusilver.com'],
        },
      },
    },
    include: {
      employees: true,
      locations: true,
    },
  });

  console.log(`   Found ${shifts.length} work shifts`);
  shifts.forEach(s => {
    console.log(`   - ${s.employees.first_name}: ${s.start_time} to ${s.end_time}`);
  });
}

async function testAttendance() {
  console.log('\n📋 Testing Attendance Records...');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const attendance = await prisma.hr_attendance_records.findMany({
    where: {
      tenant_id: TENANT_ID,
      work_date: today,
    },
    include: {
      employees: true,
    },
  });

  console.log(`   Found ${attendance.length} attendance records for today`);
  attendance.forEach(a => {
    console.log(`   - ${a.employees.first_name}: Check-in ${a.check_in}, Check-out ${a.check_out || 'Still active'}`);
  });
}

// ... (continue with other test functions)

runTests()
  .catch(e => console.error('Test failed:', e))
  .finally(() => prisma.$disconnect());
```

---

## Quick Implementation Order

1. **First (30 min)**: Verify logout button works
2. **Second (2 hours)**: Implement attendance tracking
3. **Third (1 hour)**: Add role-based guards  
4. **Fourth (4-6 hours)**: Run operational tests
5. **Fifth (2 hours)**: Verify data integrity

---

## Expected Outcomes

After completion:
- ✅ SPG can logout from POS
- ✅ Attendance tracked automatically
- ✅ SPG blocked from dashboard
- ✅ All POS functions tested and working
- ✅ Data flows to all modules correctly

---

Would you like me to:
A. Implement attendance tracking now
B. Create the test session template
C. Build the automated test script
D. All of the above (sequential implementation)
