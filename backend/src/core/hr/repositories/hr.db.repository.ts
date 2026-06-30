// @ts-nocheck
import { Injectable, ConflictException } from "@nestjs/common";
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from "../../../persistence/prisma.service";
import { Prisma } from "@prisma/client";
import { IHRRepository } from "./hr.repository.interface";
import { Employee } from "../entities/employee.entity";
import { Attendance } from "../entities/attendance.entity";
import { LeaveRequest } from "../entities/leave-request.entity";
import { Payroll } from "../entities/payroll.entity";
import { CreateEmployeeDto } from "../dto/create-employee.dto";
import { UpdateEmployeeDto } from "../dto/update-employee.dto";
import { CreateLeaveRequestDto } from "../dto/create-leave-request.dto";
import { Department } from "../entities/department.entity";
import { JobRequisition } from "../entities/requisition.entity";
import { PerformanceCycle } from "../entities/performance-cycle.entity";
import { PerformanceReview } from "../entities/performance-review.entity";
import { HRCase } from "../entities/hr-case.entity";
import { Contract } from "../entities/contract.entity";
import { Candidate } from "../entities/candidate.entity";
import { Position } from "../entities/position.entity";
import { Compensation } from "../entities/compensation.entity";
import { Interview } from "../entities/interview.entity";
import { TalentLead } from "../entities/talent-lead.entity";
import { ComplianceDocument } from "../entities/compliance-document.entity";
import { BudgetScenario } from "../entities/budget-scenario.entity";
import { HeadcountPlan } from "../entities/headcount-plan.entity";
import { ExchangeRate } from "../entities/exchange-rate.entity";
import { PayrollRun } from "../entities/payroll-run.entity";
import { PayrollLine } from "../entities/payroll-line.entity";
import { SuccessionPlan } from "../entities/succession-plan.entity";
import {
  handlePrismaFkError,
  assertExists,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "../utils/hr-prisma.errors";
import {
  mapEmployeeFieldsToColumns,
  mapWorkScheduleFieldsToColumns,
  mapWorkShiftFieldsToColumns,
} from "../utils/field-mapping";
import { SuccessionCandidate } from "../entities/succession-candidate.entity";
import { Skill } from "../entities/skill.entity";
import { EmployeeSkill } from "../entities/employee-skill.entity";
import { BenefitPlan } from "../entities/benefit-plan.entity";
import { EmployeeBenefit } from "../entities/employee-benefit.entity";
import { CareerPath } from "../entities/career-path.entity";
import { MentorshipPair } from "../entities/mentorship-pair.entity";
import { PositionSkill } from "../entities/position-skill.entity";
import { PerformanceGoal } from "../entities/performance-goal.entity";
import { TrainingProgram } from "../entities/training-program.entity";
import { TrainingAssignment } from "../entities/training-assignment.entity";
import { ProgramSkill } from "../entities/program-skill.entity";
import { CreateDepartmentDto } from "../dto/create-department.dto";
import { CreateRequisitionDto } from "../dto/create-requisition.dto";
import { CreatePerformanceCycleDto } from "../dto/create-performance-cycle.dto";
import { SubmitReviewDto } from "../dto/submit-review.dto";
import { CreateCaseDto } from "../dto/create-case.dto";
import { CreateContractDto } from "../dto/create-contract.dto";
import { CreateBudgetScenarioDto } from "../dto/create-budget-scenario.dto";
import { CreateHeadcountPlanDto } from "../dto/create-headcount-plan.dto";
import { CreateWorkScheduleDto } from "../dto/create-work-schedule.dto";
import { CreateWorkShiftDto } from "../dto/create-work-shift.dto";
import { UpdateWorkScheduleDto } from "../dto/update-work-schedule.dto";
import { UpdateWorkShiftDto } from "../dto/update-work-shift.dto";

@Injectable()
export class HRDbRepository implements IHRRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // EMPLOYEE MANAGEMENT
  // ============================================================

  async getEmployees(
    tenant_id: string,
    location_id?: string,
    company_id?: string,
    department_id?: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: Employee[]; total: number }> {
    const where: any = {
      tenant_id: tenant_id,
      deleted_at: null,
    };

    if (location_id) {
      where.location_id = location_id;
    }

    if (company_id) {
      where.company_id = company_id;
    }

    if (department_id) {
      where.department_id = department_id;
    }

    const [employees, total] = await Promise.all([
      this.prisma.employees.findMany({
        where,
        include: { 
          locations: true,
          departments: true,
          companies: true,
        },
        orderBy: { last_name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.employees.count({ where }),
    ]);

    return {
      data: employees.map(emp => this.mapEmployee(emp)),
      total,
    };
  }

  async getGlobalEmployees(
    location_id?: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: Employee[]; total: number }> {
    const where: any = {
      deleted_at: null,
    };

    if (location_id) {
      where.location_id = location_id;
    }

    const [employees, total] = await Promise.all([
      this.prisma.employees.findMany({
        where,
        include: { 
          locations: true,
          departments: true,
          companies: true,
        },
        orderBy: { last_name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.employees.count({ where }),
    ]);

    return {
      data: employees.map(emp => this.mapEmployee(emp)),
      total,
    };
  }

  async getEmployeeById(
    tenant_id: string,
    employee_id: string,
  ): Promise<Employee | null> {
    const employee = await this.prisma.employees.findFirst({
      where: {
        OR: [
          { id: employee_id },
          { user_id: employee_id }
        ],
        tenant_id: tenant_id,
        deleted_at: null,
      },
      include: { 
        locations: true,
        departments: true,
        companies: true,
      },
    });

    return employee ? this.mapEmployee(employee) : null;
  }

  async getGlobalEmployeeById(employee_id: string): Promise<Employee | null> {
    const employee = await this.prisma.employees.findFirst({
      where: {
        OR: [
          { id: employee_id },
          { user_id: employee_id }
        ],
        deleted_at: null,
      },
      include: { locations: true,
        departments: true,
        companies: true,
      },
    });

    return employee ? this.mapEmployee(employee) : null;
  }

  async createEmployee(
    tenant_id: string,
    data: CreateEmployeeDto,
    tx?: Prisma.TransactionClient,
  ): Promise<Employee> {
    const db = tx ?? this.prisma;
    // Ensure location_id and company_id are provided or inferred
    let location_id = data.location_id;
    let company_id = data.company_id;

    if (!location_id) {
      const firstLocation = await db.locations.findFirst({
        where: { tenant_id: tenant_id },
      });
      location_id = firstLocation?.id || "loc-default";
      if (!company_id) company_id = firstLocation?.company_id || undefined;
    } else if (!company_id) {
      const loc = await db.locations.findUnique({ where: { id: location_id } });
      company_id = loc?.company_id || undefined;
    }

    // --- PROVISIONING LOGIC ---
    // Ensure a User account exists for this employee
    let user = await db.users.findUnique({
      where: {
        tenant_id_email: {
          tenant_id: tenant_id,
          email: data.email,
        },
      },
    });

    if (!user) {
      // Create a default user account
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash("Welcome123", salt);

      user = await db.users.create({
        data: {
          id: data.id || undefined, // Use provided ID or let DB generate
          tenant_id: tenant_id,
          email: data.email,
          password_hash: password_hash,
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone,
          updated_at: new Date(),
        },
      });
    }

    // Ensure UserCompany association exists for multi-tenancy access
    await db.user_companies.upsert({
      where: {
        tenant_id_user_id: {
          user_id: user.id,
          tenant_id: tenant_id
        }
      },
      update: {}, 
      create: {
        user_id: user.id,
        tenant_id: tenant_id,
        role: 'MEMBER'
      }
    });

    // Explicit DTO -> schema-column mapping (Requirement 5.1/5.2/5.3): translate
    // compatibility aliases (`position`/`role_title` -> `positions`,
    // `position_id` -> `job_role_id`, `documents_metadata` -> `document_metadata`)
    // and drop non-columns (`full_name`, `id`) rather than spreading the DTO
    // straight into Prisma. Computed/scoped/typed fields are applied explicitly
    // afterwards so the resolved scope and correct value types always win.
    const mapped = mapEmployeeFieldsToColumns(data as unknown as Record<string, unknown>);

    const employee = await (async () => {
      try {
        return await db.employees.create({
          data: {
            ...mapped,
            id: data.id || undefined,
            tenant_id: tenant_id,
            company_id: company_id,
            location_id: location_id as string,
            user_id: user.id, // Link to the user account
            positions: (mapped.positions as string) || "Staff",
            employment_type: (mapped.employment_type as string) || "full_time",
            status: (mapped.status as string) || "active",
            base_salary: data.base_salary != null ? new Prisma.Decimal(data.base_salary.toString()) : undefined,
            hourly_rate: data.hourly_rate != null ? new Prisma.Decimal(data.hourly_rate.toString()) : undefined,
            hire_date: data.hire_date ? new Date(data.hire_date) : new Date(),
            updated_at: new Date(),
          } as Prisma.employeesUncheckedCreateInput,
          include: { locations: true,
            departments: true,
          },
        });
      } catch (error) {
        if (error?.code === 'P2002') {
          const target = error?.meta?.target;
          throw new ConflictException(`Record already exists: duplicate value for ${target}`);
        }
        throw error;
      }
    })();

    return this.mapEmployee(employee);
  }

  async updateEmployee(
    tenant_id: string,
    employee_id: string,
    data: UpdateEmployeeDto,
    tx?: Prisma.TransactionClient,
  ): Promise<Employee> {
    const db = tx ?? this.prisma;

    // Route every supplied field through the explicit mapper so each value binds
    // to its schema column (Requirement 5). This fixes the prior drift bug where
    // `role_title` was written to a nonexistent `position` column (now correctly
    // `positions`) and silently dropped. `undefined` fields are skipped by the
    // mapper, preserving partial-update semantics; `full_name` (no column) is
    // dropped; `documents_metadata` -> `document_metadata`.
    const updateData: Record<string, unknown> = {
      ...mapEmployeeFieldsToColumns(data as unknown as Record<string, unknown>),
      updated_at: new Date(),
    };

    // Apply correctly-typed conversions, overriding the raw mapped values.
    if (data.base_salary !== undefined) {
      updateData.base_salary = new Prisma.Decimal(data.base_salary.toString());
    }
    if (data.hourly_rate !== undefined) {
      updateData.hourly_rate = new Prisma.Decimal(data.hourly_rate.toString());
    }
    if (data.termination_date !== undefined) {
      updateData.termination_date = data.termination_date
        ? new Date(data.termination_date)
        : null;
    }

    const employee = await db.employees.update({
      where: {
        id: employee_id,
        tenant_id: tenant_id,
      },
      data: updateData as Prisma.employeesUncheckedUpdateInput,
      include: { locations: true,
        departments: true,
      },
    });

    return this.mapEmployee(employee);
  }

  async deactivateEmployee(
    tenant_id: string,
    employee_id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Employee> {
    const db = tx ?? this.prisma;
    // Soft-deactivate via `status` while RETAINING the record for historical
    // reference (Requirement 6.5 / design: "soft-deactivation via status,
    // record retained"). We intentionally do NOT set `deleted_at` here: doing so
    // would hide the row from scoped reads (which filter `deleted_at: null`) and
    // break read-back of the deactivated employee. `termination_date` records
    // when the employee was deactivated.
    const employee = await db.employees.update({
      where: {
        id: employee_id,
        tenant_id: tenant_id,
      },
      data: {
        status: "terminated",
        termination_date: new Date(),
        updated_at: new Date(),
      },
      include: { locations: true,
        departments: true,
      },
    });

    return this.mapEmployee(employee);
  }

  // ============================================================
  // ATTENDANCE MANAGEMENT
  // ============================================================

  async getAttendance(
    tenant_id: string,
    location_id?: string,
    employee_id?: string,
    start_date?: string,
    end_date?: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ data: Attendance[]; total: number }> {
    const where: any = { 
      tenant_id: tenant_id,
      deleted_at: null,
    };

    if (location_id) where.location_id = location_id;
    if (employee_id) where.employee_id = employee_id;
    if (start_date || end_date) {
      where.date = {};
      if (start_date) where.date.gte = new Date(start_date);
      if (end_date) where.date.lte = new Date(end_date);
    }

    const [records, total] = await Promise.all([
      this.prisma.hr_attendance_records.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.hr_attendance_records.count({ where }),
    ]);

    return {
      data: records.map(rec => this.mapAttendance(rec)),
      total,
    };
  }

  async getGlobalAttendance(
    employee_id?: string,
    start_date?: string,
    end_date?: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ data: Attendance[]; total: number }> {
    const where: any = {};
    if (employee_id) where.employee_id = employee_id;
    if (start_date || end_date) {
      where.date = {};
      if (start_date) where.date.gte = new Date(start_date);
      if (end_date) where.date.lte = new Date(end_date);
    }

    const [attendance, total] = await Promise.all([
      this.prisma.hr_attendance_records.findMany({
        where: {
          employee_id: employee_id,
          date: start_date || end_date ? {
            gte: start_date ? new Date(start_date) : undefined,
            lte: end_date ? new Date(end_date) : undefined,
          } : undefined,
          deleted_at: null,
        },
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.hr_attendance_records.count({
        where: {
          employee_id: employee_id,
          date: start_date || end_date ? {
            gte: start_date ? new Date(start_date) : undefined,
            lte: end_date ? new Date(end_date) : undefined,
          } : undefined,
          deleted_at: null,
        },
      }),
    ]);

    return {
      data: attendance.map(this.mapAttendance),
      total,
    };
  }

  async clock_in(
    tenant_id: string,
    employee_id: string,
    location_id: string,
    shift_id?: string,
    method: string = "manual",
    metadata?: any,
    tx?: Prisma.TransactionClient,
  ): Promise<Attendance> {
    const db = tx ?? this.prisma;
    const now = new Date();

    const attendance = await db.hr_attendance_records.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        employee_id: employee_id,
        location_id: location_id,
        shift_id: shift_id || null,
        date: now,
        status: "present",
        check_in: {
          time: now.toISOString(),
          method,
          ...(metadata?.gps ? { gps: metadata.gps } : {}),
          ...(metadata?.device_id ? { device_id: metadata.device_id } : {}),
        },
        work_duration_minutes: 0,
        metadata: metadata || {},
        updated_at: new Date(),
      },
    });

    return this.mapAttendance(attendance);
  }

  async clock_out(tenant_id: string, employee_id: string, tx?: Prisma.TransactionClient): Promise<Attendance> {
    const db = tx ?? this.prisma;
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];

    // Find today's attendance record
    const todayAttendance = await db.hr_attendance_records.findFirst({
      where: {
        tenant_id: tenant_id,
        employee_id: employee_id,
        date: {
          gte: new Date(dateStr + "T00:00:00Z"),
          lt: new Date(dateStr + "T23:59:59Z"),
        },
        check_out: null as any,
        deleted_at: null,
      },
      orderBy: { date: "desc" },
    });

    if (!todayAttendance) {
      throw new Error("No active clock-in found for today");
    }

    // Calculate work duration in minutes
    const checkInData = todayAttendance.check_in as any;
    const clockInTime = new Date(checkInData?.time || todayAttendance.date);
    const durationMinutes = Math.floor(
      (now.getTime() - clockInTime.getTime()) / (1000 * 60),
    );

    const attendance = await db.hr_attendance_records.update({
      where: { id: todayAttendance.id },
      data: {
        check_out: {
          time: now.toISOString(),
          method: "manual",
        },
        work_duration_minutes: durationMinutes,
      },
    });

    return this.mapAttendance(attendance);
  }

  async assignShift(tenant_id: string, employee_id: string, shift_id: string, location_id: string, date: string, tx?: Prisma.TransactionClient): Promise<void> {
    const db = tx ?? this.prisma;
    await db.schedule_assignments.create({
      data: {
        tenant_id: tenant_id,
        employee_id: employee_id,
        shift_id: shift_id,
        location_id: location_id,
        effective_date: new Date(date),
      },
    });
  }

  // ============================================================
  // LEAVE MANAGEMENT
  // ============================================================

  async getLeaveRequests(
    tenant_id: string,
    location_id?: string,
    status?: string,
    employee_id?: string,
  ): Promise<LeaveRequest[]> {
    const where: any = { tenant_id: tenant_id };

    // Location filtering rides the employee relation: `leave_requests` has no
    // `location_id` column of its own, so we constrain the related employee's
    // location. The Prisma relation field is `employees` (see schema), so the
    // nested filter must use that name — `where.employee` is not a valid field
    // and would raise a Prisma validation error (HTTP 500) at query time.
    if (location_id) {
      where.employees = { location_id: location_id };
    }
    // Status filtering is reconciled across the pending/requested split (the
    // column default is `requested`, submit now persists `pending`) via
    // `buildStatusFilter`, so a `pending` filter matches both literals.
    if (status) where.status = this.buildStatusFilter(status);
    if (employee_id) where.employee_id = employee_id;

    const requests = await this.prisma.leave_requests.findMany({
      where,
      orderBy: { id: 'desc' }
    });

    return requests.map(req => this.mapLeaveRequest(req));
  }


  async getLeaveRequestById(tenant_id: string, id: string): Promise<LeaveRequest | null> {
    const request = await this.prisma.leave_requests.findFirst({
      where: { id, tenant_id: tenant_id },
    });
    return request ? this.mapLeaveRequest(request) : null;
  }

  async getGlobalLeaveRequests(
    status?: string,
    employee_id?: string,
  ): Promise<LeaveRequest[]> {
    const where: any = {};
    if (status) where.status = this.buildStatusFilter(status);
    if (employee_id) where.employee_id = employee_id;
    where.deleted_at = null;

    const requests = await this.prisma.leave_requests.findMany({
      where,
      orderBy: { id: 'desc' }
    });

    return requests.map(this.mapLeaveRequest);
  }

  async createLeaveRequest(
    tenant_id: string,
    data: CreateLeaveRequestDto,
    tx?: Prisma.TransactionClient,
  ): Promise<LeaveRequest> {
    // Honour the optional transaction client so the insert participates in the
    // service's `$transaction` together with the audit log (Requirement 4.1/4.4).
    // Previously this ignored `tx` and wrote on `this.prisma`, so the create and
    // its audit log were not atomic.
    const db = tx ?? this.prisma;
    const start_date = new Date(data.start_date);
    const end_date = new Date(data.end_date);

    const request = await db.leave_requests.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        employee_id: data.employee_id,
        department_id: data.department_id || data.employee_id, 
        type: data.leave_type,
        start_date: start_date,
        end_date: end_date,
        reason: data.reason,
        // Persist the canonical pending state on submit (Requirement 9.1). The
        // design models the initial state as `pending`; the read mapper also
        // normalises any legacy `requested` rows to `pending`.
        status: "pending",
        updated_at: new Date(),
      },
    });

    return this.mapLeaveRequest(request);
  }

  async approveLeaveRequest(
    tenant_id: string,
    request_id: string,
    reviewerId: string,
    notes?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<LeaveRequest> {
    const db = tx ?? this.prisma;
    // Record the reviewer identity (`approved_by`) and decision time
    // (`approved_at`) — the real schema columns — plus the optional reviewer
    // note in `review_notes` (Requirements 9.2). The pending-state guard lives
    // in `HrLeaveService` so an invalid transition surfaces as a 400 before any
    // write occurs (Requirement 9.4).
    const request = await db.leave_requests.update({
      where: {
        id: request_id,
        tenant_id: tenant_id,
      },
      data: {
        status: "approved",
        approved_by: reviewerId,
        approved_at: new Date(),
        review_notes: notes ?? undefined,
        updated_at: new Date(),
      },
    });

    return this.mapLeaveRequest(request);
  }

  async rejectLeaveRequest(
    tenant_id: string,
    request_id: string,
    reviewerId: string,
    notes: string,
    tx?: Prisma.TransactionClient,
  ): Promise<LeaveRequest> {
    const db = tx ?? this.prisma;
    // Record the reviewer identity/time and persist the supplied rejection note
    // to `review_notes` (Requirement 9.3). The pending-state guard in
    // `HrLeaveService` rejects non-pending transitions with a 400 (Req 9.4).
    const request = await db.leave_requests.update({
      where: {
        id: request_id,
        tenant_id: tenant_id,
      },
      data: {
        status: "rejected",
        approved_by: reviewerId,
        approved_at: new Date(),
        review_notes: notes,
        updated_at: new Date(),
      },
    });

    return this.mapLeaveRequest(request);
  }

  // ============================================================
  // PAYROLL MANAGEMENT
  // ============================================================

  async getPayroll(
    tenant_id: string,
    location_id?: string,
    employee_id?: string,
    period?: string,
  ): Promise<Payroll[]> {
    // Strictly tenant-scoped read: tenant_id is always required so a payroll
    // line from another tenant can never be returned (Requirement 10.6).
    const where: any = {
      tenant_id: tenant_id,
    };

    // Location filter traverses the `employees` relation (the Prisma relation
    // field is `employees`, not `employee`); using the wrong relation name
    // raised a Prisma validation error surfaced to the caller as a 500.
    if (location_id) {
      where.employees = { location_id: location_id };
    }
    if (employee_id) {
      where.employee_id = employee_id;
    }
    // payroll_lines has no `period` column; the period lives on the parent
    // hr_payroll_runs row (period_start/period_end). Filter through the run
    // relation so a "YYYY-MM" period narrows results to that month's run.
    if (period) {
      const [period_start, period_end] = this.getPeriodDates(period);
      where.hr_payroll_runs = {
        period_start: { gte: period_start },
        period_end: { lte: period_end },
      };
    }

    const payrollLines = await this.prisma.payroll_lines.findMany({
      where,
      include: {
        hr_payroll_runs: true,
      },
      orderBy: { id: 'desc' }
    });

    return payrollLines.map(line => this.mapPayroll(line));
  }

  async getGlobalPayroll(
    employee_id: string,
    period?: string,
  ): Promise<Payroll[]> {
    const where: any = { employee_id: employee_id };
    if (period) where.period = period;
    where.deleted_at = null;

    const payrolls = await this.prisma.payroll_lines.findMany({
      where,
      orderBy: { id: 'desc' }
    });

    return payrolls.map(this.mapPayroll);
  }

  async getPayrollRuns(tenant_id: string): Promise<PayrollRun[]> {
    return this.prisma.hr_payroll_runs.findMany({
      where: { tenant_id },
      orderBy: { created_at: "desc" },
    }) as any;
  }

  async getPayrollRunById(tenant_id: string, id: string, tx?: Prisma.TransactionClient): Promise<PayrollRun | null> {
    // Composite-key, tenant-scoped read. Map the raw snake_case row onto the
    // PayrollRun entity (camelCase aliases) via mapRun so downstream consumers
    // (e.g. HrSettlementService) read `totalGrossPay`/`totalNetPay`/`baseCurrency`
    // instead of `undefined`. Returning the raw row here was silently breaking the
    // Finance payroll handshake.
    //
    // When a `tx` is supplied the read executes on the transaction client so the
    // state read + guard + status write form a single Atomic_Operation (Req 4.1):
    // a concurrent lifecycle transition cannot race between the guard and the write.
    const db = tx ?? this.prisma;
    const row = await db.hr_payroll_runs.findFirst({
      where: { id, tenant_id },
    });
    return row ? this.mapRun(row) : null;
  }

  async updatePayrollRun(tenant_id: string, id: string, data: Partial<PayrollRun>, tx?: Prisma.TransactionClient): Promise<PayrollRun> {
    const db = tx ?? this.prisma;
    return db.hr_payroll_runs.update({
      where: { id, tenant_id },
      data: {
        ...data,
        updated_at: new Date(),
      } as any,
    }) as any;
  }

  // ============================================================
  // ORGANIZATION MANAGEMENT
  // ============================================================

  async getDepartments(tenant_id: string): Promise<Department[]> {
    const departments = await this.prisma.departments.findMany({
      where: { tenant_id: tenant_id, deleted_at: null },
      orderBy: { name: "asc" },
    });
    return departments.map(this.mapDepartment);
  }

  async getGlobalDepartments(): Promise<Department[]> {
    const departments = await this.prisma.departments.findMany({
      where: { deleted_at: null },
      orderBy: { name: "asc" },
    });

    return departments.map(this.mapDepartment);
  }

  async getDepartmentById(
    tenant_id: string,
    department_id: string,
  ): Promise<Department | null> {
    const department = await this.prisma.departments.findFirst({
      where: { id: department_id, tenant_id: tenant_id, deleted_at: null },
    });
    return department ? this.mapDepartment(department) : null;
  }

  async createDepartment(
    tenant_id: string,
    data: CreateDepartmentDto,
    tx?: Prisma.TransactionClient,
  ): Promise<Department> {
    const db = tx ?? this.prisma;
    const department = await db.departments.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        name: data.name,
        code: data.code,
        head_id: data.headId,
        description: data.description,
        status: "active",
        updated_at: new Date(),
      },
    });
    return this.mapDepartment(department);
  }



  // ============================================================
  // RECRUITMENT MANAGEMENT
  // ============================================================

  async getRequisitions(
    tenant_id: string,
    status?: string,
  ): Promise<JobRequisition[]> {
    const where: any = { tenant_id: tenant_id };
    if (status) where.status = status;

    const requisitions = await this.prisma.job_requisitions.findMany({
      where,
      orderBy: { id: 'desc' }
    });
    return requisitions.map(req => this.mapRequisition(req));
  }

  async getGlobalRequisitions(status?: string): Promise<JobRequisition[]> {
    const where: any = {};
    if (status) where.status = status;

    const requisitions = await this.prisma.job_requisitions.findMany({
      where,
      orderBy: { id: 'desc' }
    });

    return requisitions.map(this.mapRequisition);
  }

  async createRequisition(
    tenant_id: string,
    data: CreateRequisitionDto,
    tx?: Prisma.TransactionClient,
  ): Promise<JobRequisition> {
    const db = tx ?? this.prisma;
    const requisition = await db.job_requisitions.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        department_id: data.department_id,
        title: data.title,
        openings: data.openings,
        status: "open",
        updated_at: new Date(),
      },
    });
    return this.mapRequisition(requisition);
  }

  async updateRequisition(
    tenant_id: string,
    id: string,
    data: Partial<JobRequisition>,
    tx?: Prisma.TransactionClient,
  ): Promise<JobRequisition> {
    const db = tx ?? this.prisma;
    try {
      const requisition = await db.job_requisitions.update({
        where: { id, tenant_id: tenant_id },
        data: data as Prisma.job_requisitionsUpdateInput,
      });
      return this.mapRequisition(requisition);
    } catch (error) {
      handlePrismaFkError(error, 'JobRequisition');
    }
  }

  // ============================================================
  // PERFORMANCE MANAGEMENT
  // ============================================================

  async getPerformanceCycles(tenant_id: string): Promise<PerformanceCycle[]> {
    const cycles = await this.prisma.hr_performance_cycles.findMany({
      where: { tenant_id: tenant_id, deleted_at: null },
      orderBy: { id: 'desc' }
    });
    return cycles.map((c) => this.mapPerformanceCycle(c));
  }

  async getPerformanceCycleById(tenant_id: string, id: string): Promise<PerformanceCycle | null> {
    const cycle = await this.prisma.hr_performance_cycles.findFirst({
      where: { id, tenant_id: tenant_id, deleted_at: null },
    });
    return cycle ? this.mapPerformanceCycle(cycle) : null;
  }


  async createPerformanceCycle(
    tenant_id: string,
    data: CreatePerformanceCycleDto,
    tx?: Prisma.TransactionClient,
  ): Promise<PerformanceCycle> {
    const db = tx ?? this.prisma;
    const cycle = await db.hr_performance_cycles.create({
      data: {
        tenant_id: tenant_id,
        name: data.name,
        start_date: new Date(data.start_date),
        end_date: new Date(data.end_date),
        due_date: new Date(data.dueDate),
        status: "active",
      },
    });
    return this.mapPerformanceCycle(cycle);
  }

  async updatePerformanceCycle(
    tenant_id: string,
    id: string,
    data: any,
    tx?: Prisma.TransactionClient,
  ): Promise<PerformanceCycle> {
    const db = tx ?? this.prisma;
    const updated = await db.hr_performance_cycles.update({
      where: { id, tenant_id: tenant_id },
      data,
    });
    return this.mapPerformanceCycle(updated);
  }

  async getPerformanceReviews(
    tenant_id: string,
    cycleId?: string,
    employee_id?: string,
  ): Promise<PerformanceReview[]> {
    const where: any = { tenant_id: tenant_id };
    if (cycleId) where.cycle_id = cycleId;
    if (employee_id) where.employee_id = employee_id;

    const reviews = await this.prisma.performance_reviews.findMany({
      where,
      orderBy: { id: 'desc' }
    });

    return reviews.map((r: any) => this.mapPerformanceReview(r));
  }

  async getGlobalPerformanceReviews(cycleId?: string, employee_id?: string): Promise<PerformanceReview[]> {
    const where: any = {};
    if (cycleId) where.cycle_id = cycleId;
    if (employee_id) where.employee_id = employee_id;
    where.deleted_at = null;

    const reviews = await this.prisma.performance_reviews.findMany({
      where,
      orderBy: { id: 'desc' }
    });

    return reviews.map((r: any) => this.mapPerformanceReview(r));
  }


  async submitPerformanceReview(
    tenant_id: string,
    data: SubmitReviewDto,
    tx?: Prisma.TransactionClient,
  ): Promise<PerformanceReview> {
    const db = tx ?? this.prisma;
    const review = await db.performance_reviews.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        cycle_id: data.cycleId,
        employee_id: data.employee_id,
        reviewer_id: data.reviewerId,
        rating: data.rating,
        comments: data.comments,
        status: "submitted",
        updated_at: new Date(),
      },
    });
    return this.mapPerformanceReview(review);
  }

  // ============================================================
  // CASE MANAGEMENT
  // ============================================================

  async getCases(
    tenant_id: string,
    location_id?: string,
    status?: string,
  ): Promise<HRCase[]> {
    const where: any = { tenant_id: tenant_id, deleted_at: null };
    if (location_id) where.employee = { location_id: location_id };
    if (status) where.status = status;

    const cases = await this.prisma.hr_cases.findMany({
      where,
      orderBy: { id: 'desc' }
    });
    return cases.map((c) => this.mapHRCase(c));
  }

  async createCase(tenant_id: string, data: CreateCaseDto, tx?: Prisma.TransactionClient): Promise<HRCase> {
    const db = tx ?? this.prisma;
    const hrCase = await (db as any).hr_cases.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        employee_id: data.employee_id,
        department_id: data.department_id,
        title: data.title,
        type: data.type,
        priority: (data.priority as any) || "medium",
        status: "open",
        updated_at: new Date(),
      },
    });
    return this.mapHRCase(hrCase);
  }

  async updateCase(tenant_id: string, id: string, data: any, tx?: Prisma.TransactionClient): Promise<HRCase> {
    const db = tx ?? this.prisma;
    const updated = await db.hr_cases.update({
      where: { id, tenant_id: tenant_id },
      data,
    });
    return this.mapHRCase(updated);
  }


  // ============================================================
  // CONTRACT MANAGEMENT
  // ============================================================

  async getContracts(
    tenant_id: string,
    location_id?: string,
    employee_id?: string,
  ): Promise<Contract[]> {
    // NOTE: contracts table has no deleted_at column — filter only by tenant_id and optional fields
    const where: any = { tenant_id: tenant_id };
    if (location_id) where.employee = { location_id: location_id };
    if (employee_id) where.employee_id = employee_id;

    const contracts = await this.prisma.contracts.findMany({
      where,
      orderBy: { id: 'desc' }
    });

    return contracts.map((c: any) => this.mapContract(c));
  }

  async getGlobalContracts(employee_id?: string): Promise<Contract[]> {
    const where: any = { deleted_at: null };
    if (employee_id) where.employee_id = employee_id;

    const contracts = await this.prisma.contracts.findMany({
      where,
      orderBy: { id: 'desc' }
    });

    return contracts.map((c: any) => this.mapContract(c));
  }

  async createContract(tenant_id: string, data: CreateContractDto, tx?: Prisma.TransactionClient): Promise<Contract> {
    const db = tx ?? this.prisma;
    const contract = await db.contracts.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        employee_id: data.employee_id,
        title: data.title,
        type: data.type,
        url: data.url,
        status: "ACTIVE",
        start_date: new Date(data.start_date),
        end_date: data.end_date ? new Date(data.end_date) : undefined,
        updated_at: new Date(),
      },
    });
    return this.mapContract(contract);
  }

  async updateContract(tenant_id: string, id: string, data: any, tx?: Prisma.TransactionClient): Promise<Contract> {
    const db = tx ?? this.prisma;
    const updated = await db.contracts.update({
      where: { id, tenant_id: tenant_id },
      data: {
        ...data,
        updated_at: new Date(),
      },
    });
    return this.mapContract(updated);
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  private getPeriodDates(period: string): [Date, Date] {
    // Expecting format: YYYY-MM
    const [year, month] = period.split("-").map(Number);
    const period_start = new Date(year, month - 1, 1);
    const period_end = new Date(year, month, 0); // Last day of month
    return [period_start, period_end];
  }

  // ============================================================
  // MAPPERS
  // ============================================================

  private mapEmployee(e: any): Employee {
    return {
      id: e.id,
      tenant_id: e.tenant_id,
      company_id: e.company_id || undefined,
      location_id: e.location_id || undefined,
      employee_code: e.employee_code,
      first_name: e.first_name,
      last_name: e.last_name,
      full_name: `${e.first_name} ${e.last_name}`,
      email: e.email,
      phone: e.phone,
      department_id: e.department_id,
      manager_id: e.manager_id || undefined,
      user_id: e.user_id || undefined,
      role_title: (e as any).positions || e.role_title || "",
      position: (e as any).positions || "",
      position_id: e.position_id || undefined,
      status: e.status?.toLowerCase() as any,
      employment_type: e.employment_type as any,
      base_salary: e.base_salary ? Number(e.base_salary) : undefined,
      hourly_rate: e.hourly_rate ? Number(e.hourly_rate) : undefined,
      hire_date: e.hire_date,
      termination_date: e.termination_date || undefined,
      documents_metadata: e.document_metadata,
      hr_employee_skills: (e as any).hr_employee_skills ? (e as any).hr_employee_skills.map((es: any) => this.mapEmployeeSkill(es)) : undefined,
      companies: e.companies,
      currency: e.companies?.currency || "USD",
      created_at: e.created_at,
      updated_at: e.updated_at,
    };
  }

  private mapAttendance(a: any): Attendance {
    return {
      id: a.id,
      tenant_id: a.tenant_id,
      employee_id: a.employee_id,
      location_id: a.location_id,
      date: a.date,
      check_in: a.check_in,
      check_out: a.check_out,
      check_in_time: a.check_in_time,
      check_out_time: a.check_out_time,
      status: a.status as any,
      type: a.type,
      source: a.source,
      device_id: a.device_id,
      lateness_minutes: a.lateness_minutes,
      early_leave_minutes: a.early_leave_minutes,
      overtime_minutes: a.overtime_minutes,
      is_locked: a.is_locked,
      metadata: a.metadata,
      audit_log: a.audit_log,
      created_at: a.created_at,
      updated_at: a.updated_at,
      deleted_at: a.deleted_at,
      shift_id: a.shift_id,
      work_duration_minutes: a.work_duration_minutes,
      work_schedule_id: a.work_schedule_id,
      work_shift_id: a.work_shift_id,
    };
  }

  /**
   * Translates a caller-supplied leave status filter into a Prisma `where`
   * clause that is robust to the pending/requested reconciliation (Req 9.5).
   *
   * Leave submit now persists the canonical literal `pending`, but legacy rows
   * (and the DB column default) may still store `requested`. The read mapper
   * normalises `requested` -> `pending` on the way out, so a caller filtering
   * by `pending` expects to see those legacy rows too. We therefore expand a
   * `pending` filter to an `IN ['pending','requested']` clause. All other
   * statuses match exactly. Tenant scoping is applied by the caller and is left
   * untouched here.
   */
  private buildStatusFilter(status: string): any {
    // Persisted statuses are canonical lowercase (`pending`/`approved`/
    // `rejected`/`cancelled`, plus the legacy `requested` default), and the read
    // mapper lowercases on the way out. Normalise the caller's filter the same
    // way so matching is case-insensitive and consistent with returned values.
    const normalized = status.toLowerCase();
    return normalized === "pending"
      ? { in: ["pending", "requested"] }
      : normalized;
  }

  private mapLeaveRequest(l: any): LeaveRequest {
    // Map the real `leave_requests` columns onto the design-aligned entity.
    // The schema stores the reviewer/decision in `approved_by` / `approved_at`
    // and the reviewer note in `review_notes`; it has no `reviewed_by`,
    // `reviewed_at`, `requested_at`, `leave_type`, or `total_days` columns, so
    // those are derived here (Requirement 5 field-mapping discipline). The
    // canonical state is `pending`; a legacy `requested` value is normalised to
    // `pending` so the API surface is consistent (Requirement 9.1).
    const start_date = new Date(l.start_date);
    const end_date = new Date(l.end_date);
    const rawStatus = String(l.status ?? "").toLowerCase();
    const status = rawStatus === "requested" ? "pending" : rawStatus;

    // No `total_days` column exists; derive an inclusive day count from the
    // persisted date range so reads return a sensible number rather than NaN.
    const total_days =
      !isNaN(start_date.getTime()) && !isNaN(end_date.getTime())
        ? Math.floor((end_date.getTime() - start_date.getTime()) / 86_400_000) + 1
        : 0;

    return {
      id: l.id,
      tenant_id: l.tenant_id,
      employee_id: l.employee_id,
      leave_type: l.type as any,
      start_date: l.start_date,
      end_date: l.end_date,
      total_days,
      reason: l.reason,
      status: status as any,
      requested_at: l.created_at,
      reviewed_by: l.approved_by ?? undefined,
      reviewed_at: l.approved_at ?? undefined,
      review_notes: l.review_notes ?? undefined,
      created_at: l.created_at,
      updated_at: l.updated_at,
    };
  }

  private mapPayroll(p: any): Payroll {
    // The findMany include exposes the parent run under the `hr_payroll_runs`
    // relation key, so read that (the old `hrPayrollRun` alias was always
    // undefined, which left period/paidAt empty on every returned record).
    const payrollRun = p.hr_payroll_runs || {};
    const period = payrollRun.period_start
      ? `${new Date(payrollRun.period_start).getFullYear()}-${String(new Date(payrollRun.period_start).getMonth() + 1).padStart(2, "0")}`
      : "unknown";

    return {
      id: p.id,
      tenant_id: p.tenant_id,
      employee_id: p.employee_id,
      period,
      base_salary: Number(p.gross_pay),
      bonuses: 0,
      deductions: Number(p.adjustments),
      grossPay: Number(p.gross_pay),
      netPay: Number(p.net_pay),
      status: "approved" as any,
      paidAt: payrollRun.pay_date || undefined,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  }

  private mapDepartment(d: any): Department {
    return {
      id: d.id,
      tenant_id: d.tenant_id,
      name: d.name,
      code: d.code,
      headId: d.head_id,
      description: d.description,
      status: d.status as any,
      created_at: d.created_at,
      updated_at: d.updated_at,
    };
  }

  async getLocations(tenant_id: string): Promise<any[]> {
    return this.prisma.locations.findMany({
      where: { tenant_id: tenant_id },
    });
  }


  private mapRequisition(r: any): JobRequisition {
    return {
      id: r.id,
      tenant_id: r.tenant_id,
      department_id: r.department_id,
      title: r.title,
      status: r.status as any,
      openings: r.openings,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  private mapPerformanceCycle(c: any): PerformanceCycle {
    return {
      id: c.id,
      tenant_id: c.tenant_id,
      name: c.name,
      status: c.status as any,
      start_date: c.start_date,
      end_date: c.end_date,
      dueDate: c.due_date,
      created_at: c.created_at,
      updated_at: c.updated_at,
    };
  }

  private mapPerformanceReview(r: any): PerformanceReview {
    return {
      id: r.id,
      tenant_id: r.tenant_id,
      cycleId: r.cycle_id,
      employee_id: r.employee_id,
      reviewerId: r.reviewer_id,
      status: r.status as any,
      rating: r.rating,
      comments: r.comments,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  private mapReview = this.mapPerformanceReview.bind(this);

  private mapHRCase(c: any): HRCase {
    return {
      id: c.id,
      tenant_id: c.tenant_id,
      employee_id: c.employee_id,
      department_id: c.department_id,
      title: c.title,
      type: c.type,
      status: c.status as any,
      priority: c.priority as any,
      owner_id: c.owner_id || undefined,
      created_at: c.created_at,
      updated_at: c.updated_at,
    };
  }

  private mapContract(c: any): Contract {
    return {
      id: c.id,
      tenant_id: c.tenant_id,
      employee_id: c.employee_id,
      title: c.title,
      type: c.type,
      status: c.status as any,
      start_date: c.start_date,
      end_date: c.end_date,
      url: c.url,
      created_at: c.created_at,
      updated_at: c.updated_at,
    };
  }

  private mapCandidate(c: any): Candidate {
    return {
      id: c.id,
      tenant_id: c.tenant_id,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone || undefined,
      requisitionId: c.requisition_id,
      source: c.source,
      status: c.status as any,
      resumeUrl: c.resume_url || undefined,
      metadata: (c.metadata as any) || {},
      created_at: c.created_at,
      updated_at: c.updated_at,
    };
  }

  private mapPosition(p: any): Position {
    return {
      id: p.id,
      tenant_id: p.tenant_id,
      location_id: p.location_id,
      department_id: p.department_id,
      title: p.title,
      grade: p.grade,
      status: p.status as any,
      budgetedSalary: p.budgeted_salary ? Number(p.budgeted_salary) : undefined,
      reportsToPositionId: p.reports_to_position_id || undefined,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  }

  private mapCompensation(c: any): Compensation {
    return {
      id: c.id,
      tenant_id: c.tenant_id,
      employee_id: c.employee_id,
      base_salary: Number(c.base_salary),
      currency: c.currency,
      payFrequency: c.pay_frequency as any,
      allowances: (c.allowances as any) || [],
      bonuses: (c.bonuses as any) || [],
      effectiveDate: c.effective_date,
      created_at: c.created_at,
      updated_at: c.updated_at,
    };
  }

  private mapInterview(i: any): Interview {
    return {
      id: i.id,
      tenant_id: i.tenant_id,
      candidateId: i.candidate_id,
      interviewerId: i.interviewer_id,
      title: i.title,
      scheduledAt: i.scheduled_at,
      duration: i.duration,
      location: i.location || undefined,
      status: i.status as any,
      notes: i.notes || undefined,
      created_at: i.created_at,
      updated_at: i.updated_at,
    };
  }

  private mapLead(l: any): TalentLead {
    return {
      id: l.id,
      tenant_id: l.tenant_id,
      source: l.source,
      externalProfileUrl: l.external_profile_url || undefined,
      name: l.name,
      email: l.email || undefined,
      phone: l.phone || undefined,
      headline: l.headline || undefined,
      skills: (l.skills as any) || [],
      leadScore: l.lead_score,
      status: l.status as any,
      metadata: (l.metadata as any) || {},
      created_at: l.created_at,
      updated_at: l.updated_at,
    };
  }

  private mapDocument(d: any): ComplianceDocument {
    return {
      id: d.id,
      tenant_id: d.tenant_id,
      employee_id: d.employee_id,
      documentType: d.document_type,
      documentNumber: d.document_number || undefined,
      fileUrl: d.file_url,
      expiryDate: d.expiry_date || undefined,
      verification_status: d.verification_status,
      verified_by: d.verified_by || undefined,
      verified_at: d.verified_at || undefined,
      metadata: (d.metadata as any) || {},
      created_at: d.created_at,
      updated_at: d.updated_at,
    };
  }

  private mapScenario(s: any): BudgetScenario {
    return {
      id: s.id,
      tenant_id: s.tenant_id,
      name: s.name,
      fiscal_year: s.fiscal_year,
      status: s.status,
      total_budget: Number(s.total_budget),
      description: s.description || undefined,
      created_at: s.created_at,
      updated_at: s.updated_at,
    };
  }

  private mapPlan(p: any): HeadcountPlan {
    return {
      id: p.id,
      tenant_id: p.tenant_id,
      scenario_id: p.scenario_id,
      department_id: p.department_id,
      position_title: p.position_title,
      target_headcount: p.target_headcount,
      projected_salary: Number(p.projected_salary),
      planned_hire_date: p.planned_hire_date,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  }

  private mapRate(r: any): ExchangeRate {
    return {
      id: r.id,
      tenant_id: r.tenant_id,
      fromCurrency: r.from_currency,
      toCurrency: r.to_currency,
      rate: Number(r.rate),
      effectiveDate: r.effective_date,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  private mapRun(r: any): PayrollRun {
    return {
      id: r.id,
      tenant_id: r.tenant_id,
      period_start: r.period_start,
      period_end: r.period_end,
      status: r.status,
      totalGrossPay: Number(r.total_gross_pay),
      totalNetPay: Number(r.total_net_pay),
      baseCurrency: r.base_currency,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }
  private mapLine(l: any): PayrollLine {
    return {
      id: l.id,
      tenant_id: l.tenant_id,
      payrollRunId: l.payroll_run_id,
      employee_id: l.employee_id,
      base_salary: Number(l.base_salary),
      total_work_hours: l.total_work_hours,
      overtime_pay: Number(l.overtime_pay),
      sales_bonus: Number(l.sales_bonus),
      manual_bonus: Number(l.manual_bonus),
      gross_income: Number(l.gross_income),
      grossPay: Number(l.gross_pay),
      netPay: Number(l.net_pay),
      tax_amount: Number(l.tax_amount),
      adjustments: Number(l.adjustments || 0),
      deductions_total: Number(l.deductions_total),
      breakdown_json: (l.breakdown_json as any) || {},
      checksum: l.checksum || undefined,
      created_at: l.created_at,
      updated_at: l.updated_at,
    };
  }

  private mapDisbursementLog(l: any): any {
    return {
      id: l.id,
      tenant_id: l.tenant_id,
      payrollRunId: l.payroll_run_id,
      status: l.status,
      bankFileName: l.bank_file_name,
      disbursedAt: l.disbursed_at,
      disbursedBy: l.disbursed_by,
      totalAmount: l.total_amount,
      errorMessage: l.error_message,
      createdAt: l.created_at,
      updatedAt: l.updated_at,
    };
  }

  private mapSuccessionPlan(p: any): SuccessionPlan {
    return {
      id: p.id,
      tenant_id: p.tenant_id,
      position_id: p.position_id,
      isCritical: p.is_critical,
      strategy: p.strategy,
      notes: p.notes,
      candidates: p.candidates?.map((c: any) => this.mapSuccessionCandidate(c)),
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  }

  private mapSuccessionCandidate(c: any): SuccessionCandidate {
    return {
      id: c.id,
      tenant_id: c.tenant_id,
      planId: c.plan_id,
      employee_id: c.employee_id,
      readiness: c.readiness,
      readinessScore: c.readiness_score,
      riskOfLoss: c.risk_of_loss,
      impactOfLoss: c.impact_of_loss,
      skillGaps: c.skill_gaps,
      created_at: c.created_at,
      updated_at: c.updated_at,
    };
  }

  private mapSkill(s: any): Skill {
    return {
      id: s.id,
      tenant_id: s.tenant_id,
      name: s.name,
      category: s.category,
      description: s.description,
      created_at: s.created_at,
      updated_at: s.updated_at,
    };
  }

  private mapEmployeeSkill(es: any): EmployeeSkill {
    return {
      id: es.id,
      tenant_id: es.tenant_id,
      employee_id: es.employee_id,
      skill_id: es.skill_id,
      proficiency: es.proficiency,
      verification_status: es.verification_status,
      verified_by: es.verified_by,
      verified_at: es.verified_at,
      skill: es.skill ? this.mapSkill(es.skill) : undefined,
      created_at: es.created_at,
      updated_at: es.updated_at,
    };
  }

  private mapBenefitPlan(p: any): BenefitPlan {
    return {
      id: p.id,
      tenant_id: p.tenant_id,
      name: p.name,
      type: p.type,
      description: p.description,
      employerContribution: Number(p.employer_contribution),
      employeeContribution: Number(p.employee_contribution),
      frequency: p.frequency,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  }

  private mapEmployeeBenefit(b: any): EmployeeBenefit {
    return {
      id: b.id,
      tenant_id: b.tenant_id,
      employee_id: b.employee_id,
      planId: b.plan_id,
      enrollment_date: b.enrollment_date,
      status: b.status,
      coverage_amount: Number(b.coverage_amount),
      plan: (b as any).benefitPlan ? this.mapBenefitPlan((b as any).benefitPlan) : undefined,
      created_at: b.created_at,
      updated_at: b.updated_at,
    };
  }

  private mapCareerPath(p: any): CareerPath {
    return {
      id: p.id,
      tenant_id: p.tenant_id,
      from_position_id: p.from_position_id,
      to_position_id: p.to_position_id,
      requirement_notes: p.requirement_notes,
      fromPosition: p.fromPosition ? this.mapPosition(p.fromPosition) : undefined,
      toPosition: p.toPosition ? this.mapPosition(p.toPosition) : undefined,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  }

  private mapMentorshipPair(p: any): MentorshipPair {
    return {
      id: p.id,
      tenant_id: p.tenant_id,
      mentorId: p.mentor_id,
      menteeId: p.mentee_id,
      status: p.status,
      start_date: p.start_date,
      end_date: p.end_date,
      focusSkills: p.focus_skills,
      mentor: p.employees_hr_mentorship_pairs_mentor_idToemployees ? this.mapEmployee(p.employees_hr_mentorship_pairs_mentor_idToemployees) : undefined,
      mentee: p.employees_hr_mentorship_pairs_mentee_idToemployees ? this.mapEmployee(p.employees_hr_mentorship_pairs_mentee_idToemployees) : undefined,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  }

  private mapPositionSkill(ps: any): PositionSkill {
    return {
      id: ps.id,
      tenant_id: ps.tenant_id,
      position_id: ps.position_id,
      skill_id: ps.skill_id,
      minProficiency: ps.min_proficiency,
      isMandatory: ps.is_mandatory,
      importance: ps.importance as any,
      position: ps.positions ? this.mapPosition(ps.positions) : undefined,
      skill: ps.hr_skills ? this.mapSkill(ps.hr_skills) : undefined,
      created_at: ps.created_at,
      updated_at: ps.updated_at,
    };
  }

  private mapPerformanceGoal(g: any): PerformanceGoal {
    return {
      id: g.id,
      tenant_id: g.tenant_id,
      employee_id: g.employee_id,
      title: g.title,
      description: g.description,
      targetDate: g.target_date,
      progress: g.progress,
      status: g.status,
      created_at: g.created_at,
      updated_at: g.updated_at,
    };
  }

  private mapTrainingProgram(p: any): TrainingProgram {
    return {
      id: p.id,
      tenant_id: p.tenant_id,
      name: p.name,
      status: p.status,
      completionRate: p.completion_rate,
      dueDate: p.due_date,
      skills: p.skills?.map((s: any) => (this as any).mapProgramSkill(s)),
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  }

  private mapTrainingAssignment(a: any): TrainingAssignment {
    return {
      id: a.id,
      tenant_id: a.tenant_id,
      programId: a.programId,
      employee_id: a.employee_id,
      status: a.status,
      assignedAt: a.assignedAt,
      completedAt: a.completedAt,
      program: a.program ? this.mapTrainingProgram(a.program) : undefined,
      created_at: a.created_at,
      updated_at: a.updated_at,
    };
  }


  private mapProgramSkill(s: any): ProgramSkill {
    return {
      id: s.id,
      tenant_id: s.tenant_id,
      programId: s.programId,
      skill_id: s.skill_id,
      proficiencyGain: s.proficiencyGain,
      skill: s.skill ? this.mapSkill(s.skill) : undefined,
      created_at: s.created_at,
      updated_at: s.updated_at,
    };
  }

  // ============================================================
  // TRAINING MANAGEMENT
  // ============================================================

  async getTrainingPrograms(tenant_id: string): Promise<any[]> {
    const programs = await this.prisma.training_programs.findMany({
      where: { tenant_id: tenant_id },
      orderBy: { id: 'desc' }
    });
    return programs.map((p) => this.mapTrainingProgram(p));
  }

  async createTrainingProgram(tenant_id: string, data: any): Promise<any> {
    const program = await this.prisma.training_programs.create({
      data: {
        tenant_id: tenant_id,
        name: data.name,
        status: data.status || "active",
        due_date: data.dueDate ? new Date(data.dueDate) : null,
      },
    });
    return this.mapTrainingProgram(program);
  }

  async getTrainingAssignments(tenant_id: string): Promise<any[]> {
    const assignments = await this.prisma.training_assignments.findMany({
      where: { tenant_id: tenant_id },
      orderBy: { id: 'desc' }
    });
    return assignments.map((a) => this.mapTrainingAssignment(a));
  }

  async createTrainingAssignment(tenant_id: string, data: any): Promise<any> {
    const assignment = await this.prisma.training_assignments.create({
      data: {
        tenant_id: tenant_id,
        program_id: data.programId,
        employee_id: data.employee_id,
        status: data.status || "in_progress",
        assigned_at: new Date(),
      },
    });
    return this.mapTrainingAssignment(assignment);
  }

  async updateTrainingAssignment(tenant_id: string, id: string, data: any): Promise<any> {
    const updateData: any = {};
    if (data.status) updateData.status = data.status;
    if (data.status === "completed") {
      updateData.completedAt = new Date();
    }
    const assignment = await this.prisma.training_assignments.update({
      where: { id, tenant_id: tenant_id },
      data: updateData,
    });
    return this.mapTrainingAssignment(assignment);
  }
  async getTrainingAssignmentById(tenant_id: string, id: string): Promise<any | null> {
    const assignment = await this.prisma.training_assignments.findFirst({
      where: { id, tenant_id: tenant_id },
      include: { employees: true },
    });
    return assignment ? this.mapTrainingAssignment(assignment) : null;
  }

  // Lifecycle Methods
  async promoteEmployee(tenant_id: string, employee_id: string, data: any): Promise<Employee> {
    const employee = await this.prisma.employees.update({
      where: { id: employee_id, tenant_id: tenant_id },
      data: {
        positions: data.newRole,
        base_salary: data.newSalary,
        status: "promoted",
      },
    });
    return this.mapEmployee(employee);
  }

  async transferEmployee(tenant_id: string, employee_id: string, data: any): Promise<Employee> {
    const employee = await this.prisma.employees.update({
      where: { id: employee_id, tenant_id: tenant_id },
      data: {
        location_id: data.newLocationId || data.location_id,
        department_id: data.newDepartmentId || data.department_id,
        company_id: data.newCompanyId || data.company_id,
        status: "transferred",
      },
    });
    return this.mapEmployee(employee);
  }

  async suspendEmployee(tenant_id: string, employee_id: string, reason: string): Promise<Employee> {
    const employee = await this.prisma.employees.update({
      where: { id: employee_id, tenant_id: tenant_id },
      data: {
        status: "suspended",
      },
    });
    return this.mapEmployee(employee);
  }

  // Talent & Candidate Management
  async getCandidates(tenant_id: string, status?: string): Promise<Candidate[]> {
    const where: any = { tenant_id, deleted_at: null };
    if (status) where.status = status;
    const candidates = await this.prisma.candidates.findMany({
      where,
      orderBy: { id: 'desc' }
    });
    return candidates.map((c) => this.mapCandidate(c));
  }

  async getCandidateById(tenant_id: string, id: string): Promise<Candidate | null> {
    const candidate = await this.prisma.candidates.findFirst({
      where: { id, tenant_id: tenant_id, deleted_at: null },
    });
    return candidate ? this.mapCandidate(candidate) : null;
  }

  async createCandidate(tenant_id: string, data: any, tx?: Prisma.TransactionClient): Promise<Candidate> {
    const db = tx ?? this.prisma;
    const candidate = await db.candidates.create({
      data: {
        tenant_id: tenant_id,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        requisition_id: data.requisitionId,
        source: data.source || "direct",
        status: "applied",
      },
    });
    return this.mapCandidate(candidate);
  }

  async updateCandidate(tenant_id: string, id: string, data: any, tx?: Prisma.TransactionClient): Promise<Candidate> {
    const db = tx ?? this.prisma;
    const updated = await db.candidates.update({
      where: { id, tenant_id: tenant_id },
      data,
    });
    return this.mapCandidate(updated);
  }

  async hireCandidate(tenant_id: string, candidateId: string, data: any, tx?: Prisma.TransactionClient): Promise<Employee> {
    // Pre-calculate the password hash outside the transaction to avoid holding a
    // lock during the (slow) bcrypt work.
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash("Welcome123", salt);

    // All hire writes (candidate -> hired, user provisioning, employee, initial
    // contract, outbox event) run on a single client so they commit or roll back
    // together (Req 4.1/4.2). The candidate guard reads on the SAME client inside
    // the transaction so the lookup + status check + writes cannot race a
    // concurrent hire (Req 11.2). Every write binds `tenant_id` from the verified
    // parameter — never from client input — and the employee is created within the
    // SAME `tenant_id` as the candidate.
    const run = async (client: Prisma.TransactionClient): Promise<any> => {
      const candidate = await client.candidates.findFirst({
        where: { id: candidateId, tenant_id: tenant_id, deleted_at: null },
        include: { job_requisitions: true },
      });

      // Typed error surface (Req 1.1/1.3/1.4): a missing candidate is a 404 and an
      // already-hired candidate is a 409 — not a bare Error that escapes as a 500.
      // Throwing here rolls back the enclosing transaction, so a rejected hire
      // leaves no partial employee/user/contract behind.
      if (!candidate) {
        throw new NotFoundException(`Candidate ${candidateId} not found.`);
      }
      if (candidate.status === "hired") {
        throw new ConflictException(`Candidate ${candidateId} is already hired.`);
      }

      // 1. Update Candidate Status
      await client.candidates.update({
        where: { id: candidateId },
        data: { status: "hired" },
      });

      // 2. User Provisioning
      let user = await client.users.findUnique({
        where: { tenant_id_email: { tenant_id: tenant_id, email: candidate.email } },
      });

      if (!user) {
        user = await client.users.create({
          data: {
            tenant_id: tenant_id,
            email: candidate.email,
            password_hash: password_hash,
            first_name: candidate.first_name,
            last_name: candidate.last_name,
          },
        });
      }

      await client.user_companies.upsert({
        where: { tenant_id_user_id: { user_id: user.id, tenant_id: tenant_id } },
        update: {},
        create: { user_id: user.id, tenant_id: tenant_id, role: 'MEMBER' }
      });

      // Resolve a real location within the candidate's tenant. employees.location_id
      // is a required FK, so the previous hardcoded "loc-default" fallback would
      // raise a P2003 against the live DB (Req 1.2/12.2). Prefer an explicitly
      // supplied location_id (validated to belong to this tenant), otherwise fall
      // back to the tenant's first location.
      const location = data.location_id
        ? await client.locations.findFirst({
            where: { id: data.location_id, tenant_id: tenant_id, deleted_at: null },
          })
        : await client.locations.findFirst({
            where: { tenant_id: tenant_id, deleted_at: null },
            orderBy: { created_at: "asc" },
          });
      if (!location) {
        throw new BadRequestException(
          "Cannot hire candidate: no valid location found for this tenant. Provide a valid location_id.",
        );
      }

      // Resolve a real department: explicit override -> requisition's department ->
      // the tenant's first department. employees.department_id is a required FK, so
      // the previous empty-string fallback would also break against the live DB.
      let department_id: string | undefined =
        data.department_id || candidate.job_requisitions?.department_id || undefined;
      if (!department_id) {
        const department = await client.departments.findFirst({
          where: { tenant_id: tenant_id, deleted_at: null },
          orderBy: { created_at: "asc" },
        });
        department_id = department?.id;
      }
      if (!department_id) {
        throw new BadRequestException(
          "Cannot hire candidate: no valid department found for this tenant. Provide a valid department_id.",
        );
      }

      // 3. Create Employee Record within the SAME tenant_id as the candidate
      const employee = await client.employees.create({
        data: {
          tenant_id: tenant_id,
          user_id: user.id,
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          email: candidate.email,
          phone: candidate.phone,
          location_id: location.id,
          department_id: department_id,
          positions: data.position || candidate.job_requisitions?.title || "Staff",
          employee_code: data.employee_code || `EMP-${Date.now()}`,
          status: "probation",
          hire_date: data.hire_date ? new Date(data.hire_date) : new Date(),
          base_salary: data.base_salary || 0,
        },
      });

      // 4. Create Initial Contract
      await client.contracts.create({
        data: {
          tenant_id: tenant_id,
          employee_id: employee.id,
          title: `Employment Contract - ${employee.first_name} ${employee.last_name}`,
          type: "PERMANENT",
          start_date: employee.hire_date,
          status: "active",
        },
      });

      // 5. Create Outbox Event for reliable emission
      await client.sys_outbox_events.create({
        data: {
          tenant_id: tenant_id,
          type: 'hr.employees.created.v1',
          payload: {
            employee_id: employee.id,
            candidateId,
            email: candidate.email,
          },
        },
      });

      return employee;
    };

    // When a caller supplies a transaction client (e.g. HRService/HrRecruitmentService
    // wrap the hire with audit logging + event emission), participate in THAT
    // transaction so the employee creation and the audit/event commit or roll back
    // as one Atomic_Operation (Req 4.4). Previously this method ignored `tx` and
    // always opened its own nested `$transaction`, which committed the employee
    // independently of the caller's audit/event writes — defeating atomicity.
    // With no caller transaction, open our own SERIALIZABLE transaction.
    const result = tx
      ? await run(tx)
      : await this.prisma.$transaction(run, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });

    return this.mapEmployee(result as any);
  }



  async updatePosition(tenant_id: string, id: string, data: any, tx?: Prisma.TransactionClient): Promise<Position> {
    const db = tx ?? this.prisma;
    const position = await db.positions.update({
      where: { id, tenant_id: tenant_id },
      data: {
        title: data.title,
        grade: data.grade,
        status: data.status,
        budgeted_salary: data.budgetedSalary,
      },
    });
    return this.mapPosition(position);
  }

  async getCompensation(tenant_id: string, employee_id: string): Promise<Compensation | null> {
    const compensation = await this.prisma.compensations.findUnique({
      where: { employee_id: employee_id },
    });
    return compensation ? this.mapCompensation(compensation) : null;
  }

  async updateCompensation(tenant_id: string, employee_id: string, data: any, tx?: Prisma.TransactionClient): Promise<Compensation> {
    const db = tx ?? this.prisma;
    const compensation = await db.compensations.upsert({
      where: { employee_id: employee_id },
      create: {
        id: uuidv4(),
        tenant_id: tenant_id,
        employee_id: employee_id,
        base_salary: data.base_salary,
        currency: data.currency || "USD",
        pay_frequency: data.payFrequency || "monthly",
        allowances: data.allowances,
        bonuses: data.bonuses,
        effective_date: data.effectiveDate ? new Date(data.effectiveDate) : new Date(),
        updated_at: new Date(),
      },
      update: {
        base_salary: data.base_salary,
        currency: data.currency,
        pay_frequency: data.payFrequency,
        allowances: data.allowances,
        bonuses: data.bonuses,
        effective_date: data.effectiveDate ? new Date(data.effectiveDate) : undefined,
      },
    });
    return this.mapCompensation(compensation);
  }

  // Analytics & Reporting
  async getHeadcountTrend(tenant_id: string): Promise<any[]> {
    const months = 12;
    const trend = [];
    const now = new Date();

    for (let i = 0; i < months; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const count = await this.prisma.employees.count({
        where: {
          tenant_id: tenant_id,
          hire_date: { lte: endOfMonth },
          OR: [
            { termination_date: null },
            { termination_date: { gt: endOfMonth } },
          ],
        },
      });

      trend.push({
        month: startOfMonth.toISOString().substring(0, 7),
        count,
      });
    }

    return trend.reverse();
  }

  async getTurnoverStats(tenant_id: string): Promise<any> {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [hires, terminations] = await Promise.all([
      this.prisma.employees.count({
        where: {
          tenant_id: tenant_id,
          hire_date: { gte: startOfYear },
        },
      }),
      this.prisma.employees.count({
        where: {
          tenant_id: tenant_id,
          termination_date: { gte: startOfYear },
        },
      }),
    ]);

    const activeCount = await this.prisma.employees.count({
      where: { tenant_id: tenant_id, status: "active" },
    });

    return {
      hiresThisYear: hires,
      terminationsThisYear: terminations,
      turnoverRate: activeCount > 0 ? (terminations / activeCount) * 100 : 0,
      activeHeadcount: activeCount,
    };
  }

  async getDepartmentAnalytics(tenant_id: string): Promise<any[]> {
    const departments = await this.prisma.departments.findMany({
      where: { tenant_id: tenant_id },
      include: {
        employees: {
          where: { status: "active" },
          include: { compensations: true },
        },
      },
    });

    return departments.map((d) => {
      const activeStaff = d.employees.length;
      let totalCost = 0;
      d.employees.forEach((emp: any) => {
        if (emp.compensation) {
          totalCost += Number(emp.compensations.base_salary);
          // Simple addition of allowances/bonuses for analytics
          if (emp.compensations.allowances) {
            (emp.compensations.allowances as any[]).forEach(a => totalCost += Number(a.amount || 0));
          }
        } else {
          totalCost += Number(emp.base_salary || 0);
        }
      });

      return {
        id: d.id,
        name: d.name,
        code: d.code,
        activeStaff,
        monthlyCost: totalCost,
        avgSalary: activeStaff > 0 ? totalCost / activeStaff : 0,
      };
    });
  }

  async getCompensationAnalytics(tenant_id: string): Promise<any> {
    const compensations = await this.prisma.compensations.findMany({
      where: { tenant_id: tenant_id },
    });

    if (compensations.length === 0) return { min: 0, max: 0, avg: 0, total: 0 };

    const salaries = compensations.map((c) => Number(c.base_salary));
    const total = salaries.reduce((acc, curr) => acc + curr, 0);

    return {
      min: Math.min(...salaries),
      max: Math.max(...salaries),
      avg: total / salaries.length,
      totalMonthlySpend: total,
      currency: compensations[0].currency,
    };
  }

  async getExperienceRate(tenant_id: string): Promise<any> {
    const total = await this.prisma.employees.count({ where: { tenant_id: tenant_id } });
    if (total === 0) return { rate: 0 };
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const experienced = await this.prisma.employees.count({
      where: {
        tenant_id: tenant_id,
        hire_date: { lte: twoYearsAgo },
      },
    });
    return { rate: (experienced / total) * 100 };
  }

  // Predictive Analytics
  async getPerformanceTrends(tenant_id: string): Promise<any[]> {
    const reviews = await this.prisma.performance_reviews.findMany({
      where: { tenant_id: tenant_id, status: "completed" },
      orderBy: { updated_at: 'desc' },
      select: { rating: true, updated_at: true },
    });

    // Group by month and calculate avg rating
    const grouped: any = {};
    reviews.forEach((r: any) => {
      const month = r.updated_at.toISOString().substring(0, 7);
      if (!grouped[month]) grouped[month] = { sum: 0, count: 0 };
      grouped[month].sum += r.rating;
      grouped[month].count++;
    });

    return Object.keys(grouped).map((month) => ({
      month,
      avgRating: grouped[month].sum / grouped[month].count,
    }));
  }

  async getEngagementMetrics(tenant_id: string): Promise<any> {
    // Simulated engagement metrics based on attendance and case volume
    const [attendance, cases] = await Promise.all([
      this.prisma.hr_attendance_records.count({ where: { tenant_id: tenant_id } }),
      this.prisma.hr_cases.count({ where: { tenant_id: tenant_id, status: "open" } }),
    ]);

    return {
      attendanceRate: 94.5, // Mocked for now
      pendingCases: cases,
      employeeNetPromoterScore: 72, // Mocked for now
    };
  }

  async getRetentionRiskData(tenant_id: string): Promise<any[]> {
    const employees = await this.prisma.employees.findMany({
      where: { tenant_id: tenant_id, status: "active" },
      include: {
        performance_reviews_performance_reviews_employee_idToemployees: {
          orderBy: { created_at: 'desc' },
          take: 2,
        },
      },
    });

    return employees.map((e: any) => ({
      employee_id: e.id,
      full_name: `${e.first_name} ${e.last_name}`,
      tenureMonths: Math.floor((new Date().getTime() - e.hire_date.getTime()) / (1000 * 60 * 60 * 24 * 30.44)),
      lastRatings: e.performance_reviews_performance_reviews_employee_idToemployees?.map((r: any) => r.rating) || [],
    }));
  }

  async getPositions(tenant_id: string, deptId?: string): Promise<Position[]> {
    const where: any = { tenant_id, deleted_at: null };
    if (deptId) where.department_id = deptId;
    const positions = await this.prisma.positions.findMany({
      where,
      include: {
        departments: true,
        locations: true
      },
    });
    return positions.map((p) => this.mapPosition(p));
  }

  async createPosition(tenant_id: string, data: any, tx?: Prisma.TransactionClient): Promise<Position> {
    const db = tx ?? this.prisma;
    const created = await db.positions.create({
      data: {
        tenant_id: tenant_id,
        location_id: data.location_id,
        department_id: data.department_id,
        title: data.title,
        grade: data.grade,
        status: "open",
        budgeted_salary: data.budgetedSalary,
        reports_to_position_id: data.reportsToPositionId,
        job_post_metadata: data.jobPostMetadata || {},
      },
      include: { departments: true,
        locations: true,
        hr_position_skills: { include: { hr_skills: true } },
      },
    });
    return this.mapPosition(created);
  }

  async getPositionById(tenant_id: string, id: string): Promise<Position | null> {
    const pos = await this.prisma.positions.findFirst({
      where: { id, tenant_id: tenant_id, deleted_at: null },
      include: { departments: true,
        hr_position_skills: { include: { hr_skills: true } },
      },
    });
    return pos ? this.mapPosition(pos) : null;
  }

  // Interview & Scheduling
  async getInterviews(tenant_id: string, candidateId?: string): Promise<Interview[]> {
    // The `interviews` table column is `candidate_id` (snake_case); filtering by a
    // `candidateId` key would raise a Prisma unknown-argument error. Map the
    // optional candidate filter to the schema-defined column name (Req 5.1/5.2)
    // while keeping the read strictly scoped by `tenant_id` (Req 11.4).
    const interviews = await this.prisma.interviews.findMany({
      where: {
        tenant_id: tenant_id,
        ...(candidateId ? { candidate_id: candidateId } : {}),
      },
      orderBy: { scheduled_at: "desc" },
    });
    return interviews.map((i: any) => this.mapInterview(i));
  }

  async scheduleInterview(tenant_id: string, data: any, tx?: Prisma.TransactionClient): Promise<Interview> {
    const db = tx ?? this.prisma;
    const created = await db.interviews.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        candidate_id: data.candidateId,
        interviewer_id: data.interviewerId,
        title: data.title,
        scheduled_at: new Date(data.scheduledAt),
        duration: data.duration || 30,
        locations: data.location || "Online",
        status: "SCHEDULED",
        notes: data.notes,
        updated_at: new Date(),
      },
    });
    return this.mapInterview(created);
  }

  async updateInterviewStatus(tenant_id: string, id: string, status: string, tx?: Prisma.TransactionClient): Promise<Interview> {
    const db = tx ?? this.prisma;
    const updated = await db.interviews.update({
      where: { id, tenant_id: tenant_id },
      data: { status },
    });
    return this.mapInterview(updated);
  }

  // Talent Lead Management
  async getTalentLeads(tenant_id: string, status?: string): Promise<TalentLead[]> {
    const where: any = { tenant_id };
    if (status) where.status = status;

    const leads = await this.prisma.hr_talent_leads.findMany({
      where,
      orderBy: { id: 'desc' }
    });
    return leads.map((l: any) => this.mapLead(l));
  }

  async getTalentLeadById(tenant_id: string, id: string): Promise<TalentLead | null> {
    const lead = await this.prisma.hr_talent_leads.findFirst({
      where: { id, tenant_id: tenant_id },
    });
    return lead ? this.mapLead(lead) : null;
  }

  async createTalentLead(tenant_id: string, data: any): Promise<TalentLead> {
    const created = await this.prisma.hr_talent_leads.create({
      data: {
        id: undefined as any,
        tenant_id: tenant_id,
        source: data.from_source || data.source || "MANUAL",
        external_profile_url: data.external_profile_url || data.externalProfileUrl,
        name: data.name,
        email: data.email,
        phone: data.phone,
        headline: data.headline,
        skills: data.skills,
        lead_score: data.lead_score || data.leadScore || 0,
        status: data.status || "LEAD",
        metadata: data.metadata,
        updated_at: new Date(),
      },
    });
    return this.mapLead(created);
  }

  async updateTalentLead(tenant_id: string, id: string, data: any): Promise<TalentLead> {
    try {
      const updated = await this.prisma.hr_talent_leads.update({
        where: { id, tenant_id: tenant_id },
        data: data as any,
      });
      return this.mapLead(updated);
    } catch (error) {
      handlePrismaFkError(error, 'TalentLead');
    }
  }

  async getCaseById(tenant_id: string, id: string): Promise<HRCase | null> {
    const hrcase = await this.prisma.hr_cases.findFirst({
      where: { id, tenant_id: tenant_id },
    });
    return hrcase ? this.mapHRCase(hrcase) : null;
  }

  async getInterviewById(tenant_id: string, id: string): Promise<Interview | null> {
    const interview = await this.prisma.interviews.findFirst({
      where: { id, tenant_id: tenant_id },
    });
    return interview ? this.mapInterview(interview) : null;
  }

  // Compliance Management
  async getComplianceDocuments(
    tenant_id: string,
    employee_id: string,
    documentId?: string,
    status?: string,
  ): Promise<ComplianceDocument[]> {
    const where: any = { tenant_id, employee_id };
    if (documentId) where.id = documentId;
    if (status) where.verification_status = status;

    const docs = await this.prisma.hr_compliance_documents.findMany({
      where,
      orderBy: { id: 'desc' }
    });
    return docs.map((d: any) => this.mapDocument(d));
  }

  async uploadComplianceDocument(tenant_id: string, data: any): Promise<ComplianceDocument> {
    const doc = await this.prisma.hr_compliance_documents.create({
      data: {
        id: undefined as any,
        tenant_id: tenant_id,
        employee_id: data.employee_id,
        document_type: data.document_type,
        document_number: data.document_number,
        file_url: data.file_url,
        expiry_date: data.expiry_date ? new Date(data.expiry_date) : undefined,
        verification_status: "PENDING",
      },
    });
    return this.mapDocument(doc);
  }

  async verifyDocument(
    tenant_id: string,
    id: string,
    verified_by: string,
    status: string,
    metadata?: any,
  ): Promise<ComplianceDocument> {
    const doc = await this.prisma.hr_compliance_documents.update({
      where: { id, tenant_id: tenant_id },
      data: {
        verification_status: status,
        verified_by: verified_by,
        verified_at: new Date(),
        metadata: metadata || {},
      },
    });
    return this.mapDocument(doc);
  }




  async getPayrollLines(tenant_id: string, runId: string): Promise<PayrollLine[]> {
    const lines = await this.prisma.payroll_lines.findMany({
      where: { tenant_id, payroll_run_id: runId },
    });
    return lines.map(line => this.mapLine(line));
  }

  async createDisbursementLog(tenant_id: string, data: any, tx?: Prisma.TransactionClient): Promise<any> {
    const db = tx ?? this.prisma;
    const log = await db.payroll_disbursement_logs.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        payroll_run_id: data.payrollRunId,
        status: data.status || "INITIATED",
        bank_file_name: data.bankFileName,
        disbursed_at: data.disbursedAt ? new Date(data.disbursedAt) : undefined,
        disbursed_by: data.disbursedBy,
        total_amount: data.totalAmount ? new Prisma.Decimal(data.totalAmount.toString()) : undefined,
        error_message: data.errorMessage,
        updated_at: new Date(),
      },
    });
    return this.mapDisbursementLog(log);
  }

  async getDisbursementLogs(tenant_id: string, runId: string): Promise<any[]> {
    const logs = await this.prisma.payroll_disbursement_logs.findMany({
      where: { tenant_id, payroll_run_id: runId },
      orderBy: { created_at: "desc" },
    });
    return logs.map(log => this.mapDisbursementLog(log));
  }

  async createPayrollRun(tenant_id: string, data: any): Promise<PayrollRun> {
    // Accept both snake_case and camelCase period fields defensively so any
    // caller (controller, command handler) lands valid dates rather than
    // producing `new Date(undefined)` → Invalid Date → Prisma 500.
    const periodStartRaw = data.period_start ?? data.periodStart;
    const periodEndRaw = data.period_end ?? data.periodEnd;
    // Resolve the run's base currency from the owning company's registration
    // rather than defaulting to a hardcoded literal (Req 1.2). Prefer an
    // explicitly supplied currency, then the company's currency; the trailing
    // "USD" is a last-resort fallback only when no company is resolvable.
    const company = await this.prisma.companies.findFirst({
      where: { tenant_id },
      select: { currency: true },
    });
    // Persist every supplied total — previously these were silently dropped, so
    // a run created with gross/net totals was stored as 0/0, which in turn made
    // the downstream settlement journal net to 0 (Req 5.1/5.2/5.3, 10.1, 10.4).
    // Aliased camelCase fields are translated to their schema columns; absent
    // totals fall through to the DB default rather than being forced to 0.
    const created = await this.prisma.hr_payroll_runs.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        period_start: new Date(periodStartRaw),
        period_end: new Date(periodEndRaw),
        base_currency: data.baseCurrency ?? company?.currency ?? "USD",
        status: data.status ?? "DRAFT",
        name: data.name ?? undefined,
        total_employees: data.totalEmployees ?? undefined,
        total_gross_pay: data.totalGrossPay != null ? new Prisma.Decimal(data.totalGrossPay.toString()) : undefined,
        total_net_pay: data.totalNetPay != null ? new Prisma.Decimal(data.totalNetPay.toString()) : undefined,
        total_deductions: data.totalDeductions != null ? new Prisma.Decimal(data.totalDeductions.toString()) : undefined,
        updated_at: new Date(),
      },
    });
    return this.mapRun(created);
  }

  // Succession Planning
  async getSuccessionPlans(tenant_id: string): Promise<SuccessionPlan[]> {
    const plans = await this.prisma.hr_succession_plans.findMany({
      where: { tenant_id: tenant_id },
      include: { hr_succession_candidates: true, positions: true },
    });
    return plans.map((p: any) => this.mapSuccessionPlan(p));
  }

  async getSuccessionPlan(tenant_id: string, position_id: string): Promise<SuccessionPlan | null> {
    const plan = await this.prisma.hr_succession_plans.findFirst({
      where: { position_id: position_id, tenant_id: tenant_id },
      include: { hr_succession_candidates: true, positions: true },
    });
    return plan ? this.mapSuccessionPlan(plan) : null;
  }

  async createSuccessionPlan(tenant_id: string, data: any): Promise<SuccessionPlan> {
    const created = await this.prisma.hr_succession_plans.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        position_id: data.position_id,
        is_critical: data.isCritical ?? true,
        strategy: data.strategy,
        notes: data.notes,
        updated_at: new Date(),
      },
      include: { hr_succession_candidates: true, positions: true },
    });
    return this.mapSuccessionPlan(created);
  }

  async addSuccessionCandidate(tenant_id: string, data: any): Promise<SuccessionCandidate> {
    const created = await this.prisma.hr_succession_candidates.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        plan_id: data.planId,
        candidate_id: data.employee_id,
        readiness: data.readiness,
        readiness_score: data.readinessScore ?? 0,
        risk_of_loss: data.riskOfLoss ?? "LOW",
        impact_of_loss: data.impactOfLoss ?? "MEDIUM",
        skill_gaps: data.skillGaps ?? [],
        updated_at: new Date(),
      },
    });
    return this.mapSuccessionCandidate(created);
  }

  async getBenchStrength(tenant_id: string, department_id?: string): Promise<any> {
    const plans = await this.prisma.hr_succession_plans.findMany({
      where: { 
        tenant_id: tenant_id,
        positions: department_id ? { department_id: department_id } : undefined
      },
      include: { hr_succession_candidates: true,
        positions: true
      },
    });

    const readinessCounts = {
      READY_NOW: 0,
      READY_1_2_YEARS: 0,
      READY_3_PLUS_YEARS: 0,
      EMERGENCY: 0,
    };

    plans.forEach(p => {
      p.hr_succession_candidates.forEach(c => { // Fixed model name from plural to singular
        if (c.readiness === "READY_NOW") readinessCounts.READY_NOW++;
        if (c.readiness === "READY_1_2_YEARS") readinessCounts.READY_1_2_YEARS++;
        if (c.readiness === "READY_3_PLUS_YEARS") readinessCounts.READY_3_PLUS_YEARS++;
        if (c.readiness === "EMERGENCY") readinessCounts.EMERGENCY++;
      });
    });

    return {
      totalCriticalPositions: plans.filter(p => p.is_critical).length,
      averageBenchStrength: plans.length > 0 ? (readinessCounts.READY_NOW + readinessCounts.READY_1_2_YEARS) / plans.length : 0,
      readinessDistribution: readinessCounts,
    };
  }

  // Skills-Based Org Design
  async getSkills(tenant_id: string, category?: string): Promise<Skill[]> {
    const where: any = { tenant_id: tenant_id };
    if (category) where.category = category;
    const skills = await this.prisma.hr_skills.findMany({ where });
    return skills.map((s) => this.mapSkill(s));
  }

  async createSkill(tenant_id: string, data: any): Promise<Skill> {
    const skill = await this.prisma.hr_skills.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        name: data.name,
        category: data.category,
        description: data.description,
        updated_at: new Date(),
      },
    });
    return this.mapSkill(skill);
  }

  async getEmployeeSkills(tenant_id: string, employee_id: string): Promise<EmployeeSkill[]> {
    const skills = await this.prisma.hr_employee_skills.findMany({
      where: { employee_id: employee_id, tenant_id: tenant_id },
      include: { hr_skills: true },
    });
    return skills.map((s) => this.mapEmployeeSkill(s));
  }

  async updateEmployeeSkill(tenant_id: string, data: any): Promise<EmployeeSkill> {
    const skill = await this.prisma.hr_employee_skills.upsert({
      where: {
        tenant_id_employee_id_skill_id: {
          tenant_id: tenant_id,
          employee_id: data.employee_id,
          skill_id: data.skill_id
        }
      },
      create: {
        id: uuidv4(),
        tenant_id: tenant_id,
        employee_id: data.employee_id,
        skill_id: data.skill_id,
        proficiency: data.proficiency || 1,
        verification_status: data.verification_status || "SELF_ASSESSED",
        updated_at: new Date(),
      },
      update: {
        proficiency: data.proficiency,
        verification_status: data.verification_status,
        verified_by: data.verified_by,
        verified_at: data.verified_at ? new Date(data.verified_at) : undefined,
        updated_at: new Date(),
      },
      include: { hr_skills: true },
    });
    return this.mapEmployeeSkill(skill);
  }

  async addEmployeeSkill(tenant_id: string, data: any): Promise<EmployeeSkill> {
    return this.updateEmployeeSkill(tenant_id, data);
  }

  async findReplacementCandidates(tenant_id: string, position_id: string): Promise<any[]> {
    const position = await this.getPositionById(tenant_id, position_id);
    if (!position || !position.positionSkills) return [];

    const skillIds = position.positionSkills.map((s: any) => s.skill_id);
    return this.findTalentBySkills(tenant_id, skillIds);
  }

  async findTalentBySkills(tenant_id: string, skillIds: string[], minProficiency: number = 1): Promise<any[]> {
    const employees = await this.prisma.employees.findMany({
      where: {
        tenant_id: tenant_id,
        status: "active",
        hr_employee_skills: {
          some: {
            skill_id: { in: skillIds },
            proficiency: { gte: minProficiency },
          },
        },
      },
      include: {
        hr_employee_skills: {
          where: { skill_id: { in: skillIds } },
          include: { hr_skills: true },
        },
      },
    });

    return employees.map((e) => ({
      employees: this.mapEmployee(e),
      matchedSkills: e.hr_employee_skills.map((s: any) => ({
        name: s.hrSkill.name,
        proficiency: s.proficiency,
      })),
      matchPercentage: (e.hr_employee_skills.length / skillIds.length) * 100,
    }));
  }

  // Total Rewards & Benefits
  async getBenefitPlans(tenant_id: string): Promise<BenefitPlan[]> {
    const plans = await this.prisma.hr_benefit_plans.findMany({
      where: { tenant_id: tenant_id },
    });
    return plans.map((p) => this.mapBenefitPlan(p));
  }

  async createBenefitPlan(tenant_id: string, data: any): Promise<BenefitPlan> {
    const plan = await this.prisma.hr_benefit_plans.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        name: data.name,
        type: data.type,
        description: data.description,
        employer_contribution: data.employerContribution,
        employee_contribution: data.employeeContribution,
        frequency: data.frequency || "MONTHLY",
        updated_at: new Date(),
      },
    });
    return this.mapBenefitPlan(plan);
  }

  async getEmployeeBenefits(tenant_id: string, employee_id: string): Promise<EmployeeBenefit[]> {
    const benefits = await this.prisma.hr_employee_benefits.findMany({
      where: { employee_id: employee_id, tenant_id: tenant_id },
      include: { hr_benefit_plans: true },
    });
    return benefits.map((b) => this.mapEmployeeBenefit(b));
  }

  async enrollInBenefit(tenant_id: string, data: any): Promise<EmployeeBenefit> {
    const benefit = await this.prisma.hr_employee_benefits.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        employee_id: data.employee_id,
        plan_id: data.planId,
        coverage_amount: data.coverage_amount,
        status: "ACTIVE",
        updated_at: new Date(),
      },
      include: { hr_benefit_plans: true },
    });
    return this.mapEmployeeBenefit(benefit);
  }

  // AI-Powered Career Pathing
  async getCareerPaths(tenant_id: string): Promise<CareerPath[]> {
    const paths = await this.prisma.hr_career_paths.findMany({
      where: { tenant_id: tenant_id },
      include: { 
        positions_hr_career_paths_from_position_idTopositions: true,
        positions_hr_career_paths_to_position_idTopositions: true 
      },
    });
    return paths.map((p) => this.mapCareerPath(p));
  }

  async createCareerPath(tenant_id: string, data: any): Promise<CareerPath> {
    const path = await this.prisma.hr_career_paths.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        from_position_id: data.from_position_id,
        to_position_id: data.to_position_id,
        requirement_notes: data.requirement_notes,
        updated_at: new Date(),
      },
      include: { 
        positions_hr_career_paths_from_position_idTopositions: true,
        positions_hr_career_paths_to_position_idTopositions: true 
      },
    });
    return this.mapCareerPath(path);
  }

  async getMentorshipPairs(tenant_id: string, employee_id: string): Promise<MentorshipPair[]> {
    const pairs = await this.prisma.hr_mentorship_pairs.findMany({
      where: {
        tenant_id: tenant_id,
        OR: [
          { mentor_id: employee_id },
          { mentee_id: employee_id },
        ],
      },
      include: {
        employees_hr_mentorship_pairs_mentor_idToemployees: true,
        employees_hr_mentorship_pairs_mentee_idToemployees: true,
      },
    });
    return pairs.map((p) => this.mapMentorshipPair(p));
  }

  async createMentorshipPair(tenant_id: string, data: any): Promise<MentorshipPair> {
    const pair = await this.prisma.hr_mentorship_pairs.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        mentor_id: data.mentorId,
        mentee_id: data.menteeId,
        status: "ACTIVE",
        start_date: data.start_date ? new Date(data.start_date) : new Date(),
        focus_skills: data.focusSkills || [],
        updated_at: new Date(),
      },
      include: {
        employees_hr_mentorship_pairs_mentor_idToemployees: true,
        employees_hr_mentorship_pairs_mentee_idToemployees: true,
      },
    });
    return this.mapMentorshipPair(pair);
  }

  // AI-Generated Job Descriptions
  async updatePositionJobPost(tenant_id: string, position_id: string, data: any): Promise<any> {
    return this.prisma.positions.update({
      where: { id: position_id, tenant_id: tenant_id },
      data: { 
        job_post_metadata: data,
        updated_at: new Date()
      },
    });
  }

  async getPositionJobPost(tenant_id: string, position_id: string): Promise<any> {
    const pos = await this.prisma.positions.findFirst({
      where: { id: position_id, tenant_id: tenant_id },
      select: { job_post_metadata: true },
    });
    return pos?.job_post_metadata;
  }

  // ============================================================
  // HARDENING & WORKFORCE EXTENSION
  // ============================================================

  async getOverviewMetrics(tenant_id: string): Promise<any> {
    const [
      totalEmployees,
      activeEmployees,
      pendingLeaveCount,
      openCasesCount,
      openRequisitions,
    ] = await Promise.all([
      this.prisma.employees.count({ where: { tenant_id } }),
      this.prisma.employees.count({ where: { tenant_id, status: "active" } }),
      this.prisma.leave_requests.count({
        where: { tenant_id, status: "PENDING" },
      }),
      this.prisma.hr_cases.count({ where: { tenant_id, status: "OPEN" } }),
      this.prisma.job_requisitions.count({ where: { tenant_id, status: "OPEN" } }),
    ]);

    return {
      totalEmployees,
      activeEmployees,
      pendingLeaveRequests: pendingLeaveCount,
      openCases: openCasesCount,
      openRequisitions,
    };
  }

  async isModuleActive(tenant_id: string, module_key: string): Promise<boolean> {
    const status = await this.prisma.admin_module_statuses.findFirst({
      where: {
        tenant_id,
        module_key,
      },
    });
    return status ? status.enabled : false;
  }

  async getRetailOverviewMetrics(tenant_id: string): Promise<any> {
    const retailDept = await this.prisma.departments.findFirst({
      where: {
        tenant_id,
        OR: [
          { name: { contains: "Retail", mode: "insensitive" } },
          { code: { contains: "RET", mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true },
    });

    const retailStaffCount = retailDept
      ? await this.prisma.employees.count({
          where: { tenant_id, department_id: retailDept.id, status: "active" },
        })
      : 0;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [activeShifts, completedShifts, pendingShiftClosures] = await Promise.all([
      this.prisma.retail_shifts.count({
        where: {
          tenant_id,
          start_time: { gte: todayStart },
          end_time: null,
        },
      }),
      this.prisma.retail_shifts.count({
        where: {
          tenant_id,
          start_time: { gte: todayStart },
          end_time: { not: null },
        },
      }),
      this.prisma.retail_shifts.count({
        where: {
          tenant_id,
          end_time: null,
          start_time: { lte: new Date(Date.now() - 8 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return {
      moduleId: "retail",
      moduleName: "Retail Operations",
      retailStaffCount,
      departmentName: retailDept?.name ?? "Retail",
      activeShiftsToday: activeShifts,
      completedShiftsToday: completedShifts,
      pendingShiftClosures,
    };
  }

  async getTenantSettings(tenant_id: string): Promise<any> {
    return this.prisma.tenant_settings.findUnique({
      where: { tenant_id },
    });
  }

  // ============================================================
  // SHIFT TEMPLATES
  // ============================================================

  async getShiftTemplates(tenant_id: string, location_id?: string): Promise<any[]> {
    return this.prisma.$queryRaw`
      SELECT * FROM hr_shift_templates 
      WHERE tenant_id = ${tenant_id}
      ${location_id ? Prisma.sql`AND location_id = ${location_id}` : Prisma.empty}
      ORDER BY start_time ASC
    `;
  }

  async createShiftTemplate(tenant_id: string, data: any): Promise<any> {
    return (this.prisma as any).hr_shift_templates.create({
      data: {
        ...data,
        tenant_id,
      },
    });
  }

  async deleteShiftTemplate(tenant_id: string, id: string): Promise<any> {
    return (this.prisma as any).hr_shift_templates.delete({
      where: { id, tenant_id },
    });
  }

  // ============================================================
  // PLANNING & EXCHANGE RATES
  // ============================================================

  async getBudgetScenarios(tenant_id: string): Promise<BudgetScenario[]> {
    return this.prisma.hr_budget_scenarios.findMany({
      where: { tenant_id },
      orderBy: { fiscal_year: "desc" },
    }) as any;
  }

  async createBudgetScenario(tenant_id: string, data: CreateBudgetScenarioDto): Promise<BudgetScenario> {
    return this.prisma.hr_budget_scenarios.create({
      data: {
        id: uuidv4(),
        tenant_id,
        ...data,
        updated_at: new Date(),
      },
    }) as any;
  }

  async getHeadcountPlans(tenant_id: string, scenario_id: string): Promise<HeadcountPlan[]> {
    return this.prisma.hr_headcount_plans.findMany({
      where: {
        scenario_id,
        tenant_id,
      },
      orderBy: { planned_hire_date: "asc" },
    }) as any;
  }

  async createHeadcountPlan(tenant_id: string, data: CreateHeadcountPlanDto): Promise<HeadcountPlan> {
    return this.prisma.hr_headcount_plans.create({
      data: {
        id: uuidv4(),
        tenant_id,
        ...data,
        planned_hire_date: new Date(data.planned_hire_date),
        updated_at: new Date(),
      },
    }) as any;
  }

  async getExchangeRates(tenant_id: string): Promise<ExchangeRate[]> {
    return this.prisma.hr_exchange_rates.findMany({
      where: { tenant_id },
      orderBy: { effective_at: "desc" },
    }) as any;
  }

  async createExchangeRate(tenant_id: string, data: any): Promise<ExchangeRate> {
    return this.prisma.hr_exchange_rates.create({
      data: {
        id: uuidv4(),
        tenant_id,
        from_currency: data.fromCurrency,
        to_currency: data.toCurrency,
        rate: data.rate,
        effective_at: data.effective_at || data.effectiveDate ? new Date(data.effective_at || data.effectiveDate) : new Date(),
        updated_at: new Date(),
      },
    }) as any;
  }

  // ============================================================
  // ANALYTICS
  // ============================================================

  async getStrategicHeadcount(tenant_id: string): Promise<any> {
    const [active, total] = await Promise.all([
      this.prisma.employees.count({ where: { tenant_id, status: 'active', deleted_at: null } }),
      this.prisma.employees.count({ where: { tenant_id, deleted_at: null } }),
    ]);

    return {
      active,
      total,
      utilization: total > 0 ? Number((active / total).toFixed(2)) : 0,
    };
  }

  // ============================================================
  // MAPPING UTILITIES
  // ============================================================


  async updateHeadcountPlan(tenant_id: string, id: string, data: any): Promise<HeadcountPlan> {
    return this.prisma.hr_headcount_plans.update({
      where: { id, tenant_id },
      data: {
        ...data,
        updated_at: new Date(),
      },
    }) as any;
  }

  async getPositionSkills(tenant_id: string, position_id: string): Promise<PositionSkill[]> {
    const skills = await this.prisma.hr_position_skills.findMany({
      where: { position_id: position_id, tenant_id: tenant_id },
      include: { hr_skills: true },
    });
    return skills.map((s) => this.mapPositionSkill(s));
  }

  async updatePositionSkill(tenant_id: string, data: any): Promise<PositionSkill> {
    const skill = await this.prisma.hr_position_skills.upsert({
      where: {
        tenant_id_position_id_skill_id: {
          tenant_id: tenant_id,
          position_id: data.position_id,
          skill_id: data.skill_id
        }
      },
      create: {
        id: uuidv4(),
        tenant_id: tenant_id,
        position_id: data.position_id,
        skill_id: data.skill_id,
        min_proficiency: data.minProficiency || 1,
        is_mandatory: data.isMandatory || false,
        updated_at: new Date(),
      },
      update: {
        min_proficiency: data.minProficiency,
        is_mandatory: data.isMandatory,
        updated_at: new Date(),
      },
      include: { hr_skills: true },
    });
    return this.mapPositionSkill(skill);
  }

  // AI-Powered Performance Predictor
  async getEmployeePerformanceHistory(tenant_id: string, employee_id: string): Promise<PerformanceReview[]> {
    const reviews = await this.prisma.performance_reviews.findMany({
      where: { employee_id: employee_id, tenant_id: tenant_id },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        tenant_id: true,
        cycle_id: true,
        employee_id: true,
        reviewer_id: true,
        status: true,
        rating: true,
        comments: true,
      },
    });
    return reviews.map((r) => this.mapReview(r));
  }

  async getEmployeeGoals(tenant_id: string, employee_id: string): Promise<PerformanceGoal[]> {
    const goals = await this.prisma.hr_performance_goals.findMany({
      where: { employee_id: employee_id, tenant_id: tenant_id },
      orderBy: { target_date: "asc" },
    });
    return goals.map((g) => this.mapPerformanceGoal(g));
  }

  async updatePerformanceGoal(tenant_id: string, data: any): Promise<PerformanceGoal> {
    const id = data.id || uuidv4();
    const goal = await this.prisma.hr_performance_goals.upsert({
      where: { id },
      create: {
        id,
        tenant_id: tenant_id,
        employee_id: data.employee_id,
        title: data.title,
        description: data.description,
        target_date: new Date(data.targetDate),
        progress: data.progress || 0,
        status: data.status || "IN_PROGRESS",
        updated_at: new Date(),
      },
      update: {
        title: data.title,
        description: data.description,
        target_date: data.targetDate ? new Date(data.targetDate) : undefined,
        progress: data.progress,
        status: data.status,
        updated_at: new Date(),
      },
    });
    return this.mapPerformanceGoal(goal);
  }

  async getGoalById(tenant_id: string, id: string): Promise<PerformanceGoal | null> {
    const goal = await this.prisma.hr_performance_goals.findFirst({
      where: { id, tenant_id: tenant_id },
    });
    return goal ? this.mapPerformanceGoal(goal) : null;
  }

  // AI-Powered Learning Path Personalization
  async getTrainingProgramsBySkills(tenant_id: string, skillIds: string[]): Promise<TrainingProgram[]> {
    const programs = await this.prisma.training_programs.findMany({
      where: {
        tenant_id: tenant_id,
        hr_program_skills: {
          some: {
            skill_id: { in: skillIds },
          },
        },
      },
    });
    return programs.map((p) => this.mapTrainingProgram(p));
  }

  async getEmployeeTrainingHistory(tenant_id: string, employee_id: string): Promise<TrainingAssignment[]> {
    const assignments = await this.prisma.training_assignments.findMany({
      where: { employee_id: employee_id, tenant_id: tenant_id },
      include: { employees: true },
    });
    return assignments.map((a) => this.mapTrainingAssignment(a));
  }

  async enrollInTrainingProgram(tenant_id: string, employee_id: string, programId: string): Promise<TrainingAssignment> {
    const assignment = await this.prisma.training_assignments.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        employee_id: employee_id,
        program_id: programId,
        status: "in_progress",
        assigned_at: new Date(),
        updated_at: new Date(),
      },
      include: { employees: true },
    });
    return this.mapTrainingAssignment(assignment);
  }

  async getTrainingProgramById(tenant_id: string, id: string): Promise<TrainingProgram | null> {
    const program = await this.prisma.training_programs.findFirst({
      where: { id, tenant_id: tenant_id },
      include: { 
        hr_program_skills: { include: { hr_skills: true } }
      },
    });
    return program ? this.mapTrainingProgram(program) : null;
  }

  // Predictive Labor Cost Modeling
  async getDepartmentBudgetData(tenant_id: string, department_id: string): Promise<any> {
    const scenario = await this.prisma.hr_budget_scenarios.findFirst({
      where: { tenant_id: tenant_id, status: "APPROVED" },
      orderBy: { fiscal_year: "desc" },
    });
    if (!scenario) return null;

    const plans = await this.prisma.hr_headcount_plans.findMany({
      where: { scenario_id: scenario.id, department_id: department_id },
    });

    return {
      scenarioName: scenario.name,
      fiscal_year: scenario.fiscal_year,
      totalDepartmentBudget: scenario.total_budget, // This is simplified
      headcountPlans: plans.map(p => ({
        position_title: p.position_title,
        target_headcount: p.target_headcount,
        projected_salary: p.projected_salary,
      })),
    };
  }

  async getActualLaborCostHistory(tenant_id: string, department_id: string, monthLimit: number): Promise<any[]> {
    // This would ideally sum payroll lines but for now we aggregate monthly
    const payrolls = await this.prisma.payroll_profiles.findMany({
      where: { employees: { department_id: department_id, tenant_id: tenant_id } },
    });
    
    // Simplified history
    return [
      { period: "2026-01", totalCost: 85000, grossCost: 95000 },
      { period: "2026-02", totalCost: 87000, grossCost: 97000 },
    ].slice(0, monthLimit);
  }

  // ============================================================
  // HOLIDAY MANAGEMENT
  // ============================================================

  async getHolidays(tenant_id: string): Promise<any[]> {
    return this.prisma.hr_holidays.findMany({
      where: {
        tenant_id: tenant_id,
        deleted_at: null,
      },
      orderBy: { date: "asc" },
    });
  }

  async createHoliday(tenant_id: string, data: any): Promise<any> {
    return this.prisma.hr_holidays.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        name: data.name,
        date: new Date(data.date),
        is_global: data.isGlobal || false,
        description: data.description,
        updated_at: new Date(),
      },
    });
  }

  // ============================================================
  // COMPLIANCE ENGINE
  // ============================================================

  async getComplianceModules(tenant_id: string): Promise<any[]> {
    return this.prisma.hr_compliance_modules.findMany({
      where: { tenant_id: tenant_id },
    });
  }

  async enableComplianceModule(tenant_id: string, moduleKey: string, config?: any): Promise<any> {
    return this.prisma.hr_compliance_modules.upsert({
      where: {
        tenant_id_module_key: {
          tenant_id: tenant_id,
          module_key: moduleKey,
        },
      },
      update: {
        status: "ACTIVE",
        config,
      },
      create: {
        id: uuidv4(),
        tenant_id: tenant_id,
        module_key: moduleKey,
        status: "ACTIVE",
        config,
        updated_at: new Date(),
      },
    });
  }

  async getComplianceReports(tenant_id: string): Promise<any[]> {
    return this.prisma.hr_compliance_reports.findMany({
      where: { tenant_id: tenant_id },
      orderBy: { id: 'desc' }
    });
  }

  async createComplianceReport(tenant_id: string, data: any): Promise<any> {
    return this.prisma.hr_compliance_reports.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        payroll_run_id: data.payrollRunId,
        type: data.type,
        status: data.status || "GENERATED",
        summary: data.summary || {},
        file_url: data.fileUrl,
        updated_at: new Date(),
      },
    });
  }

  async getGlobalComplianceStatus(tenant_id: string, status?: string): Promise<ComplianceDocument[]> {
    const where: any = { tenant_id: tenant_id };
    if (status) where.verification_status = status;

    const docs = await this.prisma.hr_compliance_documents.findMany({
      where,
      orderBy: { id: 'desc' }
    });
    return docs.map((d: any) => this.mapDocument(d));
  }

  async getRequisitionById(tenant_id: string, id: string): Promise<JobRequisition | null> {
    const requisition = await this.prisma.job_requisitions.findFirst({
      where: { id, tenant_id: tenant_id },
    });
    return requisition ? this.mapRequisition(requisition) : null;
  }

  async getContractById(tenant_id: string, id: string): Promise<Contract | null> {
    const contract = await this.prisma.contracts.findFirst({
      where: { id, tenant_id: tenant_id },
    });
    return contract ? this.mapContract(contract) : null;
  }

  async getWorkSchedules(tenant_id: string, location_id?: string, status?: string): Promise<any[]> {
    const schedules = await this.prisma.hr_work_schedules.findMany({
      where: {
        tenant_id: tenant_id,
        ...(location_id ? { location_id: location_id } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { start_date: "desc" },
    });
    return schedules.map((s) => this.mapWorkSchedule(s));
  }

  async createWorkSchedule(tenant_id: string, data: any, tx?: Prisma.TransactionClient): Promise<any> {
    const db = tx ?? this.prisma;
    
    // Critical pre-validation
    await assertExists(() => db.departments.findUnique({ where: { id: data.department_id } }), 'department_id', data.department_id);

    const createData: Prisma.hr_work_schedulesUncheckedCreateInput = {
      id: uuidv4(),
      tenant_id: tenant_id,
      department_id: data.department_id,
      name: data.name,
      start_date: new Date(data.start_date),
      end_date: new Date(data.end_date),
      status: data.status || "DRAFT",
      created_by: data.createdBy,
      metadata: data.metadata || {},
      updated_at: new Date(),
      ...(data.location_id ? { location_id: data.location_id } : {}),
    };

    try {
      const schedule = await db.hr_work_schedules.create({ data: createData });
      return this.mapWorkSchedule(schedule);
    } catch (error) {
      handlePrismaFkError(error, 'WorkSchedule');
    }
  }

  async updateWorkSchedule(tenant_id: string, id: string, data: any, tx?: Prisma.TransactionClient): Promise<any> {
    const db = tx ?? this.prisma;
    // Translate the (possibly camelCase / aliased) update payload to schema
    // columns so no value is silently dropped and no unknown key is spread into
    // the Prisma payload (Req 5.1/5.2/5.3). Idempotent for already-mapped input.
    const mapped = mapWorkScheduleFieldsToColumns(data) as Record<string, unknown>;
    try {
      const updated = await db.hr_work_schedules.update({
        where: { id, tenant_id: tenant_id },
        data: {
          ...mapped,
          ...(mapped.start_date !== undefined
            ? { start_date: new Date(mapped.start_date as string) }
            : {}),
          ...(mapped.end_date !== undefined
            ? { end_date: new Date(mapped.end_date as string) }
            : {}),
          updated_at: new Date(),
        },
      });
      return this.mapWorkSchedule(updated);
    } catch (error) {
      handlePrismaFkError(error, 'WorkScheduleUpdate');
    }
  }

  async getWorkShifts(tenant_id: string, scheduleId?: string, employee_id?: string): Promise<any[]> {
    const shifts = await this.prisma.hr_work_shifts.findMany({
      where: {
        tenant_id: tenant_id,
        ...(scheduleId ? { schedule_id: scheduleId } : {}),
        ...(employee_id ? { employee_id: employee_id } : {}),
      },
      orderBy: { start_time: "asc" },
    });
    return shifts.map((s) => this.mapWorkShift(s));
  }

  async createWorkShift(tenant_id: string, data: any, tx?: Prisma.TransactionClient): Promise<any> {
    const db = tx ?? this.prisma;

    // `data` is expected to be schema-aligned (snake_case columns) from the
    // service's field-mapping step; fall back to the camelCase DTO aliases for
    // any caller that still passes the raw DTO through.
    const schedule_id = data.schedule_id ?? data.scheduleId;
    const role_id = data.role_id ?? data.roleId;

    // Critical pre-validation
    await Promise.all([
      assertExists(() => db.hr_work_schedules.findUnique({ where: { id: schedule_id } }), 'schedule_id', schedule_id),
      assertExists(() => db.employees.findUnique({ where: { id: data.employee_id } }), 'employee_id', data.employee_id),
    ]);

    const createData: Prisma.hr_work_shiftsUncheckedCreateInput = {
      id: uuidv4(),
      tenant_id: tenant_id,
      schedule_id: schedule_id,
      employee_id: data.employee_id,
      start_time: new Date(data.start_time),
      end_time: new Date(data.end_time),
      role_id: role_id,
      notes: data.notes,
      metadata: data.metadata || {},
      updated_at: new Date(),
      ...(data.location_id ? { location_id: data.location_id } : {}),
    };

    try {
      const shift = await db.hr_work_shifts.create({ data: createData });
      return this.mapWorkShift(shift);
    } catch (error) {
      handlePrismaFkError(error, 'WorkShift');
    }
  }

  async updateWorkShift(tenant_id: string, id: string, data: any, tx?: Prisma.TransactionClient): Promise<any> {
    const db = tx ?? this.prisma;
    // Translate camelCase DTO aliases (`scheduleId`/`roleId`) to schema columns
    // and drop any non-column keys before persisting (Req 5.1/5.2/5.3).
    const mapped = mapWorkShiftFieldsToColumns(data) as Record<string, unknown>;
    try {
      const updated = await db.hr_work_shifts.update({
        where: { id, tenant_id: tenant_id },
        data: {
          ...mapped,
          ...(mapped.start_time !== undefined
            ? { start_time: new Date(mapped.start_time as string) }
            : {}),
          ...(mapped.end_time !== undefined
            ? { end_time: new Date(mapped.end_time as string) }
            : {}),
          updated_at: new Date(),
        },
      });
      return this.mapWorkShift(updated);
    } catch (error) {
      handlePrismaFkError(error, 'WorkShiftUpdate');
    }
  }

  async approveWorkSchedule(tenant_id: string, id: string, approved_by: string, tx?: Prisma.TransactionClient): Promise<any> {
    const db = tx ?? this.prisma;
    try {
      const schedule = await db.hr_work_schedules.update({
        where: { id, tenant_id: tenant_id },
        data: {
          status: "APPROVED",
          metadata: {
            approved_by,
            approved_at: new Date(),
          },
        },
      });
      return this.mapWorkSchedule(schedule);
    } catch (error) {
      handlePrismaFkError(error, 'WorkScheduleApproval');
    }
  }

  private mapWorkSchedule(s: any) {
    return {
      id: s.id,
      tenant_id: s.tenant_id,
      location_id: s.location_id,
      name: s.name,
      start_date: s.start_date,
      end_date: s.end_date,
      status: s.status,
      createdBy: s.created_by,
      metadata: s.metadata,
    };
  }

  private mapWorkShift(s: any) {
    return {
      id: s.id,
      tenant_id: s.tenant_id,
      scheduleId: s.schedule_id,
      employee_id: s.employee_id,
      start_time: s.start_time,
      end_time: s.end_time,
      roleId: s.role_id,
      location_id: s.location_id,
      notes: s.notes,
      metadata: s.metadata,
    };
  }
}
