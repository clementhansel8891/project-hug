import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  Res,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request, Response } from "express";
import { SchedulingService } from "../scheduling.service";
import { Roles } from "../../../shared/decorators/roles.decorator";
import { RolesGuard } from "../../../shared/guards/roles.guard";
import { TenantGuard } from "../../../shared/guards/tenant.guard";
import { UserRole } from "../../../shared/roles";
import { TenantInterceptor } from "../../../gateway/tenant.interceptor";
import { TenantContext } from "../../../gateway/tenant-context.interface";
import { ModuleStateGuard } from "../../auth/guards/module-state.guard";
import { TenantScopeResolver } from "../scope/tenant-scope.resolver";
import { CreateWorkScheduleDto, CreateWorkShiftDto, UpdateWorkScheduleDto, UpdateWorkShiftDto } from "../dto";

interface RequestWithTenant extends Request {
  tenantContext: TenantContext;
}

/**
 * HR Scheduling Controller
 *
 * Identity and scope are derived exclusively from the verified
 * `request.tenantContext` (populated by `TenantInterceptor` after the
 * JWT-bearing tenant middleware), never from client-supplied `x-tenant-id`
 * headers (Requirements 2.1, 2.2, 2.3). Each request resolves a validated
 * `TenantScope` via the shared `TenantScopeResolver`, and every mutating
 * schedule/shift endpoint carries a `@Roles(...)` gate (Requirements 3.1,
 * 3.2, 3.4).
 *
 * NOTE: `SchedulingService` method signatures still take `tenant_id` as their
 * first argument; this task only migrates the controller's identity/scope
 * sourcing, so the resolved `scope.tenant_id` (and `scope.location_id` for
 * location-filtered reads) is passed through unchanged. Service-internal bug
 * fixes are deferred to Phase 2 tasks 4.2/4.3.
 */
@Controller('hr/scheduling')
@UseInterceptors(TenantInterceptor)
@UseGuards(ModuleStateGuard, TenantGuard, RolesGuard)
export class HrSchedulingController {
  constructor(
    private readonly schedulingService: SchedulingService,
    private readonly scopeResolver: TenantScopeResolver,
  ) {}

  @Get("schedules")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getSchedules(
    @Req() request: RequestWithTenant,
    @Query("location_id") location_id?: string,
    @Query("status") status?: string,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext, {
      location_id,
    });
    return this.schedulingService.getWorkSchedules(
      scope.tenant_id,
      scope.location_id,
    );
  }

  @Post("schedules")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async createSchedule(
    @Req() request: RequestWithTenant,
    @Body() data: CreateWorkScheduleDto,
  ) {
    const user_id = request.tenantContext.user_id ?? "system";
    const scope = await this.scopeResolver.resolve(request.tenantContext, {
      location_id: data.location_id,
    });
    return this.schedulingService.createWorkSchedule(
      scope.tenant_id,
      data,
      user_id,
    );
  }

  @Post("schedules/:id/approve")
  @Roles(UserRole.ADMIN) // Only Admin can approve
  async approveSchedule(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
  ) {
    const user_id = request.tenantContext.user_id ?? "system";
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    return this.schedulingService.approveSchedule(scope.tenant_id, id, user_id);
  }

  @Get("shifts")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async getShifts(
    @Req() request: RequestWithTenant,
    @Query("schedule_id") schedule_id?: string,
    @Query("employee_id") employee_id?: string,
    @Query("projection") projection?: string,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    // `?projection=scheduled` returns the `ScheduledShift[]` consumer projection
    // consumed by the Retail `ShiftControl` grid (Requirements 7.7, 7.8, 1.6).
    // The default response preserves the raw work-shift shape for other callers.
    if (projection === "scheduled") {
      return this.schedulingService.getScheduledShifts(
        scope.tenant_id,
        schedule_id,
        employee_id,
      );
    }
    return this.schedulingService.getWorkShifts(
      scope.tenant_id,
      schedule_id,
      employee_id,
    );
  }

  @Post("shifts")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async createShift(
    @Req() request: RequestWithTenant,
    @Body() data: CreateWorkShiftDto,
  ) {
    const user_id = request.tenantContext.user_id ?? "system";
    const scope = await this.scopeResolver.resolve(request.tenantContext, {
      location_id: (data as { location_id?: string }).location_id,
    });
    return this.schedulingService.createWorkShift(
      scope.tenant_id,
      data,
      user_id,
    );
  }

  @Patch("schedules/:id")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async updateSchedule(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() data: UpdateWorkScheduleDto,
  ) {
    const user_id = request.tenantContext.user_id ?? "system";
    const scope = await this.scopeResolver.resolve(request.tenantContext, {
      location_id: data.location_id,
    });
    return this.schedulingService.updateWorkSchedule(
      scope.tenant_id,
      id,
      data,
      user_id,
    );
  }

  @Patch("shifts/:id")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async updateShift(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() data: UpdateWorkShiftDto,
  ) {
    const user_id = request.tenantContext.user_id ?? "system";
    const scope = await this.scopeResolver.resolve(request.tenantContext, {
      location_id: (data as { location_id?: string }).location_id,
    });
    return this.schedulingService.updateWorkShift(
      scope.tenant_id,
      id,
      data,
      user_id,
    );
  }

  // --- Overrides & Swaps ---

  @Get("overrides")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getOverrides(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    return this.schedulingService.listOverrides(scope.tenant_id);
  }

  @Post("overrides")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async saveOverride(
    @Req() request: RequestWithTenant,
    @Body() data: any,
  ) {
    const user_id = request.tenantContext.user_id ?? "system";
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    return this.schedulingService.saveOverride(scope.tenant_id, data, user_id);
  }

  @Get("swaps")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async getSwaps(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    return this.schedulingService.listSwaps(scope.tenant_id);
  }

  @Post("swaps")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async saveSwap(
    @Req() request: RequestWithTenant,
    @Body() data: any,
  ) {
    const user_id = request.tenantContext.user_id ?? "system";
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    return this.schedulingService.saveSwapRequest(
      scope.tenant_id,
      data,
      user_id,
    );
  }

  @Get("master-shifts")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async getMasterShifts(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    return this.schedulingService.listAllShifts(scope.tenant_id);
  }

  @Get("assignments")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async getAssignments(
    @Req() request: RequestWithTenant,
    @Query("employeeId") employee_id?: string,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    return this.schedulingService.listAllAssignments(
      scope.tenant_id,
      employee_id,
    );
  }

  @Post("assignments")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async createAssignment(
    @Req() request: RequestWithTenant,
    @Body() data: { employeeId?: string; shiftTemplateId?: string; shift_id?: string; date?: string; effective_date?: string; notes?: string },
  ) {
    const user_id = request.tenantContext.user_id ?? "system";
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    return this.schedulingService.createAssignment(
      scope.tenant_id,
      {
        employee_id: data.employeeId ?? "",
        shift_id: data.shiftTemplateId ?? data.shift_id ?? "",
        effective_date: data.date ?? data.effective_date ?? "",
        notes: data.notes,
      },
      user_id,
    );
  }

  // --- Bulk schedule import (xlsx/csv) ---

  @Get("assignments/template")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async downloadAssignmentTemplate(
    @Req() request: RequestWithTenant,
    @Res() res: Response,
  ) {
    await this.scopeResolver.resolve(request.tenantContext);
    const buffer = await this.schedulingService.generateAssignmentTemplate();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=schedule_import_template.xlsx",
    );
    res.send(buffer);
  }

  @Post("assignments/import")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(FileInterceptor("file"))
  async importAssignments(
    @Req() request: RequestWithTenant,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const user_id = request.tenantContext.user_id ?? "system";
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    if (!file) {
      throw new BadRequestException("A file is required (multipart field 'file')");
    }
    const result = await this.schedulingService.importAssignments(
      scope.tenant_id,
      file.buffer,
      file.originalname,
      user_id,
    );
    return { success: true, tenant_id: scope.tenant_id, ...result };
  }
}
