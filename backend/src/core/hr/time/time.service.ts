import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { EventBusService } from '../../../shared/events/event-bus.service';
import { EVENT_NAMES } from '../events/event-names';
import { PrismaService } from '../../../persistence/prisma.service';
import { IHRRepository } from '../repositories/hr.repository.interface';
import { LeaveRequest } from '../entities/leave-request.entity';
import { Attendance } from '../entities/attendance.entity';
import { LeaveType } from '../dto/create-leave-request.dto';

@Injectable()
export class TimeAndAttendanceService {
  private readonly logger = new Logger(TimeAndAttendanceService.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly hrRepository: IHRRepository,
    private readonly prisma: PrismaService,
  ) {}

  // ──────────────────────────────────────────────
  // LEAVE MANAGEMENT
  // ──────────────────────────────────────────────

  async requestLeave(tenant_id: string, employee_id: string, dto: { type: string, start_date: Date, end_date: Date, reason?: string, total_days?: number }): Promise<LeaveRequest> {
    const event_reference_id = `EVT-HR-LEAVE-REQ-${Date.now()}`;
    return this.prisma.$transaction(async (tx: any) => {
      this.logger.log(`Leave requested by employee ${employee_id}`);
      
      const employee = await this.hrRepository.getEmployeeById(tenant_id, employee_id);
      if (!employee) throw new Error("Employee not found");

      const request = await this.hrRepository.createLeaveRequest(tenant_id, {
        employee_id,
        department_id: employee.department_id,
        leave_type: dto.type as LeaveType,
        start_date: dto.start_date.toISOString(),
        end_date: dto.end_date.toISOString(),
        reason: dto.reason || 'No reason provided',
        total_days: dto.total_days || 1,
      }, tx);

      await this.eventBus.publish({
        event_type: EVENT_NAMES.LEAVE_REQUESTED,
        tenant_id,
        entity_id: employee_id,
        entity_type: "EMPLOYEE",
        source_module: "HR",
        event_reference_id,
        payload: { leave_id: request.id, leave_type: request.leave_type, start_date: request.start_date, end_date: request.end_date },
      }, tx);

      return request;
    });
  }

  async approveLeave(tenant_id: string, leaveId: string, approverId: string, notes?: string): Promise<void> {
    const event_reference_id = `EVT-HR-LEAVE-APP-${Date.now()}`;
    return this.prisma.$transaction(async (tx: any) => {
      this.logger.log(`Leave ${leaveId} approved by ${approverId}`);
      
      await this.hrRepository.approveLeaveRequest(tenant_id, leaveId, approverId, notes, tx);

      await this.eventBus.publish({
        event_type: EVENT_NAMES.LEAVE_APPROVED,
        tenant_id,
        entity_id: leaveId,
        entity_type: "LEAVE_REQUEST",
        source_module: "HR",
        event_reference_id,
        payload: { approverId },
      }, tx);
    });
  }

  // ──────────────────────────────────────────────
  // ATTENDANCE TRACKING
  // ──────────────────────────────────────────────

  async clock_in(tenant_id: string, employee_id: string, location_id: string, data: { shift_id?: string, source?: string, device_id?: string, reason?: string, metadata?: any } = {}): Promise<Attendance> {
    const event_reference_id = `EVT-HR-ATT-IN-${Date.now()}`;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    return this.prisma.$transaction(async (tx: any) => {
      // 1. Single-open-record invariant guard (Requirement 8.3, design Property 7):
      // an employee may have at most one OPEN attendance record (no check_out_time)
      // at a time within the tenant scope, regardless of date. Reject a second
      // clock-in with a 400 client error rather than creating a duplicate session.
      const existing = await tx.hr_attendance_records.findFirst({
        where: {
          tenant_id,
          employee_id,
          check_out_time: null,
          deleted_at: null,
        },
      });

      if (existing) {
        throw new BadRequestException(
          'Employee already has an active (open) clock-in session. Clock out before clocking in again.',
        );
      }

      // 1b. Same-day record guard (Requirement 8.x / data-integrity):
      // The schema enforces one attendance record per (tenant_id, employee_id,
      // date). The open-record guard above only covers OPEN records; a CLOSED
      // record from earlier the same day would otherwise reach `create()` and
      // violate the unique constraint, surfacing to the client as an unhandled
      // 500. Reject gracefully with a 400 instead. (Re-clock-in on the same day
      // is not supported under the one-record-per-day model.)
      const sameDayRecord = await tx.hr_attendance_records.findFirst({
        where: {
          tenant_id,
          employee_id,
          date: { gte: startOfDay, lte: endOfDay },
          deleted_at: null,
        },
      });

      if (sameDayRecord) {
        throw new BadRequestException(
          'Attendance for today has already been recorded for this employee. Re-clock-in on the same day is not supported.',
        );
      }

      // ──────────────────────────────────────────────
      // 2. Location & Schedule Validation (Ship or No Ship Filter)
      // ──────────────────────────────────────────────
      const employee = await this.hrRepository.getEmployeeById(tenant_id, employee_id);
      if (!employee) throw new NotFoundException('Employee not found');

      // Verify primary location binding
      const isPrimaryLocation = location_id === employee.location_id;
      let latenessMinutes = 0;
      let status = "PRESENT";
      let workShiftId = data.shift_id;

      const activeShift = await tx.hr_work_shifts.findFirst({
        where: {
          tenant_id,
          employee_id,
          start_time: { gte: startOfDay, lte: endOfDay },
        },
        include: { hr_work_schedules: true }
      });

      if (activeShift) {
        workShiftId = activeShift.id;
        const shiftStart = new Date(activeShift.start_time);
        
        // STRICT LOCATION MATCH: Must match shift location or primary location
        const isShiftLocation = location_id === activeShift.location_id;
        if (!isShiftLocation && !isPrimaryLocation) {
          throw new BadRequestException(`Location mismatch. This shift is assigned to location ${activeShift.location_id}. Access denied.`);
        }

        if (now > shiftStart) {
          latenessMinutes = Math.floor((now.getTime() - shiftStart.getTime()) / (1000 * 60));
          if (latenessMinutes > (activeShift.hr_work_schedules?.metadata?.grace_minutes || 0)) {
            status = "LATE";
          }
        }
      } else {
        // 3. Unscheduled Handling (Strict location check still applies)
        if (!isPrimaryLocation) {
          throw new BadRequestException(`Location mismatch. Employee is assigned to location ${employee.location_id}. Unscheduled clock-in at other locations is denied.`);
        }
        
        status = "UNSCHEDULED";
        if (!data.reason) {
          throw new BadRequestException("Clock-in reason is required for unscheduled shifts.");
        }
      }

      // 4. Create Record
      const record = await tx.hr_attendance_records.create({
        data: {
          id: `att-${Date.now()}`,
          tenant_id,
          employee_id,
          location_id,
          date: startOfDay,
          check_in_time: now,
          status,
          type: data.source || "WEB",
          source: data.source || "WEB",
          device_id: data.device_id,
          lateness_minutes: latenessMinutes,
          work_shift_id: workShiftId,
          metadata: data.metadata || {},
          audit_log: {
            clock_in_reason: data.reason,
            anomaly_detected: status === "UNSCHEDULED" || status === "LATE",
          }
        }
      });

      // 5. Emit Events
      await this.eventBus.publish({
        event_type: EVENT_NAMES.CLOCK_IN,
        tenant_id,
        entity_id: employee_id,
        entity_type: "EMPLOYEE",
        source_module: "HR",
        event_reference_id,
        payload: { record_id: record.id, status, latenessMinutes },
      }, tx);

      if (status === "UNSCHEDULED") {
        await this.eventBus.publish({
          event_type: EVENT_NAMES.CLOCK_IN_UNSCHEDULED,
          tenant_id,
          entity_id: record.id,
          entity_type: "ATTENDANCE",
          source_module: "HR",
          event_reference_id,
          payload: { employee_id, reason: data.reason },
        }, tx);
      } else if (status === "LATE") {
        await this.eventBus.publish({
          event_type: EVENT_NAMES.CLOCK_IN_LATE,
          tenant_id,
          entity_id: record.id,
          entity_type: "ATTENDANCE",
          source_module: "HR",
          event_reference_id,
          payload: { employee_id, latenessMinutes },
        }, tx);
      }

      return record;
    });
  }

  async clock_out(tenant_id: string, employee_id: string, metadata: any = {}): Promise<Attendance> {
    const event_reference_id = `EVT-HR-ATT-OUT-${Date.now()}`;
    const now = new Date();

    return this.prisma.$transaction(async (tx: any) => {
      // 1. Find the open session with locking
      const record = await tx.hr_attendance_records.findFirst({
        where: {
          tenant_id,
          employee_id,
          check_out_time: null,
          deleted_at: null,
        },
        orderBy: { created_at: 'desc' } // Get most recent open
      });

      if (!record) {
        throw new BadRequestException("No active (open) clock-in session found for this employee.");
      }

      // 2. Duration & Overtime calculation
      const checkInTime = new Date(record.check_in_time || record.created_at);
      const durationMinutes = Math.floor((now.getTime() - checkInTime.getTime()) / (1000 * 60));
      
      let overtimeMinutes = 0;
      let earlyLeaveMinutes = 0;

      if (record.work_shift_id) {
        const shift = await tx.hr_work_shifts.findUnique({
          where: { id: record.work_shift_id }
        });
        if (shift) {
          const shiftEnd = new Date(shift.end_time);
          if (now > shiftEnd) {
            overtimeMinutes = Math.floor((now.getTime() - shiftEnd.getTime()) / (1000 * 60));
          } else if (now < shiftEnd) {
            earlyLeaveMinutes = Math.floor((shiftEnd.getTime() - now.getTime()) / (1000 * 60));
          }
        }
      }

      // 3. Update Record
      const updatedRecord = await tx.hr_attendance_records.update({
        where: { id: record.id },
        data: {
          check_out_time: now,
          work_duration_minutes: durationMinutes,
          overtime_minutes: overtimeMinutes,
          early_leave_minutes: earlyLeaveMinutes,
          metadata: { ...((record.metadata as any) || {}), ...metadata }
        }
      });

      // 4. Emit Events
      await this.eventBus.publish({
        event_type: EVENT_NAMES.CLOCK_OUT,
        tenant_id,
        entity_id: employee_id,
        entity_type: "EMPLOYEE",
        source_module: "HR",
        event_reference_id,
        payload: { record_id: updatedRecord.id, durationMinutes, overtimeMinutes },
      }, tx);

      return updatedRecord;
    });
  }

  // ──────────────────────────────────────────────
  // SHIFT MANAGEMENT
  // ──────────────────────────────────────────────

  async assignShift(tenant_id: string, employee_id: string, shift_id: string, location_id: string, date: string): Promise<void> {
    const event_reference_id = `EVT-HR-SHIFT-ASN-${Date.now()}`;
    return this.prisma.$transaction(async (tx: any) => {
      this.logger.log(`Assigning shift ${shift_id} to employee ${employee_id} at ${location_id} for date ${date}`);
      
      await this.hrRepository.assignShift(tenant_id, employee_id, shift_id, location_id, date, tx);

      await this.eventBus.publish({
        event_type: EVENT_NAMES.SHIFT_ASSIGNED,
        tenant_id,
        entity_id: employee_id,
        entity_type: "EMPLOYEE",
        source_module: "HR",
        event_reference_id,
        payload: { shift_id, location_id, date },
      }, tx);
    });
  }

  // ──────────────────────────────────────────────
  // BIOMETRIC & DEVICE INTEGRATION
  // ──────────────────────────────────────────────

  async biometricIngest(tenant_id: string, payload: { employee_code: string, device_id: string, timestamp: string, action?: 'IN' | 'OUT', metadata?: any }): Promise<Attendance> {
    this.logger.log(`Biometric ingest received for employee code ${payload.employee_code} from device ${payload.device_id}`);

    // 1. Resolve Employee within the device's tenant scope (Requirement 8.6).
    // The device event is always recorded against the employee that matches the
    // submitted employee_code *within the device's tenant_id*; an employee from
    // another tenant is never reachable. A missing/inactive employee is a
    // not-found condition surfaced as a typed 404 rather than a bare Error/500.
    const employee = await this.prisma.employees.findFirst({
      where: {
        tenant_id,
        employee_code: payload.employee_code,
        status: 'active',
        deleted_at: null,
      }
    });

    if (!employee) {
      throw new NotFoundException(
        `Employee with code ${payload.employee_code} not found or inactive within this tenant scope.`,
      );
    }

    // 2. Determine Action (Clock-in vs Clock-out) honoring the single-open-record
    // invariant: when no explicit action is supplied, an existing open session
    // (no check_out_time) implies the device tap should close it (OUT), otherwise
    // it opens a new session (IN). The open-session lookup is itself tenant-scoped.
    let action = payload.action;

    if (!action) {
      const activeSession = await this.prisma.hr_attendance_records.findFirst({
        where: {
          tenant_id,
          employee_id: employee.id,
          check_out_time: null,
          deleted_at: null,
        }
      });
      action = activeSession ? 'OUT' : 'IN';
    }

    // 3. Execute Action against the resolved employee within the device scope.
    // clock_in / clock_out enforce the single-open-record invariant (task 6.2):
    // a second IN with an open session and an OUT with no open session both
    // surface as 400 client errors.
    if (action === 'IN') {
      return this.clock_in(tenant_id, employee.id, employee.location_id, {
        source: 'BIOMETRIC',
        device_id: payload.device_id,
        reason: 'Biometric Auto-Clock',
        metadata: { ...(payload.metadata || {}), device_id: payload.device_id, source: 'BIOMETRIC' },
      });
    } else {
      return this.clock_out(tenant_id, employee.id, {
        ...(payload.metadata || {}),
        source: 'BIOMETRIC',
        device_id: payload.device_id,
      });
    }
  }
}
