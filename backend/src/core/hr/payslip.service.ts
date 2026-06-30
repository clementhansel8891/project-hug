import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../persistence/prisma.service";
import { ReportingService } from "../../shared/reporting/reporting.service";
const PDFDocument = require('pdfkit');

@Injectable()
export class PayslipService {
  private readonly logger = new Logger(PayslipService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportingService: ReportingService,
  ) {}

  async generatePayslipPdf(tenant_id: string, payroll_line_id: string): Promise<Buffer> {
    const line = await this.prisma.payroll_lines.findUnique({
      where: { id: payroll_line_id, tenant_id },
      include: {
        employees: true,
        hr_payroll_runs: true,
      }
    });

    if (!line) {
      throw new NotFoundException("Payroll record not found");
    }

    const breakdown = line.breakdown_json as any;
    const employee = line.employees;
    const run = line.hr_payroll_runs;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: any[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // --- Header ---
      doc.fontSize(20).text('PAYSLIP', { align: 'center' });
      doc.moveDown();
      
      doc.fontSize(10).text(`Tenant ID: ${tenant_id}`, { align: 'left' });
      doc.text(`Period: ${run.period_start.toDateString()} - ${run.period_end.toDateString()}`, { align: 'left' });
      doc.moveDown();

      // --- Employee Info ---
      doc.fontSize(12).fillColor('blue').text('Employee Details');
      doc.fontSize(10).fillColor('black');
      doc.text(`Name: ${employee.first_name} ${employee.last_name}`);
      doc.text(`Employee Code: ${employee.employee_code}`);
      doc.text(`Position: ${employee.positions}`);
      doc.moveDown();

      // --- Attendance & Days ---
      const wd = breakdown?.working_days || {};
      doc.fontSize(12).fillColor('blue').text('Attendance & Days');
      doc.fontSize(10).fillColor('black');
      doc.text(`Scheduled working days: ${wd.scheduled ?? 0}`);
      doc.text(`Days present: ${wd.present ?? 0}`);
      doc.text(`Paid leave days: ${wd.paid_leave ?? 0}`);
      doc.text(`Unpaid leave days: ${wd.unpaid_leave ?? 0}`);
      doc.text(`Public holidays (paid): ${wd.holidays ?? 0}`);
      doc.text(`Absent days (unpaid): ${wd.absent ?? 0}`);
      if (typeof wd.daily_rate === 'number') {
        doc.text(`Daily rate: ${wd.daily_rate.toFixed(2)} (basis ${wd.basis ?? 0} days)`);
      }
      doc.moveDown();

      // --- Earnings ---
      doc.fontSize(12).fillColor('blue').text('Earnings');
      doc.fontSize(10).fillColor('black');
      doc.text(`Base Salary: ${line.base_salary.toFixed(2)}`);
      doc.text(`Overtime Pay: ${line.overtime_pay.toFixed(2)} (${breakdown?.attendance?.overtime_hours?.toFixed(2)} hrs)`);
      if (line.sales_bonus.toNumber() > 0) {
        doc.text(`Sales Bonus: ${line.sales_bonus.toFixed(2)}`);
      }
      if (line.manual_bonus.toNumber() > 0) {
        doc.text(`Additional Bonus: ${line.manual_bonus.toFixed(2)}`);
      }
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica-Bold').text(`Gross Income: ${line.gross_income.toFixed(2)}`);
      doc.font('Helvetica').moveDown();

      // --- Deductions ---
      doc.fontSize(12).fillColor('blue').text('Deductions');
      doc.fontSize(10).fillColor('black');
      doc.text(`Tax: ${line.tax_amount.toFixed(2)} (${breakdown?.tax?.rate}% ${breakdown?.tax?.type})`);
      if (breakdown?.attendance?.lateness_deduction > 0) {
        doc.text(`Lateness Deduction: ${breakdown.attendance.lateness_deduction.toFixed(2)} (${breakdown?.attendance?.lateness_minutes} mins)`);
      }
      const absenceDeduction = breakdown?.absence?.deduction || 0;
      const unpaidLeaveDeduction = breakdown?.leave?.unpaid_deduction || 0;
      if (absenceDeduction > 0) {
        doc.text(`Absence Deduction: ${absenceDeduction.toFixed(2)} (${breakdown?.absence?.days} day(s))`);
      }
      if (unpaidLeaveDeduction > 0) {
        doc.text(`Unpaid Leave Deduction: ${unpaidLeaveDeduction.toFixed(2)} (${breakdown?.leave?.unpaid_days} day(s))`);
      }
      if (line.deductions_total.toNumber() > 0) {
        doc.text(`Manual Deductions: ${line.deductions_total.toFixed(2)}`);
      }
      doc.moveDown(0.5);
      const totalDeductions =
        line.tax_amount.toNumber() +
        line.deductions_total.toNumber() +
        (breakdown?.attendance?.lateness_deduction || 0) +
        absenceDeduction +
        unpaidLeaveDeduction;
      doc.fontSize(10).font('Helvetica-Bold').text(`Total Deductions: ${totalDeductions.toFixed(2)}`);
      doc.font('Helvetica').moveDown();

      // --- Net Pay ---
      doc.rect(50, doc.y, 500, 30).fill('#f0f0f0');
      doc.fillColor('black').fontSize(14).font('Helvetica-Bold').text(`NET PAY: ${line.net_pay.toFixed(2)}`, 60, doc.y + 8);
      doc.moveDown(2);

      // --- Footer / Integrity ---
      doc.fontSize(8).font('Helvetica').fillColor('gray');
      doc.text(`Checksum: ${line.checksum || 'N/A'}`, { align: 'center' });
      doc.text(`Generated on: ${new Date().toISOString()}`, { align: 'center' });

      doc.end();
    });
  }
}
