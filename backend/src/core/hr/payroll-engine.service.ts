import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../persistence/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";

export interface PayrollBreakdown {
  base_salary: number;
  /**
   * Day-accounting for the period. `scheduled` is the number of expected
   * working days (distinct dates with an `hr_work_shifts` entry); when the
   * tenant does not use scheduling it is 0 and no absence is inferred.
   */
  working_days: {
    scheduled: number;
    present: number;
    holidays: number;
    paid_leave: number;
    unpaid_leave: number;
    absent: number;
    daily_rate: number;
    basis: number;
  };
  attendance: {
    total_hours: number;
    overtime_hours: number;
    overtime_pay: number;
    lateness_minutes: number;
    lateness_deduction: number;
  };
  leave: {
    paid_days: number;
    unpaid_days: number;
    unpaid_deduction: number;
  };
  holidays: {
    days: number;
  };
  absence: {
    days: number;
    deduction: number;
  };
  sales_bonus: number;
  manual_adjustments: {
    bonuses: number;
    deductions: number;
  };
  gross_income: number;
  tax: {
    rate: number;
    amount: number;
    type: string;
  };
  net_pay: number;
}

/**
 * Leave `type` values (case-insensitive) treated as UNPAID — deducted at the
 * daily rate. Everything else (annual, sick, etc.) is paid leave (no deduction).
 */
const UNPAID_LEAVE_TYPES = new Set([
  'unpaid',
  'unpaid_leave',
  'leave_without_pay',
  'lwp',
  'no_pay',
  'nopay',
  'absent',
]);

/** Standard working-days divisor used when the tenant does not schedule shifts. */
const STANDARD_MONTHLY_WORKING_DAYS = 22;

@Injectable()
export class PayrollEngineService {
  private readonly logger = new Logger(PayrollEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  async calculateEmployeePayroll(
    tenant_id: string,
    employee_id: string,
    period_start: Date,
    period_end: Date
  ): Promise<PayrollBreakdown> {
    this.logger.log(`Calculating payroll for employee ${employee_id} from ${period_start} to ${period_end}`);

    // 1. Fetch Compensation (Base Salary) — scoped to the caller's tenant.
    //    `employee_id` is globally unique, so a `findUnique` by id alone could
    //    read another tenant's compensation. Use a composite-key `findFirst`
    //    ({ employee_id, tenant_id }) so payroll is always computed from the
    //    employee's compensation within the caller's Tenant_Scope (Req 10.1, 4.3).
    const compensation = await this.prisma.compensations.findFirst({
      where: { employee_id, tenant_id },
    });

    if (!compensation) {
      throw new BadRequestException(`No compensation record found for employee ${employee_id}`);
    }

    const baseSalary = new Decimal(compensation.base_salary || 0);

    // Normalise period bounds to whole-day [start 00:00 .. end 23:59:59].
    const periodStart = new Date(period_start.getFullYear(), period_start.getMonth(), period_start.getDate());
    const periodEnd = new Date(period_end.getFullYear(), period_end.getMonth(), period_end.getDate(), 23, 59, 59);
    const dayKey = (d: Date) => new Date(d).toISOString().substring(0, 10);

    // 2. Attendance — every actual clock-in in the period counts as worked time.
    //    (Previously this filtered `status: 'APPROVED'`, but clock-in only ever
    //    writes present/late/unscheduled, so the filter matched nothing and
    //    attendance never reached payroll. Exclude only rejected/cancelled rows.)
    const attendanceRecords = await this.prisma.hr_attendance_records.findMany({
      where: {
        tenant_id,
        employee_id,
        date: { gte: periodStart, lte: periodEnd },
        deleted_at: null,
        status: { notIn: ['REJECTED', 'rejected', 'CANCELLED', 'cancelled'] },
      },
    });

    let totalHours = 0;
    let overtimeMinutes = 0;
    let latenessMinutes = 0;
    const presentDates = new Set<string>();

    attendanceRecords.forEach(record => {
      totalHours += (record.work_duration_minutes || 0) / 60;
      overtimeMinutes += record.overtime_minutes || 0;
      latenessMinutes += record.lateness_minutes || 0;
      presentDates.add(dayKey(record.date));
    });

    // 3. Holidays — paid non-working days within the period (tenant-scoped).
    const holidayRows = await this.prisma.hr_holidays.findMany({
      where: {
        tenant_id,
        date: { gte: periodStart, lte: periodEnd },
        deleted_at: null,
      },
    });
    const holidayDates = new Set<string>(holidayRows.map(h => dayKey(h.date)));

    // 4. Approved leaves overlapping the period — classified paid vs unpaid by
    //    `type`. Each leave's calendar days are clipped to the period.
    const leaveRows = await this.prisma.leave_requests.findMany({
      where: {
        tenant_id,
        employee_id,
        status: { in: ['approved', 'APPROVED'] },
        deleted_at: null,
        start_date: { lte: periodEnd },
        end_date: { gte: periodStart },
      },
    });

    const paidLeaveDates = new Set<string>();
    const unpaidLeaveDates = new Set<string>();
    for (const lv of leaveRows) {
      const isUnpaid = UNPAID_LEAVE_TYPES.has(String(lv.type || '').toLowerCase());
      const from = new Date(Math.max(new Date(lv.start_date).getTime(), periodStart.getTime()));
      const to = new Date(Math.min(new Date(lv.end_date).getTime(), periodEnd.getTime()));
      for (let d = new Date(from.getFullYear(), from.getMonth(), from.getDate()); d <= to; d.setDate(d.getDate() + 1)) {
        const key = dayKey(d);
        if (holidayDates.has(key)) continue; // a holiday is already paid, not consumed as leave
        (isUnpaid ? unpaidLeaveDates : paidLeaveDates).add(key);
      }
    }

    // 5. Scheduled (expected) working days from assigned shifts. When the tenant
    //    does not roster shifts this is empty and no absence is inferred.
    const shiftRows = await this.prisma.hr_work_shifts.findMany({
      where: {
        tenant_id,
        employee_id,
        start_time: { gte: periodStart, lte: periodEnd },
      },
      select: { start_time: true },
    });
    const scheduledDates = new Set<string>(shiftRows.map(s => dayKey(s.start_time)));

    // 6. Absence — a scheduled working day with no attendance, no approved
    //    leave, and not a holiday is an unpaid absence.
    const absentDates = new Set<string>();
    for (const key of scheduledDates) {
      if (presentDates.has(key)) continue;
      if (paidLeaveDates.has(key) || unpaidLeaveDates.has(key)) continue;
      if (holidayDates.has(key)) continue;
      absentDates.add(key);
    }

    // 7. Daily / hourly rates. The daily-rate basis is the rostered working-day
    //    count when scheduling is used, else a standard monthly divisor.
    const workingDaysBasis = scheduledDates.size > 0 ? scheduledDates.size : STANDARD_MONTHLY_WORKING_DAYS;
    const dailyRate = baseSalary.div(workingDaysBasis);
    const hourlyRate = baseSalary.div(160); // ~160 working hours/month

    const overtimePay = hourlyRate.mul(1.5).mul(overtimeMinutes / 60);
    const latenessDeduction = hourlyRate.mul(latenessMinutes / 60);

    const absentDays = absentDates.size;
    const unpaidLeaveDays = unpaidLeaveDates.size;
    const paidLeaveDays = paidLeaveDates.size;
    const absenceDeduction = dailyRate.mul(absentDays);
    const unpaidLeaveDeduction = dailyRate.mul(unpaidLeaveDays);

    // 8. Sales bonuses
    const salesBonuses = await this.prisma.hr_sales_bonuses.findMany({
      where: {
        tenant_id,
        employee_id,
        status: 'PENDING',
        created_at: { gte: periodStart, lte: periodEnd },
      },
    });
    const totalSalesBonus = salesBonuses.reduce(
      (sum, bonus) => sum.plus(new Decimal(bonus.amount)),
      new Decimal(0)
    );

    // 9. Manual adjustments
    const manualAdjustments = await this.prisma.hr_payroll_adjustments.findMany({
      where: {
        tenant_id,
        employee_id,
        status: 'PENDING',
        created_at: { gte: periodStart, lte: periodEnd },
      },
    });

    let totalManualBonus = new Decimal(0);
    let totalManualDeduction = new Decimal(0);
    manualAdjustments.forEach((adj: any) => {
      if (adj.type === 'BONUS') totalManualBonus = totalManualBonus.plus(new Decimal(adj.amount));
      else if (adj.type === 'DEDUCTION') totalManualDeduction = totalManualDeduction.plus(new Decimal(adj.amount));
    });

    // 10. Gross — base pay is reduced by unpaid time (absence + unpaid leave) and
    //     lateness; paid leave and holidays are paid in full (no deduction).
    const grossIncome = baseSalary
      .plus(overtimePay)
      .plus(totalSalesBonus)
      .plus(totalManualBonus)
      .minus(latenessDeduction)
      .minus(absenceDeduction)
      .minus(unpaidLeaveDeduction);

    // 11. Tax + net
    const taxInfo = await this.calculateTax(tenant_id, grossIncome);
    const netPay = grossIncome.minus(totalManualDeduction).minus(taxInfo.amount);

    return {
      base_salary: baseSalary.toNumber(),
      working_days: {
        scheduled: scheduledDates.size,
        present: presentDates.size,
        holidays: holidayDates.size,
        paid_leave: paidLeaveDays,
        unpaid_leave: unpaidLeaveDays,
        absent: absentDays,
        daily_rate: dailyRate.toNumber(),
        basis: workingDaysBasis,
      },
      attendance: {
        total_hours: totalHours,
        overtime_hours: overtimeMinutes / 60,
        overtime_pay: overtimePay.toNumber(),
        lateness_minutes: latenessMinutes,
        lateness_deduction: latenessDeduction.toNumber()
      },
      leave: {
        paid_days: paidLeaveDays,
        unpaid_days: unpaidLeaveDays,
        unpaid_deduction: unpaidLeaveDeduction.toNumber(),
      },
      holidays: {
        days: holidayDates.size,
      },
      absence: {
        days: absentDays,
        deduction: absenceDeduction.toNumber(),
      },
      sales_bonus: totalSalesBonus.toNumber(),
      manual_adjustments: {
        bonuses: totalManualBonus.toNumber(),
        deductions: totalManualDeduction.toNumber()
      },
      gross_income: grossIncome.toNumber(),
      tax: {
        rate: taxInfo.rate,
        amount: taxInfo.amount.toNumber(),
        type: taxInfo.type
      },
      net_pay: netPay.toNumber()
    };
  }

  public async calculateTax(tenant_id: string, amount: Decimal): Promise<{ rate: number; amount: Decimal; type: string }> {
    const config = await this.prisma.finance_tax_configs.findFirst({
      where: { tenant_id, is_enabled: true }
    });

    if (!config || config.tax_type === 'NONE') {
      return { rate: 0, amount: new Decimal(0), type: 'NONE' };
    }

    if (config.tax_type === 'PERCENT') {
      const rate = (config.rules_json as any)?.rate || 0;
      return {
        rate,
        amount: amount.mul(rate).div(100),
        type: 'PERCENT'
      };
    }

    if (config.tax_type === 'BRACKET') {
      const brackets = (config.rules_json as any)?.brackets || [];
      // Simple bracket logic: find the highest bracket that applies
      // Better logic would be progressive, but this follows the "plan" for now
      let applicableRate = 0;
      for (const bracket of brackets) {
        if (amount.gte(bracket.min) && (!bracket.max || amount.lte(bracket.max))) {
          applicableRate = bracket.rate;
          break;
        }
      }
      return {
        rate: applicableRate,
        amount: amount.mul(applicableRate).div(100),
        type: 'BRACKET'
      };
    }

    return { rate: 0, amount: new Decimal(0), type: 'NONE' };
  }
}
