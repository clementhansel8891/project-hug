import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Patch,
  UploadedFile,
  Res,
  UseInterceptors,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { HRMutationInterceptor } from "./interceptors/hr-mutation.interceptor";
import { IdempotencyInterceptor } from "../../shared/interceptors/idempotency.interceptor";
import { HRService } from "./hr.service";
import { HrPayrollService } from "./hr-payroll.service";
import { IHRRepository } from "./repositories/hr.repository.interface";
import { PrismaService } from "../../persistence/prisma.service";
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  ClockInDto,
  CreateLeaveRequestDto,
  CreateDepartmentDto,
  CreateRequisitionDto,
  CreatePerformanceCycleDto,
  SubmitReviewDto,
  CreateCaseDto,
  CreateContractDto,
  ScheduleInterviewDto,
  UpdateInterviewStatusDto,
  PromoteEmployeeDto,
  TransferEmployeeDto,
  SuspendEmployeeDto,
  CreateCandidateDto,
  UpdatePositionDto,
  UpdateCompensationDto,
  IngestTalentLeadDto,
  UploadComplianceDocumentDto,
  CreateBudgetScenarioDto,
  CreateHeadcountPlanDto,
  CreateBenefitPlanDto,
  EnrollBenefitDto,
  UpdatePerformanceGoalDto,
  EnrollTrainingDto,
  SimulateInflationDto,
  CreateMentorshipDto,
  MatchTalentDto,
  ConvertLeadDto,
  GenerateDescriptionDto,
  PublishJobPostDto,
} from "./dto";
import { TalentSourcingService } from "./talent-sourcing.service";
import { ComplianceService } from "./compliance.service";
import { HrSettlementService } from "./hr-settlement.service";
import { AnalyticsService } from "./analytics.service";
import { WorkforcePlannerService } from "./workforce-planner.service";
import { PayrollConsolidationService } from "./payroll-consolidation.service";
import { SuccessionService } from "./succession.service";
import { SkillsService } from "./skills.service";
import { TotalRewardsService } from "./total-rewards.service";
import { CareerPathService } from "./career-path.service";
import { JobDescriptionService } from "./job-description.service";
import { PerformancePredictorService } from "./performance-predictor.service";
import { LearningService } from "./learning.service";
import { LaborCostService } from "./labor-cost.service";
import { TenantContext } from "../../gateway/tenant-context.interface";
import { TenantInterceptor } from "../../gateway/tenant.interceptor";
import { TimeAndAttendanceService } from "./time/time.service";
import { WorkflowService } from "../../shared/workflow/workflow.service";
import { SchedulingService } from "./scheduling.service";
import { HrRecruitmentService } from "./hr-recruitment.service";

interface RequestWithTenant extends Request {
  tenantContext: TenantContext;
}
import { ModuleStateGuard } from "../auth/guards/module-state.guard";
import { BranchGatingGuard } from "../auth/guards/branch-gating.guard";
import { TenantGuard } from "../../shared/guards/tenant.guard";
import { RequiredModule } from "../../shared/decorators/required-module.decorator";
import { isModuleActive } from "../../shared/helpers/module-active.helper";
import { AuditService } from "../../shared/audit/audit.service";
import { ComplianceEngineService } from "../../modules/compliance/compliance.service";
import { ComplianceSuggestionService } from "../../modules/compliance/compliance-suggestion.service";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { UserRole } from "../../shared/roles";
import { TenantScopeResolver } from "./scope/tenant-scope.resolver";
import { NotFoundException } from "./utils/hr-prisma.errors";
import {
  AvailableStaff,
  mapToAvailableStaff,
} from "./contracts/consumer-contracts";

interface RequestWithTenant extends Request {
  tenantContext: TenantContext;
}

/**
 * HR Controller
 * REST API endpoints for HR operations
 * All endpoints require x-tenant-id header
 */
@Controller('hr')
@UseInterceptors(TenantInterceptor, HRMutationInterceptor, IdempotencyInterceptor)
@UseGuards(ModuleStateGuard, BranchGatingGuard, TenantGuard, RolesGuard)
@RequiredModule("hr")
@Throttle({ default: { limit: 20, ttl: 60000 } })
export class HRController {
  constructor(
    private readonly hrService: HRService,
    private readonly talentSourcingService: TalentSourcingService,
    private readonly complianceService: ComplianceService,
    private readonly analyticsService: AnalyticsService,
    private readonly workforcePlannerService: WorkforcePlannerService,
    private readonly payrollConsolidationService: PayrollConsolidationService,
    private readonly successionService: SuccessionService,
    private readonly skillsService: SkillsService,
    private readonly totalRewardsService: TotalRewardsService,
    private readonly careerPathService: CareerPathService,
    private readonly jobDescriptionService: JobDescriptionService,
    private readonly performancePredictorService: PerformancePredictorService,
    private readonly learningService: LearningService,
    private readonly laborCostService: LaborCostService,
    private readonly repository: IHRRepository,
    private readonly auditService: AuditService,
    private readonly complianceEngineService: ComplianceEngineService,
    private readonly complianceSuggestionService: ComplianceSuggestionService,
    private readonly settlementService: HrSettlementService,
    private readonly hrPayrollService: HrPayrollService,
    private readonly scopeResolver: TenantScopeResolver,
    private readonly timeService: TimeAndAttendanceService,
    private readonly workflowService: WorkflowService,
    private readonly schedulingService: SchedulingService,
    private readonly recruitmentService: HrRecruitmentService,
  ) {}
  // ==================== Overview (Module-Aware) ====================

  /**
   * GET /hr/overview
   * HR workspace overview — enriched with data from active industry modules.
   * Always returns core HR metrics; adds retail workforce data when retail is active.
   */
  @Get("overview")
  async getOverview(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;

    // Core HR metrics (via Repository)
    const metrics = await this.repository.getOverviewMetrics(tenant_id);

    const coreWorkforce = {
      ...metrics,
      attendanceToday: "N/A", // To be implemented in Phase 3
    };

    // Module Contributions (via Repository)
    let retailContribution: Record<string, any> | null = null;
    const retailIsActive = await this.repository.isModuleActive(tenant_id, "retail");
    
    if (retailIsActive) {
      retailContribution = await this.repository.getRetailOverviewMetrics(tenant_id);
    }

    return {
      success: true,
      tenant_id,
      data: {
        coreWorkforce,
        moduleContributions: {
          retail: retailContribution,
        },
      },
    };
  }

  // ==================== Employee Management ====================

  /**
   * GET /hr/employees
   * List all employees for the tenant.
   *
   * Supports an optional `?projection=staff` query parameter. When supplied,
   * the endpoint returns the scoped roster as an `AvailableStaff[]` projection
   * (`{ id, name, role }`) consumed by downstream modules such as the Retail
   * `ShiftControl` page, replacing its hardcoded `AVAILABLE_STAFF` list
   * (Requirements 1.6, 6.6). Without the parameter, the full employee list is
   * returned unchanged for existing consumers.
   */
  @Get("employees")
  async getEmployees(
    @Req() request: RequestWithTenant,
    @Query("location_id") location_id?: string,
    @Query("company_id") company_id?: string,
    @Query("departmentId") departmentId?: string,
    @Query("projection") projection?: string,
  ) {
    // Derive the effective, validated scope from the verified context. The
    // resolver pins tenant_id to the context, forces non-privileged callers to
    // their own location/company, and validates any requested filter belongs to
    // the caller's tenant (Requirements 2.1, 2.5, 2.6).
    const scope = await this.scopeResolver.resolve(request.tenantContext, {
      location_id,
      company_id,
    });

    const result = await this.hrService.getEmployees(
      scope.tenant_id,
      scope.location_id,
      scope.company_id,
      departmentId,
    );

    // Scoped roster projection for consumer modules: conform to the
    // `AvailableStaff { id, name, role }` contract (Requirements 1.6, 6.6).
    if (projection === "staff") {
      const staff: AvailableStaff[] = result.data.map(mapToAvailableStaff);

      return {
        success: true,
        tenant_id: scope.tenant_id,
        location_id: scope.location_id || "all",
        company_id: scope.company_id || "all",
        count: staff.length,
        total: result.total,
        data: staff,
      };
    }

    return {
      success: true,
      tenant_id: scope.tenant_id,
      location_id: scope.location_id || "all",
      company_id: scope.company_id || "all",
      count: result.data.length,
      total: result.total,
      data: result.data,
    };
  }

  /**
   * GET /hr/employees/export
   * Export employee list to Excel
   * NOTE: Must be defined BEFORE the :id route to avoid NestJS matching "export" as an ID.
   */
  @Get("employees/export")
  async exportEmployees(
    @Req() request: RequestWithTenant,
    @Res() res: Response,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const buffer = await this.hrService.exportEmployees(tenant_id, user_id!);

    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="employees_${tenant_id}_${Date.now()}.xlsx"`,
      "Content-Length": buffer.length,
    });

    res.end(buffer);
  }

  /**
   * GET /hr/employees/:id
   * Get a specific employee
   */
  @Get("employees/:id")
  async getEmployee(
    @Req() request: RequestWithTenant,
    @Param("id") employee_id: string,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);

    // Composite-key read: findFirst({ where: { id, tenant_id } }) in the
    // repository. An employee owned by another tenant resolves to null and
    // therefore surfaces as a 404 (Requirements 4.3, 6.7).
    const employee = await this.hrService.getEmployeeById(
      scope.tenant_id,
      employee_id,
    );

    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    return {
      success: true,
      tenant_id: scope.tenant_id,
      data: employee,
    };
  }

  /**
   * POST /hr/employees
   * Create a new employee
   */
  @Post("employees")
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPERADMIN)
  async createEmployee(
    @Req() request: RequestWithTenant,
    @Body() createEmployeeDto: CreateEmployeeDto,
  ) {
    const { user_id } = request.tenantContext;

    // Resolve scope from the verified context, validating any body-supplied
    // location/company belongs to the caller's tenant, then bind the persisted
    // scope to the resolved values rather than trusting the request body
    // (Requirements 2.2, 2.3, 2.5).
    const scope = await this.scopeResolver.resolve(request.tenantContext, {
      location_id: createEmployeeDto.location_id,
      company_id: createEmployeeDto.company_id,
    });

    createEmployeeDto.location_id = scope.location_id;
    createEmployeeDto.company_id = scope.company_id;

    const employee = await this.hrService.createEmployee(
      scope.tenant_id,
      createEmployeeDto,
      user_id,
    );

    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Employee created successfully",
      data: employee,
    };
  }

  /**
   * PUT /hr/employees/:id
   * Update an employee
   */
  @Put("employees/:id")
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPERADMIN)
  async updateEmployee(
    @Req() request: RequestWithTenant,
    @Param("id") employee_id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    const { user_id } = request.tenantContext;

    // Resolve scope; when the payload reassigns a location, validate it belongs
    // to the caller's tenant and bind to the resolved value. Only override when
    // supplied so partial-update semantics are preserved (Requirements 2.2, 2.5).
    const scope = await this.scopeResolver.resolve(request.tenantContext, {
      location_id: updateEmployeeDto.location_id,
    });

    if (updateEmployeeDto.location_id) {
      updateEmployeeDto.location_id = scope.location_id;
    }

    const employee = await this.hrService.updateEmployee(
      scope.tenant_id,
      employee_id,
      updateEmployeeDto,
      user_id,
    );

    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Employee updated successfully",
      data: employee,
    };
  }

  /**
   * DELETE /hr/employees/:id
   * Deactivate an employee (soft delete)
   */
  @Delete("employees/:id")
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPERADMIN)
  async deactivateEmployee(
    @Req() request: RequestWithTenant,
    @Param("id") employee_id: string,
  ) {
    const { user_id } = request.tenantContext;
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const employee = await this.hrService.deactivateEmployee(
      scope.tenant_id,
      employee_id,
      user_id,
    );

    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Employee deactivated successfully",
      data: employee,
    };
  }

  /**
   * POST /hr/employees/import
   * Bulk import employees from CSV/Excel
   */
  @Post("employees/import")
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPERADMIN)
  @UseInterceptors(FileInterceptor("file"))
  async importEmployees(
    @Req() request: RequestWithTenant,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    if (!file) {
      throw new BadRequestException("A file is required (multipart field 'file')");
    }
    const fileType = file.originalname.endsWith(".csv") ? "csv" : "xlsx";

    const result = await this.hrService.importEmployees(
      tenant_id,
      file.buffer,
      fileType,
      user_id!,
    );

    return {
      success: true,
      tenant_id,
      message: `Imported ${result.imported} employees`,
      errors: result.errors,
    };
  }

  // ==================== Attendance Management ====================

  /**
   * GET /hr/attendance
   * Get attendance records
   */
  @Get("attendance")
  async getAttendance(
    @Req() request: RequestWithTenant,
    @Query("employee_id") employee_id?: string,
    @Query("start_date") start_date?: string,
    @Query("end_date") end_date?: string,
  ) {
    const {
      tenant_id,
      role,
      location_id: contextLocationId,
    } = request.tenantContext;

    const effectiveLocationId =
      role === "SUPERADMIN" || role === "OWNER" || role === "ADMIN"
        ? undefined // Admin can filter by query or see all
        : contextLocationId;

    const result =
      role === "SUPERADMIN"
        ? await this.hrService.getGlobalAttendance(
            employee_id,
            start_date,
            end_date,
          )
        : await this.hrService.getAttendance(
            tenant_id,
            effectiveLocationId,
            employee_id,
            start_date,
            end_date,
          );

    return {
      success: true,
      tenant_id,
      employee_id: employee_id || "all",
      count: result.data.length,
      total: result.total,
      data: result.data,
    };
  }

  /**
   * POST /hr/attendance/clock-in
   * Clock in an employee.
   *
   * Consolidation (task 6.1): clock-in/out for all HR controllers
   * (`HRController`, `HrAttendanceController`, `time/time.controller`) is routed
   * through the single canonical `TimeAndAttendanceService` code path so the
   * single-open-record invariant and clock logic live in one place (implemented
   * in task 6.2). Identity is sourced from the verified `request.tenantContext`,
   * never from client headers (Requirements 2.1, 2.2, 2.3). The mutating
   * endpoint carries a `@Roles(...)` gate (Requirements 3.1, 3.2, 3.4).
   */
  @Post("attendance/clock-in")
  @Roles(UserRole.MEMBER, UserRole.MANAGER, UserRole.ADMIN)
  async clock_in(
    @Req() request: RequestWithTenant,
    @Body() clockInDto: ClockInDto,
  ) {
    const { tenant_id, location_id } = request.tenantContext;
    const effectiveLocationId =
      clockInDto.location_id || location_id || "default";

    const attendance = await this.timeService.clock_in(
      tenant_id,
      clockInDto.employee_id,
      effectiveLocationId,
      { source: "WEB", reason: clockInDto.notes },
    );

    return {
      success: true,
      tenant_id,
      message: "Clocked in successfully",
      data: attendance,
    };
  }

  /**
   * POST /hr/attendance/clock-out
   * Clock out an employee. Routed through the single canonical
   * `TimeAndAttendanceService` path (see clock-in note above).
   */
  @Post("attendance/clock-out")
  @Roles(UserRole.MEMBER, UserRole.MANAGER, UserRole.ADMIN)
  async clock_out(
    @Req() request: RequestWithTenant,
    @Body() body: { employee_id: string },
  ) {
    const { tenant_id } = request.tenantContext;
    const attendance = await this.timeService.clock_out(
      tenant_id,
      body.employee_id,
    );

    return {
      success: true,
      tenant_id,
      message: "Clocked out successfully",
      data: attendance,
    };
  }

  // ==================== Leave Management ====================

  /**
   * GET /hr/leave-requests
   * Get leave requests
   */
  @Get("leave-requests")
  async getLeaveRequests(
    @Req() request: RequestWithTenant,
    @Query("status") status?: string,
    @Query("employee_id") employee_id?: string,
  ) {
    const {
      tenant_id,
      role,
      location_id: contextLocationId,
    } = request.tenantContext;

    const effectiveLocationId =
      role === "SUPERADMIN" || role === "OWNER" || role === "ADMIN"
        ? undefined
        : contextLocationId;

    const requests =
      role === "SUPERADMIN"
        ? await this.hrService.getGlobalLeaveRequests(status, employee_id)
        : await this.hrService.getLeaveRequests(
            tenant_id,
            effectiveLocationId,
            status,
            employee_id,
          );

    return {
      success: true,
      tenant_id,
      count: requests.length,
      data: requests,
    };
  }

  /**
   * POST /hr/leave-requests
   * Create a leave request
   */
  @Post("leave-requests")
  async createLeaveRequest(
    @Req() request: RequestWithTenant,
    @Body() createLeaveRequestDto: CreateLeaveRequestDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const leaveRequest = await this.hrService.createLeaveRequest(
      tenant_id,
      createLeaveRequestDto,
      user_id,
    );

    return {
      success: true,
      tenant_id,
      message: "Leave request created successfully",
      data: leaveRequest,
    };
  }

  /**
   * PUT /hr/leave-requests/:id/approve
   * Approve a leave request
   */
  @Put("leave-requests/:id/approve")
  async approveLeaveRequest(
    @Req() request: RequestWithTenant,
    @Param("id") request_id: string,
    @Body() body: { reviewerId: string; notes?: string },
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const leaveRequest = await this.hrService.approveLeaveRequest(
      tenant_id,
      request_id,
      body.reviewerId,
      body.notes,
      user_id,
    );

    return {
      success: true,
      tenant_id,
      message: "Leave request approved",
      data: leaveRequest,
    };
  }

  /**
   * PUT /hr/leave-requests/:id/reject
   * Reject a leave request
   */
  @Put("leave-requests/:id/reject")
  async rejectLeaveRequest(
    @Req() request: RequestWithTenant,
    @Param("id") request_id: string,
    @Body() body: { reviewerId: string; notes: string },
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const leaveRequest = await this.hrService.rejectLeaveRequest(
      tenant_id,
      request_id,
      body.reviewerId,
      body.notes,
      user_id,
    );

    return {
      success: true,
      tenant_id,
      message: "Leave request rejected",
      data: leaveRequest,
    };
  }

  // ==================== Payroll Management ====================

  /**
   * GET /hr/payroll/:employee_id
   * Get payroll records for an employee
   */
  @Get("payroll/:employee_id")
  async getPayroll(
    @Req() request: RequestWithTenant,
    @Param("employee_id") employee_id: string,
    @Query("period") period?: string,
  ) {
    const {
      tenant_id,
      role,
      location_id: contextLocationId,
    } = request.tenantContext;

    const effectiveLocationId =
      role === "SUPERADMIN" || role === "OWNER" || role === "ADMIN"
        ? undefined
        : contextLocationId;

    const payrolls =
      role === "SUPERADMIN"
        ? await this.hrService.getGlobalPayroll(employee_id, period)
        : await this.hrService.getPayroll(
            tenant_id,
            effectiveLocationId,
            employee_id,
            period,
          );

    return {
      success: true,
      tenant_id,
      employee_id,
      count: payrolls.length,
      data: payrolls,
    };
  }

  /**
   * POST /hr/payroll/:employee_id/calculate
   * Calculate payroll for an employee
   */
  @Post("payroll/:employee_id/calculate")
  async calculatePayroll(
    @Req() request: RequestWithTenant,
    @Param("employee_id") employee_id: string,
    @Body() body: { period: string },
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const payroll = await this.hrPayrollService.calculatePayroll(
      tenant_id,
      employee_id,
      body.period,
      user_id,
    );

    return {
      success: true,
      tenant_id,
      message: "Payroll calculated successfully",
      data: payroll,
    };
  }

  /**
   * POST /hr/payroll/runs/:id/approve
   */
  @Post("payroll/runs/:id/approve")
  async approvePayrollRun(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const run = await this.settlementService.approvePayrollRun(tenant_id, id, user_id || "system");
    return { success: true, data: run };
  }

  /**
   * POST /hr/payroll/runs/:id/disburse
   */
  @Post("payroll/runs/:id/disburse")
  async disbursePayrollRun(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const run = await this.settlementService.disbursePayrollRun(tenant_id, id, user_id || "system");
    return { success: true, data: run };
  }

  /**
   * POST /hr/payroll/runs/:id/settle
   */
  @Post("payroll/runs/:id/settle")
  async settlePayrollRun(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const run = await this.settlementService.settlePayrollRun(tenant_id, id, user_id || "system");
    return { success: true, data: run };
  }

  // ==================== Organization Management ====================

  @Get("departments")
  async getDepartments(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    // Always scope to the active tenant. The previous SUPERADMIN branch returned
    // departments across ALL tenants, which leaked cross-tenant data into this
    // tenant-scoped endpoint and broke tenant UIs (e.g. the scheduler picking a
    // foreign-tenant department). A true global view belongs on an admin route.
    const departments = await this.hrService.getDepartments(tenant_id);
    return { success: true, tenant_id, data: departments };
  }

  @Post("departments")
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPERADMIN)
  async createDepartment(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateDepartmentDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const department = await this.hrService.createDepartment(
      tenant_id,
      dto,
      user_id,
    );
    return { success: true, tenant_id, data: department };
  }

  // ==================== Recruitment Management ====================

  @Get("requisitions")
  async getRequisitions(
    @Req() request: RequestWithTenant,
    @Query("status") status?: string,
  ) {
    const { tenant_id, role } = request.tenantContext;

    const requisitions =
      role === "SUPERADMIN"
        ? await this.hrService.getGlobalRequisitions(status)
        : await this.hrService.getRequisitions(tenant_id, status);

    return { success: true, tenant_id, data: requisitions };
  }

  @Post("requisitions")
  async createRequisition(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateRequisitionDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const requisition = await this.hrService.createRequisition(
      tenant_id,
      dto,
      user_id,
    );
    return { success: true, tenant_id, data: requisition };
  }

  @Patch("requisitions/:id")
  async updateRequisition(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const requisition = await this.hrService.updateRequisition(
      tenant_id,
      id,
      body,
      user_id,
    );
    return { success: true, tenant_id, data: requisition };
  }

  // ==================== Performance Management ====================

  @Get("performance/cycles")
  async getPerformanceCycles(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const cycles = await this.hrService.getPerformanceCycles(tenant_id);
    return { success: true, tenant_id, data: cycles };
  }

  @Post("performance/cycles")
  async createPerformanceCycle(
    @Req() request: RequestWithTenant,
    @Body() dto: CreatePerformanceCycleDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const cycle = await this.hrService.createPerformanceCycle(
      tenant_id,
      dto,
      user_id,
    );
    return { success: true, tenant_id, data: cycle };
  }

  @Get("performance/reviews")
  async getPerformanceReviews(
    @Req() request: RequestWithTenant,
    @Query("cycleId") cycleId?: string,
    @Query("employee_id") employee_id?: string,
  ) {
    const { tenant_id, role } = request.tenantContext;

    const reviews =
      role === "SUPERADMIN"
        ? await this.hrService.getGlobalPerformanceReviews(cycleId, employee_id)
        : await this.hrService.getPerformanceReviews(
            tenant_id,
            cycleId,
            employee_id,
          );

    return { success: true, tenant_id, data: reviews };
  }

  @Post("performance/reviews")
  async submitPerformanceReview(
    @Req() request: RequestWithTenant,
    @Body() dto: SubmitReviewDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const review = await this.hrService.submitPerformanceReview(
      tenant_id,
      dto,
      user_id,
    );
    return { success: true, tenant_id, data: review };
  }

  // ==================== Lifecycle Transitions ====================

  @Patch("employees/:id/promote")
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPERADMIN)
  async promoteEmployee(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() dto: PromoteEmployeeDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const employee = await this.hrService.promoteEmployee(tenant_id, id, dto, user_id);
    return { success: true, tenant_id, message: "Employee promoted", data: employee };
  }

  @Patch("employees/:id/transfer")
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPERADMIN)
  async transferEmployee(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() dto: TransferEmployeeDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const employee = await this.hrService.transferEmployee(tenant_id, id, dto, user_id);
    return { success: true, tenant_id, message: "Employee transferred", data: employee };
  }

  @Patch("employees/:id/suspend")
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPERADMIN)
  async suspendEmployee(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() dto: SuspendEmployeeDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const employee = await this.hrService.suspendEmployee(tenant_id, id, dto.reason, user_id);
    return { success: true, tenant_id, message: "Employee suspended", data: employee };
  }

  @Put("employees/:id/status")
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPERADMIN)
  async updateEmployeeStatus(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() body: { status: string },
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const employee = await this.hrService.updateEmployee(
      tenant_id,
      id,
      { status: body.status },
      user_id,
    );
    return { 
      success: true, 
      tenant_id, 
      message: `Employee status updated to ${body.status}`, 
      data: employee 
    };
  }

  // ==================== Talent Management ====================

  @Get("candidates")
  async getCandidates(
    @Req() request: RequestWithTenant,
    @Query("status") status?: string,
  ) {
    const { tenant_id } = request.tenantContext;
    const candidates = await this.hrService.getCandidates(tenant_id, status);
    return { success: true, tenant_id, data: candidates };
  }

  @Post("candidates")
  async createCandidate(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateCandidateDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const candidate = await this.hrService.createCandidate(tenant_id, dto, user_id);
    return { success: true, tenant_id, data: candidate };
  }

  @Post("candidates/:id/hire")
  async hireCandidate(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() body?: any,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    // Pass a data object (not the bare user_id string) so the verified actor is
    // recorded on the hire audit log and any supplied hire details (location,
    // department, salary) reach the atomic hire transaction.
    const employee = await this.hrService.hireCandidate(tenant_id, id, {
      ...(body || {}),
      actor_id: user_id,
    });
    return { success: true, tenant_id, message: "Candidate hired as employee", data: employee };
  }

  // ==================== Headcount & Compensation ====================

  @Get("positions")
  async getPositions(
    @Req() request: RequestWithTenant,
    @Query("department_id") department_id?: string,
  ) {
    const { tenant_id } = request.tenantContext;
    const positions = await this.hrService.getPositions(tenant_id, department_id);
    return { success: true, tenant_id, data: positions };
  }

  @Patch("positions/:id")
  async updatePosition(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() dto: UpdatePositionDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const position = await this.hrService.updatePosition(tenant_id, id, dto, user_id);
    return { success: true, tenant_id, data: position };
  }

  @Get("employees/:id/compensation")
  async getCompensation(
    @Req() request: RequestWithTenant,
    @Param("id") employee_id: string,
  ) {
    const { tenant_id } = request.tenantContext;
    const compensation = await this.hrService.getCompensation(tenant_id, employee_id);
    return { success: true, tenant_id, data: compensation };
  }

  @Patch("employees/:id/compensation")
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPERADMIN)
  async updateCompensation(
    @Req() request: RequestWithTenant,
    @Param("id") employee_id: string,
    @Body() dto: UpdateCompensationDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const compensation = await this.hrService.updateCompensation(tenant_id, employee_id, dto, user_id);
    return { success: true, tenant_id, data: compensation };
  }

  // ==================== Case Management ====================

  @Get("cases")
  async getCases(
    @Req() request: RequestWithTenant,
    @Query("status") status?: string,
  ) {
    const {
      tenant_id,
      role,
      location_id: contextLocationId,
    } = request.tenantContext;

    const effectiveLocationId =
      role === "SUPERADMIN" || role === "OWNER" || role === "ADMIN"
        ? undefined
        : contextLocationId;

    const cases = await this.hrService.getCases(
      tenant_id,
      effectiveLocationId,
      status,
    );
    return { success: true, tenant_id, data: cases };
  }

  @Get("cases/:id")
  async getCase(@Req() request: RequestWithTenant, @Param("id") id: string) {
    const { tenant_id } = request.tenantContext;
    const hrCase = await this.hrService.getCaseById(tenant_id, id);
    return { success: true, tenant_id, data: hrCase };
  }

  @Post("cases")
  async createCase(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateCaseDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const hrCase = await this.hrService.createCase(tenant_id, dto, user_id);
    return { success: true, tenant_id, data: hrCase };
  }

  @Patch("cases/:id")
  async updateCase(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const hrCase = await this.hrService.updateCase(tenant_id, id, body, user_id);
    return { success: true, tenant_id, data: hrCase };
  }

  // ==================== Contract Management ====================

  @Get("contracts")
  async getContracts(
    @Req() request: RequestWithTenant,
    @Query("employee_id") employee_id?: string,
  ) {
    const {
      tenant_id,
      role,
      location_id: contextLocationId,
    } = request.tenantContext;

    const effectiveLocationId =
      role === "SUPERADMIN" || role === "OWNER" || role === "ADMIN"
        ? undefined
        : contextLocationId;

    const contracts =
      role === "SUPERADMIN"
        ? await this.hrService.getGlobalContracts(employee_id)
        : await this.hrService.getContracts(
            tenant_id,
            effectiveLocationId,
            employee_id,
          );

    return { success: true, tenant_id, data: contracts };
  }

  @Post("contracts")
  async createContract(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateContractDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const contract = await this.hrService.createContract(tenant_id, dto, user_id);
    return { success: true, tenant_id, data: contract };
  }

  @Patch("contracts/:id")
  async updateContract(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const contract = await this.hrService.updateContract(
      tenant_id,
      id,
      body,
      user_id,
    );
    return { success: true, tenant_id, data: contract };
  }

  // ==================== Payroll Runs Management ====================

  /**
   * GET /hr/payroll-runs
   * List all payroll runs for the tenant (tracked as HRCase with type=PAYROLL_RUN)
   */
  @Get("payroll-runs")
  async getPayrollRuns(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const runs = await this.repository.getPayrollRuns(tenant_id);
    return { success: true, tenant_id, data: runs };
  }

  /**
   * POST /hr/payroll-runs
   * Create a payroll run
   */
  @Post("payroll-runs")
  async createPayrollRun(
    @Req() request: RequestWithTenant,
    @Body() body: { period_start?: string; period_end?: string; periodStart?: string; periodEnd?: string },
  ) {
    const { tenant_id, user_id } = request.tenantContext;

    // Accept both snake_case (period_start) and camelCase (periodStart). The
    // frontend payrollService sends camelCase, so normalize here and validate
    // up front to return a 400 instead of a Prisma 500 on Invalid Date.
    const periodStart = body.period_start ?? body.periodStart;
    const periodEnd = body.period_end ?? body.periodEnd;

    if (!periodStart || !periodEnd) {
      throw new BadRequestException("period_start and period_end are required");
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException("period_start and period_end must be valid dates");
    }
    if (endDate < startDate) {
      throw new BadRequestException("period_end must be on or after period_start");
    }

    const run = await this.repository.createPayrollRun(tenant_id, {
      period_start: periodStart,
      period_end: periodEnd,
    });

    await this.auditService.log({
      tenant_id,
      user_id: user_id || "system",
      module: "hr",
      action: "CREATE",
      entity_type: "PAYROLL_RUN",
      entity_id: run.id,
      metadata: { period_start: periodStart, period_end: periodEnd },
    });

    return {
      success: true,
      tenant_id,
      data: run
    };
  }


  /**
   * POST /hr/payroll/runs  (alias)
   * The CreatePayrollRunModal posts to the slashed path; delegate to the
   * canonical `payroll-runs` handler so both spellings work.
   */
  @Post("payroll/runs")
  async createPayrollRunAlias(
    @Req() request: RequestWithTenant,
    @Body() body: { period_start?: string; period_end?: string; periodStart?: string; periodEnd?: string },
  ) {
    return this.createPayrollRun(request, body);
  }

  /**
   * POST /hr/workflows
   * The HR FlowGate modals (CreateWorkflowRequestModal, CreateFlowRouteModal)
   * post here with camelCase. Bridge to the canonical shared WorkflowService
   * (the `/workflow/request` route), defaulting the maker department to HR.
   */
  @Post("workflows")
  async createWorkflowRequest(
    @Req() request: RequestWithTenant,
    @Body()
    body: {
      entityType?: string;
      entityId?: string;
      makerDept?: string;
      destinationDept?: string;
      notes?: string;
      metadata?: any;
    },
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    if (!body.entityType || !body.entityId || !body.destinationDept) {
      throw new BadRequestException(
        "entityType, entityId and destinationDept are required",
      );
    }
    const data = await this.workflowService.createRequest({
      tenant_id,
      entity_type: body.entityType,
      entity_id: body.entityId,
      maker_dept: body.makerDept || "HR",
      destination_dept: body.destinationDept,
      requested_by: user_id || "system",
      notes: body.notes,
      metadata: body.metadata,
    });
    return { success: true, tenant_id, data };
  }

  /**
   * POST /hr/roster/assignments
   * The AssignShiftStaffModal posts here with camelCase. Bridge to the
   * scheduling service, which derives the required location from the employee.
   */
  @Post("roster/assignments")
  async createRosterAssignment(
    @Req() request: RequestWithTenant,
    @Body() body: { employeeId?: string; shiftTemplateId?: string; date?: string; notes?: string },
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    if (!body.employeeId || !body.shiftTemplateId || !body.date) {
      throw new BadRequestException(
        "employeeId, shiftTemplateId and date are required",
      );
    }
    const data = await this.schedulingService.createAssignment(
      tenant_id,
      {
        employee_id: body.employeeId,
        shift_id: body.shiftTemplateId,
        effective_date: body.date,
        notes: body.notes,
      },
      user_id || "system",
    );
    return { success: true, tenant_id, data };
  }

  // ==================== Talent / Candidates (frontend `/hr/candidates/:id`, `/hr/talent/*`) ====================

  /** GET /hr/candidates/:id — candidate profile (recruitmentService.getCandidateProfile). */
  @Get("candidates/:id")
  async getCandidate(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
  ) {
    const { tenant_id } = request.tenantContext;
    const data = await this.repository.getCandidateById(tenant_id, id);
    if (!data) throw new BadRequestException("Candidate not found");
    return { success: true, tenant_id, data };
  }

  /** POST /hr/talent/candidates/advance — move candidate to next stage. */
  @Post("talent/candidates/advance")
  async advanceCandidate(
    @Req() request: RequestWithTenant,
    @Body() body: { candidateId?: string; notes?: string },
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    if (!body.candidateId) throw new BadRequestException("candidateId is required");
    const data = await this.recruitmentService.advanceCandidate(tenant_id, body.candidateId, body.notes, user_id || "system");
    return { success: true, tenant_id, data };
  }

  /** POST /hr/talent/candidates/reject — reject candidate with reason. */
  @Post("talent/candidates/reject")
  async rejectCandidate(
    @Req() request: RequestWithTenant,
    @Body() body: { candidateId?: string; reason?: string },
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    if (!body.candidateId || !body.reason) {
      throw new BadRequestException("candidateId and reason are required");
    }
    const data = await this.recruitmentService.rejectCandidate(tenant_id, body.candidateId, body.reason, user_id || "system");
    return { success: true, tenant_id, data };
  }


  /**
   * GET /hr/payroll-runs/:id/export
   * Export journal entries for approved run
   */
  @Get("payroll-runs/:id/export")
  async exportPayrollRun(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const run = await this.repository.getPayrollRunById(tenant_id, id);
    
    if (!run || run.status !== "approved") {
      res.status(400).json({ success: false, message: "Run not found or not approved." });
      return;
    }
    
    const csv = `PayrollRun,${run.id},${run.period_start},${run.period_end}\n`;
    
    await this.auditService.log({ 
      tenant_id, 
      user_id: user_id || "system", 
      module: "hr", 
      action: "EXPORT", 
      entity_type: "PAYROLL_RUN", 
      entity_id: id, 
      metadata: {} 
    });

    res.set({ 
      "Content-Type": "text/csv", 
      "Content-Disposition": `attachment; filename="payroll_${id}.csv"` 
    });
    res.end(csv);
  }

  /**
   * POST /hr/payroll-runs/:id/variance-check
   * Run variance check on a payroll run
   */
  @Post("payroll-runs/:id/variance-check")
  async varianceCheckPayrollRun(
    @Req() request: RequestWithTenant,
    @Param("id") runId: string,
  ) {
    const { tenant_id } = request.tenantContext;
    const run = await this.repository.getPayrollRunById(tenant_id, runId);
    if (!run) return { success: false, message: "Payroll run not found." };
    
    // Variance check logic refined in Phase 4
    const varianceScore = 0; 
    return { success: true, tenant_id, data: { runId, varianceScore } };
  }

  // ==================== Location Management ====================

  /**
   * GET /hr/locations
   * List all locations for the tenant
   */
  @Get("locations")
  async getLocations(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const locations = await this.hrService.getLocations(tenant_id);
    return { success: true, tenant_id, data: locations };
  }
  // ==================== Training Management ====================

  /**
   * GET /hr/training/programs
   * List all training programs
   */
  @Get("training/programs")
  async getTrainingPrograms(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const programs = await this.hrService.getTrainingPrograms(tenant_id);
    return { success: true, tenant_id, data: programs };
  }

  /**
   * POST /hr/training/programs
   * Create a training program
   */
  @Post("training/programs")
  async createTrainingProgram(
    @Req() request: RequestWithTenant,
    @Body() dto: any,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const program = await this.hrService.createTrainingProgram(tenant_id, dto, user_id!);
    return { success: true, tenant_id, data: program };
  }

  /**
   * GET /hr/training/assignments
   * List training assignments
   */
  @Get("training/assignments")
  async getTrainingAssignments(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const assignments = await this.hrService.getTrainingAssignments(tenant_id);
    return { success: true, tenant_id, data: assignments };
  }

  /**
   * POST /hr/training/assignments
   * Create a training assignment
   */
  @Post("training/assignments")
  async createTrainingAssignment(
    @Req() request: RequestWithTenant,
    @Body() dto: any,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const assignment = await this.hrService.createTrainingAssignment(tenant_id, dto, user_id!);
    return { success: true, tenant_id, data: assignment };
  }

  /**
   * PATCH /hr/training/assignments/:id
   * Update a training assignment (e.g. status)
   */
  @Patch("training/assignments/:id")
  async updateTrainingAssignment(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const assignment = await this.hrService.updateTrainingAssignment(tenant_id, id, body, user_id!);
    return { success: true, tenant_id, data: assignment };
  }

  // ==================== Analytics & Reporting ====================

  /**
   * GET /hr/analytics/workforce
   * Overall workforce metrics and turnover rates
   */
  @Get("analytics/workforce")
  async getWorkforceAnalytics(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const stats = await this.hrService.getTurnoverStats(tenant_id);
    return { success: true, tenant_id, data: stats };
  }

  /**
   * GET /hr/analytics/trends
   * Historical headcount growth trends
   */
  @Get("analytics/trends")
  async getHeadcountTrends(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const trend = await this.hrService.getHeadcountTrend(tenant_id);
    return { success: true, tenant_id, data: trend };
  }

  /**
   * GET /hr/analytics/departments
   * Department-level distribution and cost analytics
   */
  @Get("analytics/departments")
  async getDepartmentAnalytics(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const analytics = await this.hrService.getDepartmentAnalytics(tenant_id);
    return { success: true, tenant_id, data: analytics };
  }

  /**
   * GET /hr/analytics/compensation
   * Salary distribution and spend analysis
   */
  @Get("analytics/compensation")
  async getCompensationAnalytics(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const analytics = await this.hrService.getCompensationAnalytics(tenant_id);
    return { success: true, tenant_id, data: analytics };
  }

  // ==================== Recruitment & Scheduling ====================

  /**
   * GET /hr/recruitment/interviews
   * List scheduled interviews (optionally filtered by candidate)
   */
  @Get("recruitment/interviews")
  async getInterviews(
    @Req() request: RequestWithTenant,
    @Query("candidateId") candidateId?: string
  ) {
    const { tenant_id } = request.tenantContext;
    const interviews = await this.hrService.getInterviews(tenant_id, candidateId);
    return { success: true, tenant_id, data: interviews };
  }

  /**
   * POST /hr/recruitment/interviews
   * Schedule a new interview
   */
  @Post("recruitment/interviews")
  async scheduleInterview(
    @Req() request: RequestWithTenant,
    @Body() body: ScheduleInterviewDto
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const interview = await this.hrService.scheduleInterview(tenant_id, body, user_id!);
    return { success: true, tenant_id, data: interview };
  }

  /**
   * PATCH /hr/recruitment/interviews/:id/status
   * Update interview status
   */
  @Patch("recruitment/interviews/:id/status")
  async updateInterviewStatus(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() body: UpdateInterviewStatusDto
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const interview = await this.hrService.updateInterviewStatus(tenant_id, id, body.status, user_id!);
    return { success: true, tenant_id, data: interview };
  }

  // ==================== Talent Sourcing ====================

  /**
   * GET /hr/recruitment/talent-leads
   * List ingested talent leads
   */
  @Get("recruitment/talent-leads")
  async getTalentLeads(
    @Req() request: RequestWithTenant,
    @Query("status") status?: string
  ) {
    const { tenant_id } = request.tenantContext;
    const leads = await this.hrService.getTalentLeads(tenant_id, status);
    return { success: true, tenant_id, count: leads.length, data: leads };
  }

  /**
   * POST /hr/recruitment/talent-leads/ingest
   * Ingest a new lead (from LinkedIn/Extension)
   */
  @Post("recruitment/talent-leads/ingest")
  async ingestLead(
    @Req() request: RequestWithTenant,
    @Body() dto: IngestTalentLeadDto
  ) {
    const { tenant_id } = request.tenantContext;
    const lead = await this.talentSourcingService.ingestLead(tenant_id, dto);
    return { success: true, tenant_id, message: "Talent lead ingested", data: lead };
  }

  /**
   * POST /hr/recruitment/talent-leads/:id/convert
   * Convert lead to candidate in a specific requisition
   */
  @Post("recruitment/talent-leads/:id/convert")
  async convertLead(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() dto: ConvertLeadDto
  ) {
    const { tenant_id } = request.tenantContext;
    const candidate = await this.talentSourcingService.convertToCandidate(
      tenant_id,
      id,
      dto.requisitionId
    );
    return { success: true, tenant_id, message: "Lead converted to candidate", data: candidate };
  }

  // ==================== AI-Powered Global Compliance Vault ====================

  /**
   * GET /hr/compliance/documents/:employee_id
   * Fetch compliance documents for a specific employee
   */
  @Get("compliance/documents/:employee_id")
  async getComplianceDocuments(
    @Req() request: RequestWithTenant,
    @Param("employee_id") employee_id: string
  ) {
    const { tenant_id } = request.tenantContext;
    const docs = await this.repository.getComplianceDocuments(tenant_id, employee_id);
    return { success: true, tenant_id, data: docs };
  }

  /**
   * POST /hr/compliance/upload-classify
   * Upload and auto-classify document using simulation OCR
   */
  @Post("compliance/upload-classify")
  async uploadAndClassify(
    @Req() request: RequestWithTenant,
    @Body() data: { employee_id: string; fileUrl: string; fileName: string; documentType?: string }
  ) {
    const { tenant_id } = request.tenantContext;
    const doc = await this.complianceService.uploadAndClassify(tenant_id, data.employee_id, data);
    return { success: true, tenant_id, message: "Document uploaded and classified", data: doc };
  }

  /**
   * GET /hr/compliance/audit
   * Global compliance health check
   */
  @Get("compliance/audit")
  async auditCompliance(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const report = await this.complianceService.auditCompliance(tenant_id);
    return { success: true, tenant_id, data: report };
  }

  /**
   * PATCH /hr/compliance/verify/:id
   * HR Manager manual verification or rejection
   */
  @Patch("compliance/verify/:id")
  async verifyComplianceDocument(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() data: { status: 'VERIFIED' | 'REJECTED'; verified_by: string }
  ) {
    const { tenant_id } = request.tenantContext;
    const doc = await this.complianceService.verifyDocument(tenant_id, id, data.verified_by, data.status);
    return { success: true, tenant_id, message: `Document ${data.status.toLowerCase()}`, data: doc };
  }

  /**
   * POST /hr/compliance/check-expirations
   * Manually trigger expiry checks
   */
  @Post("compliance/check-expirations")
  async checkComplianceExpirations(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const expiredCount = await this.complianceService.checkExpirations(tenant_id);
    return { success: true, tenant_id, message: "Expiration check complete", expiredCount };
  }

  /**
   * POST /hr/compliance/documents/:id/ocr
   * Trigger OCR on a specific document
   */
  @Post("compliance/documents/:id/ocr")
  async triggerOcr(
    @Req() request: RequestWithTenant,
    @Param("id") id: string
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const result = await this.complianceService.triggerOcr(tenant_id, id, user_id!);
    return { success: true, tenant_id, message: "OCR processing completed", data: result };
  }

  // ==================== Predictive Workforce Analytics ====================

  /**
   * GET /hr/analytics/predictions/turnover
   * Get predicted turnover rates
   */
  @Get("analytics/predictions/turnover")
  async predictTurnover(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const prediction = await this.analyticsService.predictTurnover(tenant_id);
    return { success: true, tenant_id, data: prediction };
  }

  /**
   * GET /hr/analytics/predictions/flight-risk
   * List high flight-risk employees
   */
  @Get("analytics/predictions/flight-risk")
  async getFlightRisks(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const risks = await this.analyticsService.getFlightRisks(tenant_id);
    return { success: true, tenant_id, count: risks.length, data: risks };
  }

  /**
   * GET /hr/analytics/insights
   * Get general workforce insights and productivity risks
   */
  @Get("analytics/insights")
  async getWorkforceInsights(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const insights = await this.analyticsService.getWorkforceInsights(tenant_id);
    return { success: true, tenant_id, data: insights };
  }

  // ==================== Strategic Workforce Planner ====================

  /**
   * GET /hr/planning/scenarios
   * List budget scenarios
   */
  @Get("planning/scenarios")
  async getBudgetScenarios(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const scenarios = await this.repository.getBudgetScenarios(tenant_id);
    return { success: true, tenant_id, count: scenarios.length, data: scenarios };
  }

  /**
   * POST /hr/planning/scenarios
   * Create a new budget scenario
   */
  @Post("planning/scenarios")
  async createBudgetScenario(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateBudgetScenarioDto
  ) {
    const { tenant_id } = request.tenantContext;
    const scenario = await this.repository.createBudgetScenario(tenant_id, dto);
    return { success: true, tenant_id, message: "Budget scenario created", data: scenario };
  }

  /**
   * GET /hr/planning/scenarios/:id/plans
   * List headcount plans for a scenario
   */
  @Get("planning/scenarios/:id/plans")
  async getHeadcountPlans(
    @Req() request: RequestWithTenant,
    @Param("id") id: string
  ) {
    const { tenant_id } = request.tenantContext;
    const plans = await this.repository.getHeadcountPlans(tenant_id, id);
    return { success: true, tenant_id, count: plans.length, data: plans };
  }

  /**
   * POST /hr/planning/plans
   * Create a new headcount plan
   */
  @Post("planning/plans")
  async createHeadcountPlan(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateHeadcountPlanDto
  ) {
    const { tenant_id } = request.tenantContext;
    
    // Safety check (could be moved to service)
    const scenario = await this.repository.getBudgetScenarios(tenant_id);
    if (!scenario.find(s => s.id === dto.scenario_id)) {
      return { success: false, message: "Scenario not found or access denied" };
    }

    const plan = await this.repository.createHeadcountPlan(tenant_id, dto);
    return { success: true, tenant_id, message: "Headcount plan created", data: plan };
  }

  /**
   * GET /hr/planning/scenarios/:id/what-if
   * Comparison analysis for a scenario
   */
  @Get("planning/scenarios/:id/what-if")
  async calculateWhatIf(@Req() request: RequestWithTenant, @Param("id") id: string) {
    const { tenant_id } = request.tenantContext;
    const analysis = await this.workforcePlannerService.calculateWhatIfAnalysis(tenant_id, id);
    return { success: true, tenant_id, data: analysis };
  }

  /**
   * GET /hr/planning/scenarios/:id/projections
   * Workforce cost forecasting for a scenario
   */
  @Get("planning/scenarios/:id/projections")
  async generateProjections(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Query("months") months?: string
  ) {
    const { tenant_id } = request.tenantContext;
    const projections = await this.workforcePlannerService.generateCostProjections(
      tenant_id,
      id,
      months ? parseInt(months) : 24
    );
    return { success: true, tenant_id, data: projections };
  }

  // ==================== Global Multi-Currency Payroll ====================

  /**
   * GET /hr/payroll/exchange-rates
   * List configured exchange rates
   */
  @Get("payroll/exchange-rates")
  async getExchangeRates(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const rates = await this.repository.getExchangeRates(tenant_id);
    return { success: true, tenant_id, data: rates };
  }

  /**
   * POST /hr/payroll/exchange-rates
   * Update manual exchange rate
   */
  @Post("payroll/exchange-rates")
  async updateExchangeRate(
    @Req() request: RequestWithTenant,
    @Body() data: any
  ) {
    const { tenant_id } = request.tenantContext;
    const rate = await this.repository.createExchangeRate(tenant_id, data);
    return { success: true, tenant_id, message: "Exchange rate updated", data: rate };
  }

  /**
   * GET /hr/payroll/consolidated
   * Consolidated payroll reporting
   */
  @Get("payroll/consolidated")
  async getConsolidatedPayroll(
    @Req() request: RequestWithTenant,
    @Query("baseCurrency") baseCurrency?: string
  ) {
    const { tenant_id } = request.tenantContext;
    const report = await this.payrollConsolidationService.getConsolidatedReport(
      tenant_id,
      baseCurrency || "USD"
    );
    return { success: true, tenant_id, data: report };
  }

  // ==================== Predictive Succession Planning ====================

  /**
   * GET /hr/succession/plans
   * List critical role succession plans
   */
  @Get("succession/plans")
  async getSuccessionPlans(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const plans = await this.successionService.getPlans(tenant_id);
    return { success: true, tenant_id, data: plans };
  }

  /**
   * GET /hr/succession/plans/model/:position_id
   * Generate potential successors for a position
   */
  @Get("succession/plans/model/:position_id")
  async modelSuccession(
    @Req() request: RequestWithTenant,
    @Param("position_id") position_id: string
  ) {
    const { tenant_id } = request.tenantContext;
    const model = await this.successionService.getModelSuccession(tenant_id, position_id);
    return { success: true, tenant_id, data: model };
  }

  /**
   * POST /hr/succession/plans
   * Create a new succession plan
   */
  @Post("succession/plans")
  async createSuccessionPlan(
    @Req() request: RequestWithTenant,
    @Body() data: any
  ) {
    const { tenant_id } = request.tenantContext;
    const plan = await this.successionService.createPlan(tenant_id, data);
    return { success: true, tenant_id, message: "Succession plan created", data: plan };
  }

  /**
   * POST /hr/succession/plans/:id/candidates
   * Nominate a successor
   */
  @Post("succession/plans/:id/candidates")
  async nominateSuccessor(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() data: any
  ) {
    const { tenant_id } = request.tenantContext;
    const candidate = await this.successionService.nominateSuccessor(tenant_id, {
      ...data,
      planId: id,
    });
    return { success: true, tenant_id, message: "Successor nominated", data: candidate };
  }

  /**
   * GET /hr/succession/bench-strength
   * Regional leadership readiness view
   */
  @Get("succession/bench-strength")
  async getBenchStrength(
    @Req() request: RequestWithTenant,
    @Query("department_id") department_id?: string
  ) {
    const { tenant_id } = request.tenantContext;
    const health = await this.successionService.assessBenchStrength(tenant_id, department_id);
    return { success: true, tenant_id, data: health };
  }

  // ==================== Skills-Based Org Design ====================

  /**
   * GET /hr/skills
   * List company skill ontology
   */
  @Get("skills")
  async getSkills(
    @Req() request: RequestWithTenant,
    @Query("category") category?: string
  ) {
    const { tenant_id } = request.tenantContext;
    const skills = await this.repository.getSkills(tenant_id, category);
    return { success: true, tenant_id, count: skills.length, data: skills };
  }

  /**
   * POST /hr/skills
   * Create a new skill in the ontology
   */
  @Post("skills")
  async createSkill(
    @Req() request: RequestWithTenant,
    @Body() data: { name: string; category: string; description?: string }
  ) {
    const { tenant_id } = request.tenantContext;
    const skill = await this.repository.createSkill(tenant_id, data);
    return { success: true, tenant_id, message: "Skill created", data: skill };
  }

  /**
   * GET /hr/skills/employee/:employee_id
   * Get skill profile for a specific employee
   */
  @Get("skills/employee/:employee_id")
  async getEmployeeSkills(
    @Req() request: RequestWithTenant,
    @Param("employee_id") employee_id: string
  ) {
    const { tenant_id } = request.tenantContext;
    const skills = await this.repository.getEmployeeSkills(tenant_id, employee_id);
    return { success: true, tenant_id, count: skills.length, data: skills };
  }

  /**
   * POST /hr/skills/employee
   * Update or add employee skill proficiency
   */
  @Post("skills/employee")
  async updateEmployeeSkill(
    @Req() request: RequestWithTenant,
    @Body() data: { employee_id: string; skill_id: string; proficiency: number }
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const result = await this.skillsService.verifyProficiency(
      tenant_id,
      data.employee_id,
      data.skill_id,
      user_id!
    );
    return { success: true, tenant_id, message: "Employee skill updated", data: result };
  }

  /**
   * GET /hr/skills/marketplace
   * Talent search based on skill requirements
   */
  @Post("skills/marketplace")
  async searchTalent(
    @Req() request: RequestWithTenant,
    @Body() dto: MatchTalentDto
  ) {
    const { tenant_id } = request.tenantContext;
    const matches = await this.skillsService.mapInternalTalent(
      tenant_id,
      dto.skillIds,
      dto.minProficiency || 3
    );
    return { success: true, tenant_id, count: matches.length, data: matches };
  }

  /**
   * GET /hr/skills/employee/:id/gap-analysis
   * Analysis against a target role
   */
  @Get("skills/employee/:id/gap-analysis")
  async getSkillGap(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Query("targetRoleId") targetRoleId: string
  ) {
    const { tenant_id } = request.tenantContext;
    const analysis = await this.skillsService.calculateSkillGap(tenant_id, id, targetRoleId);
    return { success: true, tenant_id, data: analysis };
  }

  // ==================== Total Rewards & Benefits ====================

  /**
   * GET /hr/rewards/statement/:employee_id
   * Consolidated rewards summary (Salary + Benefits)
   */
  @Get("rewards/statement/:employee_id")
  async getTotalRewardsStatement(
    @Req() request: RequestWithTenant,
    @Param("employee_id") employee_id: string
  ) {
    const { tenant_id } = request.tenantContext;
    const statement = await this.totalRewardsService.calculateTotalRewards(tenant_id, employee_id);
    return { success: true, tenant_id, data: statement };
  }

  /**
   * GET /hr/rewards/benefit-plans
   * List available benefit offerings
   */
  @Get("rewards/benefit-plans")
  async getBenefitPlans(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const plans = await this.repository.getBenefitPlans(tenant_id);
    return { success: true, tenant_id, data: plans };
  }

  /**
   * POST /hr/rewards/benefit-plans
   * Create a new benefit plan
   */
  @Post("rewards/benefit-plans")
  async createBenefitPlan(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateBenefitPlanDto
  ) {
    const { tenant_id } = request.tenantContext;
    const plan = await this.repository.createBenefitPlan(tenant_id, dto);
    return { success: true, tenant_id, message: "Benefit plan created", data: plan };
  }

  /**
   * POST /hr/rewards/enroll
   * Enroll employee in a benefit plan
   */
  @Post("rewards/enroll")
  async enrollInBenefit(
    @Req() request: RequestWithTenant,
    @Body() dto: EnrollBenefitDto
  ) {
    const { tenant_id } = request.tenantContext;
    const enrollment = await this.repository.enrollInBenefit(tenant_id, dto);
    return { success: true, tenant_id, message: "Enrollment successful", data: enrollment };
  }

  // ==================== AI-Powered Career Pathing ====================

  /**
   * GET /hr/career/suggestions/:employee_id
   * AI suggestions for next role progression
   */
  @Get("career/suggestions/:employee_id")
  async getCareerSuggestions(
    @Req() request: RequestWithTenant,
    @Param("employee_id") employee_id: string
  ) {
    const { tenant_id } = request.tenantContext;
    const suggestions = await this.careerPathService.suggestNextRoles(tenant_id, employee_id);
    return { success: true, tenant_id, data: suggestions };
  }

  /**
   * GET /hr/career/mentors/:employee_id
   * Suggested internal mentors based on skill gaps
   */
  @Get("career/mentors/:employee_id")
  async getMentorSuggestions(
    @Req() request: RequestWithTenant,
    @Param("employee_id") employee_id: string
  ) {
    const { tenant_id } = request.tenantContext;
    const mentors = await this.careerPathService.findMentorMatches(tenant_id, employee_id);
    return { success: true, tenant_id, data: mentors };
  }

  /**
   * POST /hr/career/mentorship
   * Initiate a developmental pairing
   */
  @Post("career/mentorship")
  async createMentorship(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateMentorshipDto
  ) {
    const { tenant_id } = request.tenantContext;
    const pairing = await this.careerPathService.createMentorship(
      tenant_id,
      dto.mentorId,
      dto.menteeId,
      dto.focusSkills
    );
    return { success: true, tenant_id, message: "Mentorship initiated", data: pairing };
  }

  // ==================== AI-Generated Job Descriptions ====================

  /**
   * GET /hr/recruitment/position-skills/:position_id
   * List required skills for a position
   */
  @Get("recruitment/position-skills/:position_id")
  async getPositionSkills(
    @Req() request: RequestWithTenant,
    @Param("position_id") position_id: string
  ) {
    const { tenant_id } = request.tenantContext;
    const skills = await this.repository.getPositionSkills(tenant_id, position_id);
    return { success: true, tenant_id, data: skills };
  }

  /**
   * POST /hr/recruitment/position-skills
   * Add or update a required skill for a position
   */
  @Post("recruitment/position-skills")
  async updatePositionSkill(
    @Req() request: RequestWithTenant,
    @Body() data: { position_id: string; skill_id: string; minProficiency: number; isMandatory?: boolean }
  ) {
    const { tenant_id } = request.tenantContext;
    const skill = await this.repository.updatePositionSkill(tenant_id, data);
    return { success: true, tenant_id, message: "Position skill updated", data: skill };
  }

  /**
   * POST /hr/recruitment/generate-description/:position_id
   * AI-based job description generation
   */
  @Post("recruitment/generate-description/:position_id")
  async generateJobDescription(
    @Req() request: RequestWithTenant,
    @Param("position_id") position_id: string,
    @Body() dto: GenerateDescriptionDto
  ) {
    const { tenant_id } = request.tenantContext;
    const description = await this.jobDescriptionService.generateDescription(tenant_id, position_id, dto.tone);
    return { success: true, tenant_id, data: description };
  }

  /**
   * POST /hr/recruitment/publish/:position_id
   * Distribute job post to channels
   */
  @Post("recruitment/publish/:position_id")
  async publishJobPost(
    @Req() request: RequestWithTenant,
    @Param("position_id") position_id: string,
    @Body() dto: PublishJobPostDto
  ) {
    const { tenant_id } = request.tenantContext;
    const result = await this.jobDescriptionService.publishJobPost(tenant_id, position_id, dto.channels);
    return { success: true, tenant_id, message: "Job post published", data: result };
  }

  /**
   * GET /hr/recruitment/benchmarks/:position_id
   * Market alignment analysis
   */
  @Get("recruitment/benchmarks/:position_id")
  async getRecruitmentBenchmarks(
    @Req() request: RequestWithTenant,
    @Param("position_id") position_id: string
  ) {
    const { tenant_id } = request.tenantContext;
    const benchmarks = await this.jobDescriptionService.analyzeMarketAlignment(tenant_id, position_id);
    return { success: true, tenant_id, data: benchmarks };
  }

  // ==================== AI-Powered Performance Predictor ====================

  /**
   * GET /hr/performance/forecast/:employee_id
   * AI-based performance rating forecast
   */
  @Get("performance/forecast/:employee_id")
  async forecastPerformance(
    @Req() request: RequestWithTenant,
    @Param("employee_id") employee_id: string
  ) {
    const { tenant_id } = request.tenantContext;
    const forecast = await this.performancePredictorService.forecastPerformance(tenant_id, employee_id);
    return { success: true, tenant_id, data: forecast };
  }

  /**
   * GET /hr/performance/goal-probability/:goalId
   * probability of completing a goal on time
   */
  @Get("performance/goal-probability/:goalId")
  async getGoalProbability(
    @Req() request: RequestWithTenant,
    @Param("goalId") goalId: string
  ) {
    const { tenant_id } = request.tenantContext;
    const probability = await this.performancePredictorService.calculateGoalProbability(tenant_id, goalId);
    return { success: true, tenant_id, data: probability };
  }

  /**
   * GET /hr/performance/interventions/:employee_id
   * AI-recommended performance corrections
   */
  @Get("performance/interventions/:employee_id")
  async getPerformanceInterventions(
    @Req() request: RequestWithTenant,
    @Param("employee_id") employee_id: string
  ) {
    const { tenant_id } = request.tenantContext;
    const interventions = await this.performancePredictorService.recommendInterventions(tenant_id, employee_id);
    return { success: true, tenant_id, data: interventions };
  }

  /**
   * GET /hr/performance/goals/:employee_id
   * List employee performance goals
   */
  @Get("performance/goals/:employee_id")
  async getEmployeeGoals(
    @Req() request: RequestWithTenant,
    @Param("employee_id") employee_id: string
  ) {
    const { tenant_id } = request.tenantContext;
    const goals = await this.repository.getEmployeeGoals(tenant_id, employee_id);
    return { success: true, tenant_id, data: goals };
  }

  /**
   * POST /hr/performance/goals
   * Create or update a performance goal
   */
  @Post("performance/goals")
  async updatePerformanceGoal(
    @Req() request: RequestWithTenant,
    @Body() dto: UpdatePerformanceGoalDto
  ) {
    const { tenant_id } = request.tenantContext;
    const goal = await this.repository.updatePerformanceGoal(tenant_id, dto);
    return { success: true, tenant_id, message: "Goal updated", data: goal };
  }

  // ==================== AI-Powered Learning Path Personalization ====================

  /**
   * GET /hr/learning/recommendations/:employee_id
   * Personalized course suggestions based on skill gaps
   */
  @Get("learning/recommendations/:employee_id")
  async getLearningRecommendations(
    @Req() request: RequestWithTenant,
    @Param("employee_id") employee_id: string
  ) {
    const { tenant_id } = request.tenantContext;
    const recommendations = await this.learningService.recommendLearningPath(tenant_id, employee_id);
    return { success: true, tenant_id, data: recommendations };
  }

  /**
   * POST /hr/learning/enroll
   * Enroll employee in a training program
   */
  @Post("learning/enroll")
  async enrollInLearningProgram(
    @Req() request: RequestWithTenant,
    @Body() dto: EnrollTrainingDto
  ) {
    const { tenant_id } = request.tenantContext;
    const enrollment = await this.repository.enrollInTrainingProgram(tenant_id, dto.employee_id, dto.programId);
    return { success: true, tenant_id, message: "Enrolled in training program", data: enrollment };
  }

  /**
   * POST /hr/learning/auto-enroll-gaps/:employee_id
   * Auto-enroll in mandatory gap-filler courses
   */
  @Post("learning/auto-enroll-gaps/:employee_id")
  async autoEnrollGaps(
    @Req() request: RequestWithTenant,
    @Param("employee_id") employee_id: string
  ) {
    const { tenant_id } = request.tenantContext;
    const enrollments = await this.learningService.autoEnrollInGapFillers(tenant_id, employee_id);
    return { success: true, tenant_id, message: `Auto-enrolled in ${enrollments.length} programs`, data: enrollments };
  }

  /**
   * GET /hr/learning/roi/:employee_id
   * Impact analysis of completed training
   */
  @Get("learning/roi/:employee_id")
  async getLearningROI(
    @Req() request: RequestWithTenant,
    @Param("employee_id") employee_id: string
  ) {
    const { tenant_id } = request.tenantContext;
    const roi = await this.learningService.calculateLearningROI(tenant_id, employee_id);
    return { success: true, tenant_id, data: roi };
  }

  // ==================== Strategic Global Workforce Explorer & Talent Mobility ====================

  /**
   * GET /hr/strategic/mobility/:employee_id
   * Assess employee readiness for cross-departmental or regional transition
   */
  @Get("strategic/mobility/:employee_id")
  async assessMobility(
    @Req() request: RequestWithTenant,
    @Param("employee_id") employee_id: string,
    @Query("targetDeptId") targetDeptId: string
  ) {
    const { tenant_id } = request.tenantContext;
    const assessment = await this.workforcePlannerService.assessTalentMobility(tenant_id, employee_id, targetDeptId);
    return { success: true, tenant_id, data: assessment };
  }

  /**
   * GET /hr/strategic/explorer/headcount
   * Context-aware headcount analysis for HR Admins
   */
  @Get("strategic/explorer/headcount")
  async getStrategicHeadcount(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const metrics = await this.repository.getStrategicHeadcount(tenant_id);
    return { success: true, tenant_id, metrics };
  }

  /**
   * GET /hr/strategic/explorer/growth
   * Workforce dynamics reporting (Hires, Exits, Transfers)
   */
  @Get("strategic/explorer/growth")
  async getWorkforceDynamics(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const dynamics = await this.workforcePlannerService.getGlobalWorkforceDynamics(tenant_id);
    return { success: true, tenant_id, data: dynamics };
  }

  /**
   * GET /hr/learning/history/:employee_id
   * employee training history
   */
  @Get("learning/history/:employee_id")
  async getEmployeeLearningHistory(
    @Req() request: RequestWithTenant,
    @Param("employee_id") employee_id: string
  ) {
    const { tenant_id } = request.tenantContext;
    const history = await this.repository.getEmployeeTrainingHistory(tenant_id, employee_id);
    return { success: true, tenant_id, data: history };
  }

  // ==================== Predictive Labor Cost Modeling ====================

  /**
   * GET /hr/finance/labor-projection/:deptId
   * Forecast labor costs over N periods
   */
  @Get("finance/labor-projection/:deptId")
  async projectLaborCosts(
    @Req() request: RequestWithTenant,
    @Param("deptId") department_id: string,
    @Query("periods") periods: string = "12"
  ) {
    const { tenant_id } = request.tenantContext;
    const projection = await this.laborCostService.projectLaborCosts(tenant_id, department_id, parseInt(periods));
    return { success: true, tenant_id, data: projection };
  }

  /**
   * GET /hr/finance/budget-variance/:deptId
   * Identify potential departmental budget overruns
   */
  @Get("finance/budget-variance/:deptId")
  async getBudgetVariance(
    @Req() request: RequestWithTenant,
    @Param("deptId") department_id: string
  ) {
    const { tenant_id } = request.tenantContext;
    const variance = await this.laborCostService.getBudgetVarianceForecast(tenant_id, department_id);
    return { success: true, tenant_id, data: variance };
  }

  /**
   * POST /hr/finance/simulate-inflation
   * Model global impact of benefit/tax inflation
   */
  @Post("finance/simulate-inflation")
  async simulateInflation(
    @Req() request: RequestWithTenant,
    @Body() dto: SimulateInflationDto
  ) {
    const { tenant_id } = request.tenantContext;
    const simulation = await this.laborCostService.simulateInflationImpact(tenant_id, dto.inflationRate);
    return { success: true, tenant_id, data: simulation };
  }

  // ==================== Compliance Engine ====================

  /**
   * POST /hr/compliance/calculate
   * Run a compliance calculation for a specific module and period.
   * Body: { module: 'BPJS_KESEHATAN'|'BPJS_KETENAGAKERJAAN'|'PPH21'|'CPF'|'WPS', period: 'YYYY-MM' }
   */
  @Post("compliance/calculate")
  async runComplianceCalculation(
    @Req() request: RequestWithTenant,
    @Body() dto: { module: string; period: string }
  ) {
    const { tenant_id } = request.tenantContext;
    const result = await this.complianceEngineService.calculate(tenant_id, dto.module, dto.period);
    return { success: true, tenant_id, data: result };
  }

  /**
   * POST /hr/compliance/export
   * Export a compliance report in the specified format.
   * Body: { module: string; period: string; format: 'CSV'|'EXCEL'|'XML'|'PDF' }
   * CSV/XML are returned as text; EXCEL/PDF are returned as base64.
   */
  @Post("compliance/export")
  async exportComplianceReport(
    @Req() request: RequestWithTenant,
    @Body() dto: { module: string; period: string; format: 'CSV' | 'EXCEL' | 'XML' | 'PDF' }
  ) {
    const { tenant_id } = request.tenantContext;
    const result = await this.complianceEngineService.calculate(tenant_id, dto.module, dto.period);
    const exported = this.complianceEngineService.export(dto.format, result);
    if (dto.format === 'CSV' || dto.format === 'XML') {
      return { success: true, tenant_id, format: dto.format, data: exported };
    }
    return {
      success: true,
      tenant_id,
      format: dto.format,
      data: (exported as Buffer).toString('base64'),
    };
  }

  /**
   * POST /hr/compliance/calculate-all
   * Run all compliance modules for a given country in one call.
   * Body: { country: 'ID'|'SG'|'AE', period: 'YYYY-MM' }
   */
  @Post("compliance/calculate-all")
  async runAllComplianceModules(
    @Req() request: RequestWithTenant,
    @Body() dto: { country: string; period: string }
  ) {
    const { tenant_id } = request.tenantContext;
    const results = await this.complianceEngineService.calculateAll(tenant_id, dto.country, dto.period);
    return { success: true, tenant_id, country: dto.country, results };
  }

  /**
   * GET /hr/compliance/modules/:country
   * List all available compliance modules for the given country.
   */
  @Get("compliance/modules/:country")
  getComplianceModules(
    @Param("country") country: string
  ) {
    const modules = this.complianceEngineService.getAvailableModules(country.toUpperCase());
    return { success: true, country: country.toUpperCase(), modules };
  }

  /**
   * GET /hr/compliance/ai-suggestions
   * AI-powered compliance module suggestions based on company registration
   */
  @Get('compliance/ai-suggestions')
  async getComplianceSuggestions(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const suggestions = await this.complianceSuggestionService.generateSuggestions(tenant_id);
    return { success: true, tenant_id, data: suggestions };
  }
}

