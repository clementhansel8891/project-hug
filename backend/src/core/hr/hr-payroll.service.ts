import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../persistence/prisma.service";
import { IHRRepository } from "./repositories/hr.repository.interface";
import { AuditService } from "../../shared/audit/audit.service";
import { FiscalPeriodService } from "../finance/services/fiscal-period.service";
import { PostingGatewayService } from "../finance/services/posting-gateway.service";
import { 
  Payroll, 
  Compensation 
} from "./entities/hr.entity";
import { Prisma } from "@prisma/client";

import { PayrollEngineService } from "./payroll-engine.service";
import { PayslipService } from "./payslip.service";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";

@Injectable()
export class HrPayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hrRepository: IHRRepository,
    private readonly auditService: AuditService,
    private readonly fiscalPeriodService: FiscalPeriodService,
    private readonly postingGatewayService: PostingGatewayService,
    private readonly payrollEngine: PayrollEngineService,
    private readonly payslipService: PayslipService,
  ) {}

  async getPayroll(tenant_id: string, location_id?: string, employee_id?: string, period?: string): Promise<Payroll[]> {
    return this.hrRepository.getPayroll(tenant_id, location_id, employee_id, period);
  }

  async getGlobalPayroll(employee_id: string, period?: string): Promise<Payroll[]> {
    return this.hrRepository.getGlobalPayroll(employee_id, period);
  }

  async calculatePayroll(tenant_id: string, employee_id: string, period: string, user_id?: string): Promise<any> {
    const event_reference_id = `EVT-HR-PAYROLL-CALC-${Date.now()}`;
    const [start, end] = this.getPeriodDates(period);

    return this.prisma.$transaction(async (tx: any) => {
      // 1. Core Calculation via Engine
      const breakdown = await this.payrollEngine.calculateEmployeePayroll(tenant_id, employee_id, start, end);

      // 2. Resolve Active Run
      const payrollRun = await tx.hr_payroll_runs.findFirst({
        where: { tenant_id, period_start: { gte: start }, period_end: { lte: end }, status: "DRAFT" },
      });

      if (!payrollRun) {
        throw new BadRequestException(`Active payroll run not found for period ${period}`);
      }

      // 3. Generate Checksum for Integrity
      const checksumData = `${tenant_id}:${employee_id}:${breakdown.net_pay}:${Date.now()}`;
      const checksum = createHash("sha256").update(checksumData).digest("hex");

      // 4. Persist the payroll line idempotently. There is no DB unique
      //    constraint on (tenant_id, payroll_run_id, employee_id), so find the
      //    existing line for this employee+run and update it, otherwise create.
      //    (The previous `upsert({ where: { id: uuidv4() } })` always generated a
      //    fresh id that never matched — so it could never update and risked
      //    duplicate lines on re-calculation — and it also wrote a non-existent
      //    `total_work_hours` column, which threw a Prisma validation 500.)
      const lineData = {
        base_salary: new Prisma.Decimal(breakdown.base_salary.toFixed(2)),
        overtime_pay: new Prisma.Decimal(breakdown.attendance.overtime_pay.toFixed(2)),
        sales_bonus: new Prisma.Decimal(breakdown.sales_bonus.toFixed(2)),
        manual_bonus: new Prisma.Decimal(breakdown.manual_adjustments.bonuses.toFixed(2)),
        gross_income: new Prisma.Decimal(breakdown.gross_income.toFixed(2)),
        gross_pay: new Prisma.Decimal(breakdown.gross_income.toFixed(2)), // legacy mirror
        net_pay: new Prisma.Decimal(breakdown.net_pay.toFixed(2)),
        tax_amount: new Prisma.Decimal(breakdown.tax.amount.toFixed(2)),
        adjustments: new Prisma.Decimal(breakdown.manual_adjustments.bonuses - breakdown.manual_adjustments.deductions),
        deductions_total: new Prisma.Decimal(breakdown.manual_adjustments.deductions.toFixed(2)),
        breakdown_json: breakdown as any,
        checksum,
      };

      const existingLine = await tx.payroll_lines.findFirst({
        where: { tenant_id, payroll_run_id: payrollRun.id, employee_id },
        select: { id: true },
      });

      const payrollLine = existingLine
        ? await tx.payroll_lines.update({ where: { id: existingLine.id }, data: lineData })
        : await tx.payroll_lines.create({
            data: {
              id: uuidv4(),
              tenant_id,
              payroll_run_id: payrollRun.id,
              employee_id,
              ...lineData,
            },
          });

      await this.auditService.log({
        tenant_id, user_id: user_id || "SYSTEM", module: "HR", action: "CALCULATE_PAYROLL", entity_type: "PAYROLL_LINE", entity_id: payrollLine.id, after_state: payrollLine, event_reference_id, metadata: { period, breakdown },
      }, tx);

      return payrollLine;
    });
  }

  private getPeriodDates(period: string): [Date, Date] {
    // Basic parser for "YYYY-MM" or "YYYY-MM-DD/YYYY-MM-DD"
    if (period.includes("/")) {
      const [s, e] = period.split("/");
      return [new Date(s), new Date(e)];
    }
    const year = parseInt(period.split("-")[0]);
    const month = parseInt(period.split("-")[1]) - 1;
    return [new Date(year, month, 1), new Date(year, month + 1, 0, 23, 59, 59)];
  }

  async getCompensation(tenant_id: string, employee_id: string): Promise<Compensation> {
    return this.hrRepository.getCompensation(tenant_id, employee_id) as any;
  }

  async updateCompensation(tenant_id: string, employee_id: string, data: any, user_id?: string): Promise<Compensation> {
    const event_reference_id = `EVT-HR-COMP-UPD-${Date.now()}`;
    return this.prisma.$transaction(async (tx: any) => {
      const compensation = await this.hrRepository.updateCompensation(tenant_id, employee_id, data, tx);
      await this.auditService.log({
        tenant_id, user_id: user_id || "SYSTEM", module: "HR", action: "UPDATE_COMPENSATION", entity_type: "COMPENSATION", entity_id: employee_id, after_state: compensation, event_reference_id,
      }, tx);
      return compensation;
    });
  }

  async getCompensationAnalytics(tenant_id: string): Promise<any> {
    return this.hrRepository.getCompensationAnalytics(tenant_id);
  }

  async approvePayroll(tenant_id: string, run_id: string, user_id: string): Promise<any> {
    // Atomic_Operation (Req 4.1/10.2/10.5): the state read + guard + status write +
    // audit log all run inside a single `$transaction`, reading the run on the
    // transaction client so a concurrent transition cannot race the DRAFT guard.
    //
    // NOTE: This is the legacy lifecycle path wired to `HrPayrollController`
    // (`/hr/payroll/:id/approve`). The canonical Phase 5 lifecycle owner is
    // `HrSettlementService` (wired to `HRController` `/hr/payroll/runs/:id/...`),
    // per the design. Both paths are kept internally atomic and state-guarded;
    // they MUST NOT be invoked concurrently for the same run.
    return this.prisma.$transaction(async (tx: any) => {
      const run = await this.hrRepository.getPayrollRunById(tenant_id, run_id, tx);
      if (!run) throw new NotFoundException("Payroll run not found");
      if (run.status !== "DRAFT" && run.status !== "draft") {
        throw new BadRequestException(`Cannot approve payroll in ${run.status} status`);
      }

      const updated = await this.hrRepository.updatePayrollRun(tenant_id, run_id, { status: "APPROVED" }, tx);
      await this.auditService.log({
        tenant_id, user_id, module: "HR", action: "APPROVE_PAYROLL", entity_type: "PAYROLL_RUN", entity_id: run_id, after_state: updated,
      }, tx);
      return updated;
    });
  }

  async generateBankFile(tenant_id: string, run_id: string): Promise<string> {
    const lines = await this.prisma.payroll_lines.findMany({
      where: { tenant_id, payroll_run_id: run_id },
      include: { employees: true },
    });
    if (lines.length === 0) throw new BadRequestException("No payroll records found for this run");

    const employeeIds = lines.map((l) => l.employee_id);
    const [profiles, comps] = await Promise.all([
      this.prisma.payroll_profiles.findMany({ where: { tenant_id, employee_id: { in: employeeIds } } }),
      this.prisma.compensations.findMany({ where: { tenant_id, employee_id: { in: employeeIds } } }),
    ]);
    const profileByEmp = new Map(profiles.map((p) => [p.employee_id, p]));
    const currencyByEmp = new Map(comps.map((c) => [c.employee_id, c.currency]));

    // Proper RFC-4180-style CSV: quote fields and escape embedded quotes so a
    // bank can ingest it and a human can read it. Net pay is the disbursable
    // amount computed by the payroll engine (after all deductions).
    const esc = (v: any) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const header = [
      "Employee Code",
      "Employee Name",
      "Bank Name",
      "Account No",
      "Payment Method",
      "Net Pay",
      "Currency",
      "Status",
    ];

    let totalNet = 0;
    const rows = lines.map((line: any) => {
      const emp = line.employees;
      const profile = profileByEmp.get(line.employee_id);
      const net = Number(line.net_pay || 0);
      totalNet += net;
      return [
        emp?.employee_code || line.employee_id,
        emp ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim() : "",
        profile?.bank_name || "",
        profile?.bank_account_no || "",
        profile?.payment_method || "bank_transfer",
        net.toFixed(2),
        currencyByEmp.get(line.employee_id) || "USD",
        "READY",
      ].map(esc).join(",");
    });

    // Trailer total row for reconciliation.
    const trailer = ["TOTAL", "", "", "", "", totalNet.toFixed(2), "", `${lines.length} employees`]
      .map(esc)
      .join(",");

    const csv = [header.join(","), ...rows, trailer].join("\n") + "\n";

    await this.hrRepository.createDisbursementLog(tenant_id, {
      payrollRunId: run_id,
      status: "BANK_FILE_GENERATED",
      bankFileName: `PAYROLL_${run_id}_${Date.now()}.csv`,
      totalAmount: totalNet,
    });

    return csv;
  }

  async confirmDisbursement(tenant_id: string, run_id: string, user_id: string): Promise<any> {
    const today = new Date();
    // 1. Validate Fiscal Period (read-only precheck; the authoritative status
    //    guard + write run together inside the transaction below).
    const openPeriodId = await this.fiscalPeriodService.validatePeriodOpenForPosting(tenant_id, tenant_id, "PAYROLL", user_id);
    if (!openPeriodId) {
      throw new BadRequestException("Financial period is closed. Cannot post payroll disbursement.");
    }

    const lines = await this.hrRepository.getPayrollLines(tenant_id, run_id);
    const totalNet = lines.reduce((sum, line) => sum + Number(line.netPay), 0);
    const totalGross = lines.reduce((sum, line) => sum + Number(line.gross_income || line.grossPay), 0);
    const totalTax = lines.reduce((sum, line) => sum + Number(line.tax_amount || 0), 0);

    // Atomic_Operation (Req 4.1/10.3/10.5): the run is read on the transaction
    // client and the APPROVED guard, the status write, the disbursement log, the
    // ledger posting, and the audit log all run inside a single `$transaction` so
    // a concurrent transition cannot race the guard and a partial failure rolls
    // everything back. See the reconciliation note on `approvePayroll`: the
    // canonical lifecycle owner is `HrSettlementService`.
    return this.prisma.$transaction(async (tx: any) => {
      const run = await this.hrRepository.getPayrollRunById(tenant_id, run_id, tx);
      if (!run) throw new NotFoundException("Payroll run not found");
      if (run.status !== "APPROVED") {
        throw new BadRequestException("Only approved payroll runs can be disbursed");
      }

      // Resolve the company that owns this tenant. Currency follows the company
      // registration; a company's `id` is NOT the `tenant_id`, so resolve by
      // `tenant_id` rather than assuming `id === tenant_id` (Req 1.2). The trailing
      // `?? 'USD'` is a last-resort fallback only after company resolution fails.
      const company = await tx.companies.findFirst({
        where: { tenant_id },
        select: { id: true, currency: true },
      });
      const currency = company?.currency ?? run.baseCurrency ?? "USD";
      const company_id = company?.id ?? tenant_id;

      // 2. Update Run Status
      const updated = await this.hrRepository.updatePayrollRun(tenant_id, run_id, { status: "DISBURSED" }, tx);

      // 3. Create Disbursement Log
      const log = await this.hrRepository.createDisbursementLog(tenant_id, {
        payrollRunId: run_id,
        status: "SUCCESS",
        disbursedAt: today,
        disbursedBy: user_id,
        totalAmount: totalNet,
      }, tx);

      // 4. Post to Ledger via Gateway
      await this.postingGatewayService.postEvent({
        request_id: `PAY-${run_id}-${Date.now()}`,
        tenant_id,
        company_id,
        sourceEventId: run_id,
        event_type: "PAYROLL_POSTED",
        eventVersion: "1.0.0",
        payload: {
          total: totalNet,
          gross: totalGross,
          tax: totalTax,
          currency,
          description: `Payroll Disbursement for period ending ${run.period_end}`,
          fiscalPeriodId: openPeriodId,
        },
        metadata: {
          module: "HR",
          action: "DISBURSE",
        }
      } as any);

      await this.auditService.log({
        tenant_id, user_id, module: "HR", action: "CONFIRM_DISBURSEMENT", entity_type: "PAYROLL_RUN", entity_id: run_id, after_state: { run: updated, log },
      }, tx);

      return { run: updated, log };
    });
  }

  async generatePayslip(tenant_id: string, run_id: string, employee_id: string): Promise<Buffer> {
    const payroll = await this.prisma.payroll_lines.findFirst({
      where: { tenant_id, payroll_run_id: run_id, employee_id },
    });

    if (!payroll) throw new NotFoundException("Payroll record not found");
    return this.payslipService.generatePayslipPdf(tenant_id, payroll.id);
  }

  async getPerformanceSnapshot(tenant_id: string, employee_id: string): Promise<any> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // 1. Get Employee Base Salary — scoped to the caller's tenant so we never
    //    read another tenant's compensation (employee_id is globally unique).
    const compensation = await this.prisma.compensations.findFirst({
      where: { employee_id, tenant_id },
    });
    const baseSalary = compensation ? Number(compensation.base_salary) : 0;

    // 2. Get Sales Bonuses (Items Sold)
    const salesBonuses = await this.prisma.hr_sales_bonuses.findMany({
      where: {
        tenant_id,
        employee_id,
        created_at: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    const itemsSold = salesBonuses.length;
    const accruedBonus = salesBonuses.reduce((sum, bonus) => sum + Number(bonus.amount), 0);

    // 3. Get Estimated Overtime (from attendance)
    const attendance = await this.prisma.hr_attendance_records.findMany({
      where: {
        tenant_id,
        employee_id,
        check_in_time: { gte: startOfMonth, lte: endOfMonth },
        status: 'APPROVED',
      },
    });

    let overtimePay = 0;
    const hourlyRate = baseSalary / 160;
    attendance.forEach((record: any) => {
      const overtimeHours = (record.overtime_minutes || 0) / 60;
      overtimePay += overtimeHours * hourlyRate * 1.5;
    });

    const grossEarnings = baseSalary + accruedBonus + overtimePay;

    // 4. Estimate Tax
    const taxInfo = await this.payrollEngine.calculateTax(tenant_id, new Prisma.Decimal(grossEarnings));
    const estimatedTax = taxInfo.amount.toNumber();

    return {
      itemsSold,
      accruedBonus,
      estimatedTax,
      grossEarnings,
    };
  }

  private mapLine(l: any): any {
    return {
      id: l.id,
      tenant_id: l.tenant_id,
      payrollRunId: l.payroll_run_id,
      employee_id: l.employee_id,
      grossPay: Number(l.gross_pay),
      adjustments: Number(l.adjustments || 0),
      netPay: Number(l.net_pay),
      created_at: l.created_at,
      updated_at: l.updated_at,
    };
  }
}
