import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  UseInterceptors,
  Req,
  Query,
} from "@nestjs/common";
import { Request } from "express";
import { RetailInfrastructureService } from "./retail-infrastructure.service";
import { TenantInterceptor } from "../../gateway/tenant.interceptor";
import { TenantContext } from "../../gateway/tenant-context.interface";
import { CacheInterceptor, CacheTTL } from '../../shared/cache';

interface RequestWithTenant extends Request {
  tenantContext: TenantContext;
}

@Controller('retail/infrastructure')
@UseInterceptors(TenantInterceptor)
export class RetailInfrastructureController {
  constructor(private readonly infraService: RetailInfrastructureService) {}

  @Get("nodes")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async listNodes(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    return this.infraService.listGatewayNodes(tenant_id);
  }

  @Put("nodes/:id/status")
  async setNodeStatus(
    @Req() request: RequestWithTenant,
    @Param("id") nodeId: string,
    @Body("status") status: "ACTIVE" | "STANDBY" | "DOWN",
  ) {
    const { tenant_id } = request.tenantContext;
    return this.infraService.setNodeStatus(tenant_id, nodeId, status);
  }

  @Get("load-balancers")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async listLoadBalancers(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    return this.infraService.listLoadBalancers(tenant_id);
  }

  @Post("load-balancers")
  async createLoadBalancer(
    @Req() request: RequestWithTenant,
    @Body() data: any,
  ) {
    const { tenant_id } = request.tenantContext;
    return this.infraService.createLoadBalancer(tenant_id, data);
  }

  @Put("load-balancers/:id")
  async updateLoadBalancer(
    @Req() request: RequestWithTenant,
    @Param("id") lbId: string,
    @Body() data: any,
  ) {
    const { tenant_id } = request.tenantContext;
    return this.infraService.updateLoadBalancer(tenant_id, lbId, data);
  }

  @Post("heartbeat")
  async reportHeartbeat(
    @Req() request: RequestWithTenant,
    @Body()
    data: {
      deviceId: string;
      component: string;
      status: string;
      metrics?: any;
    },
  ) {
    const { tenant_id } = request.tenantContext;
    try {
      console.log(`[INFRA_CTRL] Heartbeat received for ${data.deviceId} (Tenant: ${tenant_id})`);
      await this.infraService.recordHeartbeat(
        tenant_id,
        data.deviceId,
        data.component,
        data.status,
        data.metrics,
      );
      return { success: true };
    } catch (error) {
      console.error(`[INFRA_CTRL] Heartbeat error for ${data.deviceId}:`, error);
      throw error;
    }
  }
}

