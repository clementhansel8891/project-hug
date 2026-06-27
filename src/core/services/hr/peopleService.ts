import { apiRequest } from "@/core/api/apiClient";
import { hrService } from "@/core/services/hr/hrService";
import { attendanceService } from "@/core/services/hr/attendanceService";
import { payrollService } from "@/core/services/hr/payrollService";
import { trainingService } from "@/core/services/hr/trainingService";
import { leaveService } from "@/core/services/hr/leaveService";
import type { SessionContext } from "@/core/security/session";
import { Roles } from "@/core/security/roles";



export const peopleService = {
  async getEmployee360(tenantId: string, employeeId: string, actor: SessionContext) {
    // 1. Fetch employee (via API, handles Global/SuperAdmin check on backend)
    const employee = await hrService.getEmployee(tenantId, actor, employeeId);
    
    if (!employee) {
       console.log(`[peopleService] Employee not found: ${employeeId}`);
       return null;
    }

    // 2. Authorization Checks 
    // Handled by API/Backend now. If we got the employee, checking attendance/etc should also work via similar logic
    // or stubbed.

    // 3. Fetch related data in parallel
    const [attendance, payroll, trainings, leaves] = await Promise.all([
      attendanceService.listAttendance(tenantId, actor), // TODO: Filter by employeeId on backend call if supported
      payrollService.getEmployeePayroll(tenantId, actor, employeeId),
      trainingService.listAssignments(tenantId, actor),
      leaveService.listLeaveRequests(tenantId, actor)
    ]);

    // Filter results client-side where backend doesn't support filtering yet
    const employeeAttendance = (Array.isArray(attendance) ? attendance : []).filter(r => r.employeeId === employeeId);
    const employeeTrainings = (Array.isArray(trainings) ? trainings : []).filter(r => r.employeeId === employeeId);
    const employeeLeaves = (Array.isArray(leaves) ? leaves : []).filter(r => r.employeeId === employeeId);
    
    // Contracts, Reviews, Workflows - fetch from HR backend
    let contracts: any[] = [];
    let reviews: any[] = [];
    let cycles: any[] = [];
    let workflows: any[] = [];

    try {
      const [contractsData, reviewsData, workflowsData] = await Promise.all([
        apiRequest<any[]>(`/v1/hr/employees/${employeeId}/contracts`, "GET", actor).catch(() => []),
        apiRequest<any[]>(`/v1/hr/performance/reviews?employeeId=${employeeId}`, "GET", actor).catch(() => []),
        apiRequest<any[]>(`/v1/hr/workflow-requests?employeeId=${employeeId}`, "GET", actor).catch(() => []),
      ]);
      contracts = Array.isArray(contractsData) ? contractsData : [];
      reviews = Array.isArray(reviewsData) ? reviewsData : [];
      workflows = Array.isArray(workflowsData) ? workflowsData : [];
    } catch {
      // Graceful degradation — these sections just show empty
    }

    return {
      employee,
      attendance: employeeAttendance,
      payrollRuns: payroll,
      contracts,
      reviews,
      cycles,
      trainings: employeeTrainings,
      leaves: employeeLeaves,
      workflows,
    };
  },
};
