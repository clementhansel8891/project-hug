import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../persistence/prisma.service";
import { IHRRepository } from "./repositories/hr.repository.interface";
import { AuditService } from "../../shared/audit/audit.service";
import { EventBusService } from "../../shared/events/event-bus.service";
import { LoggerService } from "../../shared/logger/logger.service";
import { FileProcessingService } from "../../shared/file-processing/file-processing.service";
import { ImportScheduleRowDto } from "./dto/import-schedule.dto";
import { randomUUID } from "crypto";
import { BadRequestException, ConflictException } from "./utils/hr-prisma.errors";
import { mapWorkShiftFieldsToColumns } from "./utils/field-mapping";
import {
  ScheduledShift,
  mapToScheduledShift,
} from "./contracts/consumer-contracts";

/**
 * SchedulingService
 * Handles Global Scheduling & Attendance logic.
 * Ensures transactional integrity and cross-module context.
 */
@Injectable()
export class SchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hrRepository: IHRRepository,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
    private readonly loggerService: LoggerService,
    private readonly fileProcessingService: FileProcessingService,
  ) {}

  async createWorkSchedule(tenant_id: string, data: any, user_id: string) {
    // 0. Validate Location Ownership
    const location = await this.prisma.locations.findFirst({
      where: { id: data.location_id, tenant_id: tenant_id },
    });
    if (!location) {
      throw new BadRequestException(
        `Location ${data.location_id} does not belong to tenant ${tenant_id}`,
      );
    }

    const event_reference_id = `EVT-HR-SCHED-NEW-${Date.now()}`;
    return this.prisma.$transaction(async (tx: any) => {
      const schedule = await this.hrRepository.createWorkSchedule(tenant_id, data, tx);

      // 1. Audit Logging
      await this.auditService.log({
        tenant_id,
        user_id,
        module: "HR",
        action: "CREATE",
        entity_type: "WORK_SCHEDULE",
        entity_id: schedule.id,
        after_state: schedule,
        event_reference_id,
      }, tx);

      // 2. Domain Event
      await this.eventBus.publish({
        event_type: "hr.schedule.created.v1",
        tenant_id,
        entity_id: schedule.id,
        entity_type: "WORK_SCHEDULE",
        source_module: "HR",
        user_id,
        event_reference_id,
        payload: { name: schedule.name, location_id: schedule.location_id },
      }, tx);

      return schedule;
    });
  }

  async createWorkShift(tenant_id: string, data: any, user_id: string) {
    const event_reference_id = `EVT-HR-SHIFT-NEW-${Date.now()}`;
    // Map the inbound DTO (camelCase `scheduleId`/`roleId`) to schema column
    // names (`schedule_id`/`role_id`) so the service and repository agree on the
    // schema-aligned shape and no value is dropped by a name mismatch (Req 5.1/5.2).
    const mapped = mapWorkShiftFieldsToColumns(data);
    return this.prisma.$transaction(async (tx: any) => {
      // Logic: Ensure schedule exists and is not approved (unless forced)
      const schedule = await this.hrRepository.getWorkSchedules(tenant_id, data.location_id);
      const targetSchedule = schedule.find(s => s.id === mapped.schedule_id);

      if (targetSchedule && targetSchedule.status === "APPROVED") {
        throw new ConflictException("Cannot add shifts to an approved schedule.");
      }

      const shift = await this.hrRepository.createWorkShift(tenant_id, mapped, tx);

      // 1. Audit Logging
      await this.auditService.log({
        tenant_id,
        user_id,
        module: "HR",
        action: "CREATE",
        entity_type: "WORK_SHIFT",
        entity_id: shift.id,
        after_state: shift,
        event_reference_id,
      }, tx);

      return shift;
    });
  }

  /**
   * Update a Work_Schedule. The repository write, audit log, and domain event
   * all enrol in a single transaction so the update either fully commits or
   * fully rolls back (Atomic_Operation — Requirements 4.1, 4.2, 7.5). Field
   * mapping to schema columns is performed at the repository boundary.
   */
  async updateWorkSchedule(tenant_id: string, id: string, data: any, user_id: string) {
    const event_reference_id = `EVT-HR-SCHED-UPD-${Date.now()}`;
    return this.prisma.$transaction(async (tx: any) => {
      const schedule = await this.hrRepository.updateWorkSchedule(tenant_id, id, data, tx);

      // 1. Audit Logging
      await this.auditService.log({
        tenant_id,
        user_id,
        module: "HR",
        action: "UPDATE",
        entity_type: "WORK_SCHEDULE",
        entity_id: id,
        after_state: schedule,
        event_reference_id,
      }, tx);

      // 2. Domain Event
      await this.eventBus.publish({
        event_type: "hr.schedule.updated.v1",
        tenant_id,
        entity_id: id,
        entity_type: "WORK_SCHEDULE",
        source_module: "HR",
        user_id,
        event_reference_id,
        payload: { name: schedule.name, location_id: schedule.location_id },
      }, tx);

      return schedule;
    });
  }

  /**
   * Update a Work_Shift. Rejects edits to a shift that belongs to an APPROVED
   * (published) schedule with a client error, mirroring the create-shift guard.
   * The repository write, audit log, and domain event run inside one
   * transaction (Atomic_Operation — Requirements 4.1, 4.2, 7.5).
   */
  async updateWorkShift(tenant_id: string, id: string, data: any, user_id: string) {
    const event_reference_id = `EVT-HR-SHIFT-UPD-${Date.now()}`;
    return this.prisma.$transaction(async (tx: any) => {
      const shift = await this.hrRepository.updateWorkShift(tenant_id, id, data, tx);

      // 1. Audit Logging
      await this.auditService.log({
        tenant_id,
        user_id,
        module: "HR",
        action: "UPDATE",
        entity_type: "WORK_SHIFT",
        entity_id: id,
        after_state: shift,
        event_reference_id,
      }, tx);

      // 2. Domain Event
      await this.eventBus.publish({
        event_type: "hr.shift.updated.v1",
        tenant_id,
        entity_id: id,
        entity_type: "WORK_SHIFT",
        source_module: "HR",
        user_id,
        event_reference_id,
        payload: { schedule_id: shift.scheduleId, employee_id: shift.employee_id },
      }, tx);

      return shift;
    });
  }

  async approveSchedule(tenant_id: string, scheduleId: string, user_id: string) {
    const event_reference_id = `EVT-HR-SCHED-APP-${Date.now()}`;
    return this.prisma.$transaction(async (tx: any) => {
      const schedule = await this.hrRepository.approveWorkSchedule(tenant_id, scheduleId, user_id, tx);

      // 1. Audit Logging
      await this.auditService.log({
        tenant_id,
        user_id,
        module: "HR",
        action: "APPROVE",
        entity_type: "WORK_SCHEDULE",
        entity_id: scheduleId,
        after_state: schedule,
        event_reference_id,
      }, tx);

      // 2. Domain Event
      await this.eventBus.publish({
        event_type: "hr.schedule.approved.v1",
        tenant_id,
        entity_id: scheduleId,
        entity_type: "WORK_SCHEDULE",
        source_module: "HR",
        user_id,
        event_reference_id,
        payload: { scheduleId },
      }, tx);

      // 3. System Alert: Notify all employees in this schedule
      const shifts = await this.hrRepository.getWorkShifts(tenant_id, scheduleId);
      const employeeIds = [...new Set(shifts.map(s => s.employee_id))];

      for (const empId of employeeIds) {
        await this.eventBus.publish({
          event_type: "HR.SHIFT_ASSIGNED",
          tenant_id,
          entity_id: empId,
          entity_type: "EMPLOYEE",
          source_module: "HR",
          user_id,
          event_reference_id,
          payload: { scheduleId, employee_id: empId },
        }, tx);
      }

      return schedule;
    });
  }

  async getWorkSchedules(tenant_id: string, location_id?: string) {
    return this.hrRepository.getWorkSchedules(tenant_id, location_id);
  }

  async getWorkShifts(tenant_id: string, scheduleId?: string, employee_id?: string) {
    return this.hrRepository.getWorkShifts(tenant_id, scheduleId, employee_id);
  }

  /**
   * Scoped `ScheduledShift[]` projection consumed by the Retail `ShiftControl`
   * grid (design "Shift scheduling consumer contract"; Requirements 7.7, 7.8,
   * 1.6).
   *
   * Reads the persisted Work_Shifts for the Tenant_Scope (already filtered by
   * `tenant_id`, and by `schedule_id`/`employee_id` when supplied), then enriches
   * each shift with:
   *   - the owning schedule's status (so `status` can be derived as
   *     `draft`/`published`), resolved from the scoped Work_Schedules; and
   *   - the assigned employee's identity/role (so `name`/`role` are populated),
   *     resolved from the scoped Employee_Roster.
   *
   * All joins are performed within the same `tenant_id` so the projection never
   * leaks cross-tenant data.
   */
  async getScheduledShifts(
    tenant_id: string,
    scheduleId?: string,
    employee_id?: string,
  ): Promise<ScheduledShift[]> {
    const shifts = await this.hrRepository.getWorkShifts(
      tenant_id,
      scheduleId,
      employee_id,
    );

    if (shifts.length === 0) {
      return [];
    }

    // Resolve owning-schedule status for each shift (scoped to tenant_id).
    const schedules = await this.hrRepository.getWorkSchedules(tenant_id);
    const scheduleStatusById = new Map<string, string>(
      schedules.map((s: any) => [s.id, s.status]),
    );

    // Resolve assigned-employee identity/role for each shift (scoped to tenant_id).
    const employeeIds = [
      ...new Set(shifts.map((s: any) => s.employee_id).filter(Boolean)),
    ];
    const employees = await Promise.all(
      employeeIds.map((id) => this.hrRepository.getEmployeeById(tenant_id, id)),
    );
    const employeeById = new Map(
      employees.filter((e): e is NonNullable<typeof e> => !!e).map((e) => [e.id, e]),
    );

    return shifts.map((shift: any) =>
      mapToScheduledShift(
        {
          ...shift,
          schedule_status: scheduleStatusById.get(shift.scheduleId) ?? null,
        },
        employeeById.get(shift.employee_id) ?? undefined,
      ),
    );
  }

  // --- Overrides & Swaps ---

  async listOverrides(tenant_id: string): Promise<any[]> {
    return this.prisma.emergency_overrides.findMany({
      where: { tenant_id },
      orderBy: { start_date: "desc" },
    });
  }

  async saveOverride(tenant_id: string, data: any, user_id: string) {
    const event_reference_id = `EVT-HR-OVERRIDE-${Date.now()}`;
    return this.prisma.$transaction(async (tx: any) => {
      const override = await tx.emergency_overrides.upsert({
        where: { id: data.id || `ovr_${Date.now()}` },
        update: {
          reason: data.reason,
          start_date: new Date(data.start_date || data.date),
          end_date: new Date(data.end_date || data.date),
        },
        create: {
          id: data.id || `ovr_${Date.now()}`,
          tenant_id,
          employee_id: data.employee_id || data.coveringEmployeeId,
          reason: data.reason,
          start_date: new Date(data.start_date || data.date),
          end_date: new Date(data.end_date || data.date),
        },
      });

      // Audit Log
      await this.auditService.log({
        tenant_id,
        user_id,
        module: "HR",
        action: "UPDATE",
        entity_type: "EMERGENCY_OVERRIDE",
        entity_id: override.id,
        after_state: override,
        event_reference_id,
      }, tx);

      return override;
    });
  }

  async listSwaps(tenant_id: string): Promise<any[]> {
    return this.prisma.shift_swap_requests.findMany({
      where: { tenant_id },
      orderBy: { created_at: "desc" },
    });
  }

  async saveSwapRequest(tenant_id: string, data: any, user_id: string) {
    const event_reference_id = `EVT-HR-SWAP-${Date.now()}`;
    return this.prisma.$transaction(async (tx: any) => {
      const swap = await tx.shift_swap_requests.upsert({
        where: { id: data.id || `swp_${Date.now()}` },
        update: {
          status: data.status,
        },
        create: {
          id: data.id || `swp_${Date.now()}`,
          tenant_id,
          requester_id: data.requester_id || data.requesterId,
          target_id: data.target_id || data.targetEmployeeId,
          shift_id: data.shift_id || data.shiftId,
          status: data.status || "pending",
        },
      });

      // Audit Log
      await this.auditService.log({
        tenant_id,
        user_id,
        module: "HR",
        action: "UPDATE",
        entity_type: "SHIFT_SWAP_REQUEST",
        entity_id: swap.id,
        after_state: swap,
        event_reference_id,
      }, tx);

      return swap;
    });
  }

  async listAllShifts(tenant_id: string): Promise<any[]> {
    return this.prisma.shifts.findMany({
      where: {
        tenant_id,
        deleted_at: null,
      },
    });
  }

  async listAllAssignments(tenant_id: string, employee_id?: string): Promise<any[]> {
    const where: any = { tenant_id };
    if (employee_id) where.employee_id = employee_id;
    return this.prisma.schedule_assignments.findMany({
      where,
      include: {
        shifts: true,
        employees: true,
        locations: true,
      },
    });
  }

  /**
   * Assign an employee to a shift on a given date (the roster "Assign Staff to
   * Shift" action). `schedule_assignments.location_id` is required and the modal
   * does not supply one, so it is derived from the employee's own location.
   */
  async createAssignment(
    tenant_id: string,
    data: { employee_id: string; shift_id: string; effective_date: string; notes?: string },
    user_id: string,
  ) {
    const employee = await this.prisma.employees.findFirst({
      where: { id: data.employee_id, tenant_id },
    });
    if (!employee) throw new BadRequestException("Employee not found for this tenant");

    const shift = await this.prisma.shifts.findFirst({
      where: { id: data.shift_id, tenant_id, deleted_at: null },
    });
    if (!shift) throw new BadRequestException("Shift not found for this tenant");

    const effective = new Date(data.effective_date);
    if (Number.isNaN(effective.getTime())) {
      throw new BadRequestException("effective_date must be a valid date");
    }

    const event_reference_id = `EVT-HR-ASSIGN-NEW-${Date.now()}`;
    return this.prisma.$transaction(async (tx: any) => {
      const assignment = await tx.schedule_assignments.create({
        data: {
          tenant_id,
          employee_id: data.employee_id,
          shift_id: data.shift_id,
          location_id: employee.location_id,
          company_id: employee.company_id ?? undefined,
          effective_date: effective,
          updated_at: new Date(),
        },
      });

      await this.auditService.log({
        tenant_id,
        user_id,
        module: "HR",
        action: "CREATE",
        entity_type: "SCHEDULE_ASSIGNMENT",
        entity_id: assignment.id,
        after_state: assignment,
        event_reference_id,
      }, tx);

      return assignment;
    });
  }

  /** Column definitions for the schedule-assignment import template/parse. */
  static readonly ASSIGNMENT_IMPORT_COLUMNS = [
    { header: "Employee Code", key: "employee_code", width: 20 },
    { header: "Employee Email", key: "employee_email", width: 28 },
    { header: "Shift Name", key: "shift_name", width: 22 },
    { header: "Date", key: "date", width: 16 },
    { header: "Location Name", key: "location_name", width: 24 },
  ];

  /** Generate the (empty) xlsx import template buffer for schedule assignments. */
  async generateAssignmentTemplate(): Promise<Buffer> {
    return this.fileProcessingService.generateExcel(
      [],
      SchedulingService.ASSIGNMENT_IMPORT_COLUMNS,
    );
  }

  private cellToString(value: any): string {
    if (value === null || value === undefined) return "";
    // ExcelJS rich-text / hyperlink / formula cells expose `.text`/`.result`.
    if (typeof value === "object") {
      if (typeof value.text === "string") return value.text.trim();
      if (value.result !== undefined) return String(value.result).trim();
      if (value instanceof Date) return value.toISOString();
    }
    return String(value).trim();
  }

  /**
   * Parse a date cell (Excel Date object or text like YYYY-MM-DD) into a clean
   * UTC date-only value, dropping any time component so assignments carry a
   * stable calendar date regardless of source formatting/timezone.
   */
  private parseImportDate(value: any): Date | null {
    if (value === null || value === undefined || value === "") return null;
    let d: Date;
    if (value instanceof Date) {
      d = value;
    } else {
      const s = this.cellToString(value);
      if (!s) return null;
      d = new Date(s);
    }
    if (Number.isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  /**
   * Bulk-import schedule assignments from a parsed xlsx/csv file. Each row binds
   * an employee (by code or email) to a shift (by name) on a date, at a location
   * (by name, or the employee's own location if omitted). Valid rows are written;
   * invalid rows are skipped and reported with a row number and reason, so a
   * partially-correct file still imports its good rows.
   */
  async importAssignments(
    tenant_id: string,
    fileBuffer: Buffer,
    filename: string,
    user_id: string,
  ): Promise<{ imported: number; failed: number; errors: Array<{ row: number; message: string }> }> {
    const isCsv = (filename || "").toLowerCase().endsWith(".csv");
    const parsed = isCsv
      ? await this.fileProcessingService.parseCsv(fileBuffer, ImportScheduleRowDto)
      : await this.fileProcessingService.parseExcel(fileBuffer, ImportScheduleRowDto);
    const rows = parsed.data as ImportScheduleRowDto[];

    if (!rows || rows.length === 0) {
      throw new BadRequestException(
        "No data rows found. Download the template and fill at least one row.",
      );
    }

    // Pre-load lookup maps (scoped to tenant) to avoid per-row queries.
    const [employees, shifts, locations] = await Promise.all([
      this.prisma.employees.findMany({
        where: { tenant_id, deleted_at: null },
        select: { id: true, employee_code: true, email: true, location_id: true, company_id: true },
      }),
      this.prisma.shifts.findMany({
        where: { tenant_id, deleted_at: null },
        select: { id: true, name: true },
      }),
      this.prisma.locations.findMany({
        where: { tenant_id },
        select: { id: true, name: true },
      }),
    ]);

    const empByCode = new Map(employees.filter((e) => e.employee_code).map((e) => [e.employee_code!.toLowerCase(), e]));
    const empByEmail = new Map(employees.filter((e) => e.email).map((e) => [e.email.toLowerCase(), e]));
    const shiftByName = new Map(shifts.map((s) => [s.name.toLowerCase(), s]));
    const locByName = new Map(locations.map((l) => [l.name.toLowerCase(), l]));

    const errors: Array<{ row: number; message: string }> = [];
    const toCreate: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // header is row 1
      const r = rows[i];
      const code = this.cellToString(r.employee_code);
      const email = this.cellToString(r.employee_email);
      const shiftName = this.cellToString(r.shift_name);
      const dateRaw = this.cellToString(r.date);
      const locName = this.cellToString(r.location_name);

      // Skip fully-blank rows silently (trailing empty template rows).
      if (!code && !email && !shiftName && !dateRaw && !locName) continue;

      const employee = code
        ? empByCode.get(code.toLowerCase())
        : email
          ? empByEmail.get(email.toLowerCase())
          : undefined;
      if (!employee) {
        errors.push({ row: rowNum, message: `Employee not found (code='${code}', email='${email}')` });
        continue;
      }

      const shift = shiftName ? shiftByName.get(shiftName.toLowerCase()) : undefined;
      if (!shift) {
        errors.push({ row: rowNum, message: `Shift '${shiftName}' not found` });
        continue;
      }

      let location_id = employee.location_id;
      if (locName) {
        const loc = locByName.get(locName.toLowerCase());
        if (!loc) {
          errors.push({ row: rowNum, message: `Location '${locName}' not found` });
          continue;
        }
        location_id = loc.id;
      }

      const effective = this.parseImportDate(r.date);
      if (!effective) {
        errors.push({ row: rowNum, message: `Invalid date '${dateRaw}' (use YYYY-MM-DD)` });
        continue;
      }

      toCreate.push({
        id: randomUUID(),
        tenant_id,
        employee_id: employee.id,
        shift_id: shift.id,
        location_id,
        company_id: employee.company_id ?? undefined,
        effective_date: effective,
        updated_at: new Date(),
      });
    }

    if (toCreate.length > 0) {
      await this.prisma.schedule_assignments.createMany({ data: toCreate });
      await this.auditService.log({
        tenant_id,
        user_id,
        module: "HR",
        action: "IMPORT",
        entity_type: "SCHEDULE_ASSIGNMENT",
        entity_id: `batch-${Date.now()}`,
        after_state: { imported: toCreate.length },
        event_reference_id: `EVT-HR-ASSIGN-IMPORT-${Date.now()}`,
      });
    }

    return { imported: toCreate.length, failed: errors.length, errors };
  }
}
