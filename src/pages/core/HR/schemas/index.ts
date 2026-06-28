/**
 * Zod schemas for all HR domain entities.
 *
 * Provides client-side validation for:
 * - Employees (create/update)
 * - Departments (create/update)
 * - Leave Requests (create)
 * - Attendance (create/update)
 * - Payroll (create run)
 * - Training Assignment
 * - Performance Review
 * - Contracts
 * - Workflow Requests
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Employee Schemas
// ---------------------------------------------------------------------------

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  phone: z.string().optional().default(""),
  departmentId: z.string().min(1, "Department is required"),
  locationId: z.string().optional().default(""),
  roleTitle: z.string().min(1, "Role title is required").max(100),
  status: z.enum(["active", "probation", "candidate", "suspended", "terminated"]).default("active"),
  employmentType: z.enum(["full_time", "part_time", "contract", "intern"]).default("full_time"),
  baseSalary: z.coerce.number().min(0, "Salary must be non-negative").default(0),
  hireDate: z.string().min(1, "Hire date is required"),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email format").optional(),
  phone: z.string().optional().default(""),
  departmentId: z.string().min(1, "Department is required"),
  locationId: z.string().optional().default(""),
  roleTitle: z.string().min(1, "Role title is required").max(100),
  status: z.enum(["active", "probation", "candidate", "suspended", "terminated"]).default("active"),
  employmentType: z.enum(["full_time", "part_time", "contract", "intern"]).default("full_time"),
  baseSalary: z.coerce.number().min(0, "Salary must be non-negative").default(0),
});

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

// ---------------------------------------------------------------------------
// Department Schemas
// ---------------------------------------------------------------------------

export const createDepartmentSchema = z.object({
  name: z.string().min(1, "Department name is required").max(100),
  code: z.string().min(1, "Code is required").max(20),
  description: z.string().optional().default(""),
  parentId: z.string().optional().default(""),
  headId: z.string().optional().default(""),
  status: z.enum(["active", "inactive"]).default("active"),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = z.object({
  name: z.string().min(1, "Department name is required").max(100),
  code: z.string().min(1, "Code is required").max(20),
  description: z.string().optional().default(""),
  parentId: z.string().optional().default(""),
  headId: z.string().optional().default(""),
  status: z.enum(["active", "inactive"]).default("active"),
});

export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

// ---------------------------------------------------------------------------
// Leave Request Schemas
// ---------------------------------------------------------------------------

export const createLeaveRequestSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  type: z.enum(["annual", "sick", "personal", "maternity", "paternity", "unpaid"], {
    required_error: "Leave type is required",
  }),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().min(1, "Reason is required").max(500),
}).refine(
  (data) => {
    if (!data.startDate || !data.endDate) return true;
    return new Date(data.endDate) >= new Date(data.startDate);
  },
  { message: "End date must be on or after start date", path: ["endDate"] }
);

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;

// ---------------------------------------------------------------------------
// Attendance Schemas
// ---------------------------------------------------------------------------

export const createAttendanceSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  date: z.string().min(1, "Date is required"),
  checkIn: z.string().min(1, "Check-in time is required"),
  checkOut: z.string().optional().default(""),
  status: z.enum(["present", "absent", "late", "half_day", "on_leave"]).default("present"),
  notes: z.string().optional().default(""),
});

export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;

export const updateAttendanceSchema = z.object({
  checkIn: z.string().min(1, "Check-in time is required"),
  checkOut: z.string().optional().default(""),
  status: z.enum(["present", "absent", "late", "half_day", "on_leave"]).default("present"),
  notes: z.string().optional().default(""),
});

export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;

// ---------------------------------------------------------------------------
// Payroll Schemas
// ---------------------------------------------------------------------------

export const createPayrollRunSchema = z.object({
  periodStart: z.string().min(1, "Period start is required"),
  periodEnd: z.string().min(1, "Period end is required"),
  notes: z.string().optional().default(""),
}).refine(
  (data) => {
    if (!data.periodStart || !data.periodEnd) return true;
    return new Date(data.periodEnd) >= new Date(data.periodStart);
  },
  { message: "Period end must be on or after period start", path: ["periodEnd"] }
);

export type CreatePayrollRunInput = z.infer<typeof createPayrollRunSchema>;

export const payrollAdjustmentSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  period: z.string().min(1, "Period is required"),
  baseSalary: z.coerce.number().min(0, "Base salary must be non-negative"),
  allowances: z.coerce.number().min(0, "Allowances must be non-negative").default(0),
  deductions: z.coerce.number().min(0, "Deductions must be non-negative").default(0),
  notes: z.string().optional().default(""),
});

export type PayrollAdjustmentInput = z.infer<typeof payrollAdjustmentSchema>;

// ---------------------------------------------------------------------------
// Training Assignment Schema
// ---------------------------------------------------------------------------

export const assignTrainingSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  programId: z.string().min(1, "Training program is required"),
  notes: z.string().optional().default(""),
});

export type AssignTrainingInput = z.infer<typeof assignTrainingSchema>;

// ---------------------------------------------------------------------------
// Performance Review Schema
// ---------------------------------------------------------------------------

export const createPerformanceReviewSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  cycleId: z.string().min(1, "Review cycle is required"),
  score: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().optional().default(""),
});

export type CreatePerformanceReviewInput = z.infer<typeof createPerformanceReviewSchema>;

// ---------------------------------------------------------------------------
// Workflow Request Schema
// ---------------------------------------------------------------------------

export const createWorkflowRequestSchema = z.object({
  entityType: z.enum(["PERFORMANCE", "PAYROLL", "CONTRACT", "TRAINING", "PERSONNEL_ESCALATION"], {
    required_error: "Workflow type is required",
  }),
  entityId: z.string().min(1, "Entity ID is required"),
  destinationDept: z.string().min(1, "Destination department is required"),
  notes: z.string().optional().default(""),
});

export type CreateWorkflowRequestInput = z.infer<typeof createWorkflowRequestSchema>;

// ---------------------------------------------------------------------------
// Employee Action Schemas (Transfer, Promote, Suspend, Terminate)
// ---------------------------------------------------------------------------

export const transferEmployeeSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  targetDepartment: z.string().min(1, "Target department is required"),
  targetLocation: z.string().optional().default(""),
  reason: z.string().min(1, "Reason is required").max(500),
  effectiveDate: z.string().min(1, "Effective date is required"),
});

export type TransferEmployeeInput = z.infer<typeof transferEmployeeSchema>;

export const promoteEmployeeSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  newRole: z.string().min(1, "New role is required").max(100),
  newSalary: z.coerce.number().min(0, "Salary must be non-negative"),
  reason: z.string().min(1, "Reason is required").max(500),
  effectiveDate: z.string().min(1, "Effective date is required"),
});

export type PromoteEmployeeInput = z.infer<typeof promoteEmployeeSchema>;

export const suspendEmployeeSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  reason: z.string().min(1, "Reason is required").max(500),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional().default(""),
});

export type SuspendEmployeeInput = z.infer<typeof suspendEmployeeSchema>;

export const terminateEmployeeSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  reason: z.string().min(1, "Reason is required").max(500),
  effectiveDate: z.string().min(1, "Effective date is required"),
  finalSettlement: z.coerce.number().min(0).optional().default(0),
});

export type TerminateEmployeeInput = z.infer<typeof terminateEmployeeSchema>;

// ---------------------------------------------------------------------------
// Requisition Schema
// ---------------------------------------------------------------------------

export const createRequisitionSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  departmentId: z.string().min(1, "Department is required"),
  openings: z.coerce.number().min(1, "Must have at least 1 opening").max(100).default(1),
  description: z.string().optional().default(""),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

export type CreateRequisitionInput = z.infer<typeof createRequisitionSchema>;

// ---------------------------------------------------------------------------
// Cases/Grievance Schema
// ---------------------------------------------------------------------------

export const createCaseSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  title: z.string().min(1, "Title is required").max(200),
  category: z.enum(["grievance", "disciplinary", "complaint", "inquiry"], {
    required_error: "Category is required",
  }),
  description: z.string().min(1, "Description is required").max(2000),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;

// ---------------------------------------------------------------------------
// Contract Schema
// ---------------------------------------------------------------------------

export const createContractSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  title: z.string().min(1, "Contract title is required").max(200),
  type: z.enum(["permanent", "fixed_term", "probation", "freelance"], {
    required_error: "Contract type is required",
  }),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional().default(""),
  salary: z.coerce.number().min(0, "Salary must be non-negative"),
  notes: z.string().optional().default(""),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;

// ---------------------------------------------------------------------------
// Talent Pipeline Schemas (TalentFlow)
// ---------------------------------------------------------------------------

export const scheduleInterviewSchema = z.object({
  candidateId: z.string().min(1, "Candidate is required"),
  date: z.string().min(1, "Interview date is required"),
  time: z.string().min(1, "Interview time is required"),
  interviewerNotes: z.string().optional().default(""),
});

export type ScheduleInterviewInput = z.infer<typeof scheduleInterviewSchema>;

export const advanceCandidateSchema = z.object({
  candidateId: z.string().min(1, "Candidate is required"),
  notes: z.string().optional().default(""),
});

export type AdvanceCandidateInput = z.infer<typeof advanceCandidateSchema>;

export const rejectCandidateSchema = z.object({
  candidateId: z.string().min(1, "Candidate is required"),
  reason: z.string().min(1, "Reason is required").max(500),
});

export type RejectCandidateInput = z.infer<typeof rejectCandidateSchema>;

// ---------------------------------------------------------------------------
// Org Map Schemas (OrgMap)
// ---------------------------------------------------------------------------

export const createPositionSchema = z.object({
  title: z.string().min(1, "Position title is required").max(100),
  departmentId: z.string().min(1, "Department is required"),
  level: z.enum(["junior", "mid", "senior", "lead", "manager", "director"], {
    required_error: "Level is required",
  }),
  description: z.string().optional().default(""),
});

export type CreatePositionInput = z.infer<typeof createPositionSchema>;

export const assignEmployeePositionSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  positionId: z.string().min(1, "Position is required"),
  effectiveDate: z.string().min(1, "Effective date is required"),
  notes: z.string().optional().default(""),
});

export type AssignEmployeePositionInput = z.infer<typeof assignEmployeePositionSchema>;

// ---------------------------------------------------------------------------
// FlowGate Schemas
// ---------------------------------------------------------------------------

export const createFlowRouteSchema = z.object({
  entityType: z.enum(["PAYROLL", "LEAVE", "CONTRACT", "RECRUITMENT", "TRAINING", "PERFORMANCE", "CASE"], {
    required_error: "Entity type is required",
  }),
  entityId: z.string().min(1, "Entity ID is required"),
  destinationDept: z.string().min(1, "Destination department is required"),
  notes: z.string().optional().default(""),
});

export type CreateFlowRouteInput = z.infer<typeof createFlowRouteSchema>;

export const editFlowRouteSchema = z.object({
  destinationDept: z.string().min(1, "Destination department is required"),
  notes: z.string().optional().default(""),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

export type EditFlowRouteInput = z.infer<typeof editFlowRouteSchema>;

export const assignApproversSchema = z.object({
  flowId: z.string().min(1, "Flow ID is required"),
  approverIds: z.string().min(1, "At least one approver is required"),
  notes: z.string().optional().default(""),
});

export type AssignApproversInput = z.infer<typeof assignApproversSchema>;

// ---------------------------------------------------------------------------
// Roster/Shift Schemas (RosterGrid)
// ---------------------------------------------------------------------------

export const createShiftTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(100),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  departmentId: z.string().min(1, "Department is required"),
  notes: z.string().optional().default(""),
});

export type CreateShiftTemplateInput = z.infer<typeof createShiftTemplateSchema>;

export const assignShiftStaffSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  shiftTemplateId: z.string().min(1, "Shift template is required"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional().default(""),
});

export type AssignShiftStaffInput = z.infer<typeof assignShiftStaffSchema>;

export const swapShiftSchema = z.object({
  originalEmployeeId: z.string().min(1, "Original employee is required"),
  targetEmployeeId: z.string().min(1, "Target employee is required"),
  date: z.string().min(1, "Shift date is required"),
  reason: z.string().min(1, "Reason is required").max(500),
});

export type SwapShiftInput = z.infer<typeof swapShiftSchema>;

// ---------------------------------------------------------------------------
// Case Resolution Schema
// ---------------------------------------------------------------------------

export const resolveCaseSchema = z.object({
  caseId: z.string().min(1, "Case is required"),
  resolution: z.string().min(1, "Resolution notes are required").max(2000),
  status: z.enum(["resolved", "closed", "dismissed"]).default("resolved"),
});

export type ResolveCaseInput = z.infer<typeof resolveCaseSchema>;

// ---------------------------------------------------------------------------
// SkillTrack Schema
// ---------------------------------------------------------------------------

export const bulkAssignTrainingSchema = z.object({
  employeeIds: z.string().min(1, "Employee IDs are required"),
  programId: z.string().min(1, "Training program is required"),
  notes: z.string().optional().default(""),
});

export type BulkAssignTrainingInput = z.infer<typeof bulkAssignTrainingSchema>;

// ---------------------------------------------------------------------------
// VaultSpace Schema
// ---------------------------------------------------------------------------

export const createVaultDocumentSchema = z.object({
  title: z.string().min(1, "Document title is required").max(200),
  type: z.enum(["CONTRACT", "VISA_FILE", "POLICY", "PAYROLL_EXPORT", "KPI_REPORT"], {
    required_error: "Document type is required",
  }),
  notes: z.string().optional().default(""),
});

export type CreateVaultDocumentInput = z.infer<typeof createVaultDocumentSchema>;

// ---------------------------------------------------------------------------
// LexBoard Schema
// ---------------------------------------------------------------------------

export const createLegalContractSchema = z.object({
  title: z.string().min(1, "Contract title is required").max(200),
  templateId: z.string().min(1, "Template is required"),
  notes: z.string().optional().default(""),
});

export type CreateLegalContractInput = z.infer<typeof createLegalContractSchema>;

// ---------------------------------------------------------------------------
// GrowthCycle Schemas
// ---------------------------------------------------------------------------

export const createReviewCycleSchema = z.object({
  name: z.string().min(1, "Cycle name is required").max(100),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  dueDate: z.string().min(1, "Due date is required"),
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: "End date must be on or after start date", path: ["endDate"] }
);

export type CreateReviewCycleInput = z.infer<typeof createReviewCycleSchema>;

export const launchCycleSchema = z.object({
  cycleId: z.string().min(1, "Review cycle is required"),
  notes: z.string().optional().default(""),
});

export type LaunchCycleInput = z.infer<typeof launchCycleSchema>;

// ---------------------------------------------------------------------------
// PayCycle Schema
// ---------------------------------------------------------------------------

export const createPayrollRunSchema2 = z.object({
  periodStart: z.string().min(1, "Period start is required"),
  periodEnd: z.string().min(1, "Period end is required"),
}).refine(
  (data) => new Date(data.periodEnd) >= new Date(data.periodStart),
  { message: "Period end must be on or after period start", path: ["periodEnd"] }
);

export type CreatePayrollRun2Input = z.infer<typeof createPayrollRunSchema2>;

// ---------------------------------------------------------------------------
// SchedulingStudio Schema
// ---------------------------------------------------------------------------

export const shiftOverrideSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  coveringEmployeeId: z.string().min(1, "Covering employee is required"),
  date: z.string().min(1, "Date is required"),
  reason: z.string().min(1, "Reason is required").max(500),
});

export type ShiftOverrideInput = z.infer<typeof shiftOverrideSchema>;
