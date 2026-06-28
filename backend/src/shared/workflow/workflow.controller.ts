import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseInterceptors,
  UseGuards,
} from "@nestjs/common";
import { WorkflowService } from "./workflow.service";
import { TenantInterceptor } from "../../gateway/tenant.interceptor";
import { TenantGuard } from "../guards/tenant.guard";
import { Request } from "express";
import { TenantContext } from "../../gateway/tenant-context.interface";
import { PaginationPipe, PaginationParams } from "../pipes/pagination.pipe";
import { CacheInterceptor, CacheTTL, CacheInvalidationHelper } from "../cache";

interface RequestWithTenant extends Request {
  tenantContext: TenantContext;
}

@Controller('workflow')
// @UseInterceptors(TenantInterceptor)
// @UseGuards(TenantGuard)
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly cacheHelper: CacheInvalidationHelper,
  ) {
    console.log("WorkflowController initialized with path: zenvix-workflow");
  }

  @Get("test-routing")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  test() {
    console.log("Workflow test-routing hit!");
    return { status: "ok", message: "Workflow routing is working" };
  }

  @Get("list")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async listRequests(
    @Req() request: RequestWithTenant,
    @Query(PaginationPipe) pagination: PaginationParams,
  ) {
    const { tenant_id } = request.tenantContext;
    return this.workflowService.listAll(tenant_id, pagination);
  }

  @Post("request")
  async createRequest(
    @Req() request: RequestWithTenant,
    @Body()
    body: {
      entity_type: string;
      entity_id: string;
      maker_dept: string;
      destination_dept: string;
      notes?: string;
      metadata?: any;
    },
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const result = await this.workflowService.createRequest({
      tenant_id,
      ...body,
      requested_by: user_id || "system",
    });
    await this.cacheHelper.invalidateAll();
    return result;
  }

  @Get("inbox")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getInbox(
    @Req() request: RequestWithTenant,
    @Query("dept") dept: string,
    @Query(PaginationPipe) pagination: PaginationParams,
  ) {
    const { tenant_id } = request.tenantContext;
    return this.workflowService.listInbox(tenant_id, dept, pagination);
  }

  @Post(":id/approve")
  async approveRequest(
    @Param("id") id: string,
    @Req() request: RequestWithTenant,
    @Body("notes") notes?: string,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const result = await this.workflowService.approveRequest(tenant_id, id, user_id || "system", notes);
    await this.cacheHelper.invalidateAll();
    return result;
  }

  @Post(":id/reject")
  async rejectRequest(
    @Param("id") id: string,
    @Req() request: RequestWithTenant,
    @Body("notes") notes?: string,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const result = await this.workflowService.rejectRequest(tenant_id, id, user_id || "system", notes);
    await this.cacheHelper.invalidateAll();
    return result;
  }
}
