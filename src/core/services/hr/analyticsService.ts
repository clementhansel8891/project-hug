import { hrService } from "@/core/services/hr/hrService";
import { attendanceService } from "@/core/services/hr/attendanceService";
import { payrollService } from "@/core/services/hr/payrollService";
import type { SessionContext } from "@/core/security/session";
import { Roles } from "@/core/security/roles";
import { audit } from "@/core/logging/audit";

const ensureTenantAccess = (tenantId: string, actor: SessionContext) => {
  if (actor.role === Roles.SUPERADMIN) return;
  if (actor.tenant_id !== tenantId) throw new Error("Tenant access denied");
};

export const analyticsService = {
  async getWorkforceInsights(tenantId: string, actor: SessionContext) {
    ensureTenantAccess(tenantId, actor);
    // Fetch data from backend services
    const [employees, attendance, payrollRuns] = await Promise.all([
      hrService.listEmployees(tenantId, actor),
      attendanceService.listAttendance(tenantId, actor),
      payrollService.listRuns(tenantId, actor)
    ]);

    // Contracts not yet available in new architecture (stubbed)
    const contracts: any[] = [];

    const absent = (Array.isArray(attendance) ? attendance : []).filter((item) => item.status === "absent").length;
    const late = (Array.isArray(attendance) ? attendance : []).filter((item) => item.status === "late").length;
    const riskIndex = employees.length ? Math.round(((absent + late) / employees.length) * 100) : 0;
    const payrollDrafts = (Array.isArray(payrollRuns) ? payrollRuns : []).filter((run) => run.status !== "approved").length;
    const expiringContracts = (Array.isArray(contracts) ? contracts : []).filter((contract) => contract.status !== "active").length;

    return {
      absenteeismRisk: riskIndex,
      turnoverExposure: Math.min(100, expiringContracts * 10),
      payrollForecast: payrollDrafts * 120000,
      complianceRisk: Math.min(100, expiringContracts * 12),
    };
  },

  async listMetrics(tenantId: string, actor: SessionContext) {
    const insights = await this.getWorkforceInsights(tenantId, actor);
    return [
      { id: "absenteeism", label: "Absenteeism risk", value: insights.absenteeismRisk },
      { id: "turnover", label: "Turnover exposure", value: insights.turnoverExposure },
      { id: "payroll", label: "Payroll cost forecast", value: insights.payrollForecast },
      { id: "compliance", label: "Compliance risk score", value: insights.complianceRisk },
    ];
  },

  async generateReport(tenantId: string, actor: SessionContext) {
    ensureTenantAccess(tenantId, actor);
    const reportId = `${tenantId}-report-${Date.now()}`;
    audit.log({
      tenantId,
      actorId: actor.user_id,
      action: "insight.report.generate",
      entityType: "insight_report",
      entityId: reportId,
    });
    return reportId;
  },

  async shareReport(tenantId: string, actor: SessionContext, reportId: string) {
    ensureTenantAccess(tenantId, actor);
    audit.log({
      tenantId,
      actorId: actor.user_id,
      action: "insight.report.share",
      entityType: "insight_report",
      entityId: reportId,
    });
  },

  async routeInsight(tenantId: string, actor: SessionContext, reportId: string) {
    ensureTenantAccess(tenantId, actor);
    try {
      return await apiRequest<any>("/v1/hr/workflow-requests", "POST", actor, {
        entityType: "INSIGHT_REPORT",
        entityId: reportId,
        makerDept: actor.department_id || "HR",
        destinationDept: "MANAGEMENT",
        metadata: { reportId },
      });
    } catch {
      return { id: reportId, status: "pending" };
    }
  },
};
