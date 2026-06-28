/**
 * HR Module Modal Forms
 *
 * All modal forms use:
 * - ModuleModal (shared generic modal with react-hook-form + Zod)
 * - useModuleMutation (TanStack Query mutation with cache invalidation)
 * - Zod schemas for client-side validation with field-level error display
 */

// Employee lifecycle
export { CreateEmployeeModal } from "./CreateEmployeeModal";
export { UpdateEmployeeModal } from "./UpdateEmployeeModal";
export { TransferEmployeeModal } from "./TransferEmployeeModal";
export { PromoteEmployeeModal } from "./PromoteEmployeeModal";
export { SuspendEmployeeModal } from "./SuspendEmployeeModal";
export { TerminateEmployeeModal } from "./TerminateEmployeeModal";

// Department & Org
export { CreateDepartmentModal } from "./CreateDepartmentModal";
export { CreatePositionModal } from "./CreatePositionModal";
export { AssignEmployeePositionModal } from "./AssignEmployeePositionModal";

// Talent Pipeline
export { CreateRequisitionModal } from "./CreateRequisitionModal";
export { ScheduleInterviewModal } from "./ScheduleInterviewModal";
export { AdvanceCandidateModal } from "./AdvanceCandidateModal";
export { RejectCandidateModal } from "./RejectCandidateModal";

// FlowGate (Approval workflows)
export { CreateWorkflowRequestModal } from "./CreateWorkflowRequestModal";
export { CreateFlowRouteModal } from "./CreateFlowRouteModal";
export { EditFlowRouteModal } from "./EditFlowRouteModal";
export { AssignApproversModal } from "./AssignApproversModal";

// Roster / Scheduling
export { CreateShiftTemplateModal } from "./CreateShiftTemplateModal";
export { AssignShiftStaffModal } from "./AssignShiftStaffModal";
export { SwapShiftModal } from "./SwapShiftModal";
export { ShiftOverrideModal } from "./ShiftOverrideModal";

// Cases
export { CreateCaseModal } from "./CreateCaseModal";
export { ResolveCaseModal } from "./ResolveCaseModal";

// Training & Skills
export { AssignTrainingModal } from "./AssignTrainingModal";
export { BulkAssignTrainingModal } from "./BulkAssignTrainingModal";

// Documents & Legal
export { CreateVaultDocumentModal } from "./CreateVaultDocumentModal";
export { CreateLegalContractModal } from "./CreateLegalContractModal";
export { CreateContractModal } from "./CreateContractModal";

// Performance
export { PerformanceReviewModal } from "./PerformanceReviewModal";
export { CreateReviewCycleModal } from "./CreateReviewCycleModal";
export { LaunchCycleModal } from "./LaunchCycleModal";

// Payroll
export { CreatePayrollRunModal } from "./CreatePayrollRunModal";
export { CreatePayrollRunModal2 } from "./CreatePayrollRunModal2";
export { PayrollAdjustmentModal } from "./PayrollAdjustmentModal";

// Leave & Attendance
export { CreateLeaveRequestModal } from "./CreateLeaveRequestModal";
export { CreateAttendanceModal } from "./CreateAttendanceModal";
