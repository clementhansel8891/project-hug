import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseInterceptors,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Request } from "express";
import { EcommerceHubService } from "./ecommerce-hub.service";
import {
  CreateEcommerceConnectorDto,
  UpdateEcommerceConnectorDto,
  CreateRetailChannelDto,
  UpdateRetailChannelDto,
} from "./dto/ecommerce-hub.dto";
import { RegisterEcommerceBranchDto } from "./dto/retail.dto";
import { TenantInterceptor } from "../../gateway/tenant.interceptor";
import { TenantContext } from "../../gateway/tenant-context.interface";
import { CacheInterceptor, CacheTTL } from '../../shared/cache';

interface RequestWithTenant extends Request {
  tenantContext: TenantContext;
}

@Controller('retail/ecommerce-hub')
@UseInterceptors(TenantInterceptor)
export class EcommerceHubController {
  constructor(private readonly hubService: EcommerceHubService) {}

  private ok<T>(tenant_id: string, data: T) {
    return { success: true, tenant_id, data };
  }

  // ════════════════════════════════════════════════
  // Unified E-Commerce Branch Registration
  // ════════════════════════════════════════════════

  /**
   * Single unified entry point: register e-commerce presence AS a virtual branch
   * (`RetailStore` with `type: "ecommerce"`) inside the branch hierarchy, optionally
   * binding a sales channel. Supersedes the standalone connector/channel creation paths
   * for new e-commerce onboarding.
   */
  @Post("register-branch")
  @HttpCode(HttpStatus.CREATED)
  async registerEcommerceBranch(
    @Req() req: RequestWithTenant,
    @Body() dto: RegisterEcommerceBranchDto,
  ) {
    const { tenant_id, user_id } = req.tenantContext;
    const data = await this.hubService.registerEcommerceBranch(
      req.tenantContext,
      dto,
      user_id,
    );
    return this.ok(tenant_id, data);
  }

  // ════════════════════════════════════════════════
  // EcommerceConnector endpoints (API-key based)
  // ════════════════════════════════════════════════

  @Get("connectors")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async listConnectors(@Req() req: RequestWithTenant) {
    const { tenant_id } = req.tenantContext;
    const data = await this.hubService.listConnectors(tenant_id);
    return this.ok(tenant_id, data);
  }

  @Post("connectors")
  async createConnector(
    @Req() req: RequestWithTenant,
    @Body() dto: CreateEcommerceConnectorDto,
  ) {
    const { tenant_id, user_id } = req.tenantContext;
    const result = await this.hubService.createConnector(tenant_id, dto, user_id);
    return this.ok(tenant_id, {
      connector: result.connector,
      plainApiKey: result.plainApiKey,
      warning: "Store the plainApiKey securely — it will NOT be shown again.",
    });
  }

  @Get("connectors/:id")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getConnector(@Req() req: RequestWithTenant, @Param("id") id: string) {
    const { tenant_id } = req.tenantContext;
    const data = await this.hubService.getConnector(tenant_id, id);
    return this.ok(tenant_id, data);
  }

  @Put("connectors/:id")
  async updateConnector(
    @Req() req: RequestWithTenant,
    @Param("id") id: string,
    @Body() dto: UpdateEcommerceConnectorDto,
  ) {
    const { tenant_id, user_id } = req.tenantContext;
    const data = await this.hubService.updateConnector(
      tenant_id,
      id,
      dto,
      user_id,
    );
    return this.ok(tenant_id, data);
  }

  @Delete("connectors/:id")
  async deleteConnector(
    @Req() req: RequestWithTenant,
    @Param("id") id: string,
  ) {
    const { tenant_id, user_id } = req.tenantContext;
    const data = await this.hubService.deleteConnector(tenant_id, id, user_id);
    return this.ok(tenant_id, data);
  }

  @Post("connectors/:id/rotate-key")
  @HttpCode(HttpStatus.OK)
  async rotateConnectorKey(
    @Req() req: RequestWithTenant,
    @Param("id") id: string,
  ) {
    const { tenant_id, user_id } = req.tenantContext;
    const result = await this.hubService.rotateConnectorApiKey(
      tenant_id,
      id,
      user_id,
    );
    return this.ok(tenant_id, {
      ...result,
      warning:
        "Store the new plainApiKey securely — it will NOT be shown again.",
    });
  }

  @Post("connectors/:id/test")
  @HttpCode(HttpStatus.OK)
  async testConnector(@Req() req: RequestWithTenant, @Param("id") id: string) {
    const { tenant_id } = req.tenantContext;
    const result = await this.hubService.testConnector(tenant_id, id);
    return this.ok(tenant_id, result);
  }

  // ════════════════════════════════════════════════
  // RetailChannel endpoints (clientId/secret based)
  // ════════════════════════════════════════════════

  @Get("channels")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async listChannels(@Req() req: RequestWithTenant) {
    const { tenant_id } = req.tenantContext;
    const data = await this.hubService.listChannels(tenant_id);
    // Strip clientSecretHash from response
    return this.ok(tenant_id, data.map(safeChannel));
  }

  @Post("channels")
  async createChannel(
    @Req() req: RequestWithTenant,
    @Body() dto: CreateRetailChannelDto,
  ) {
    const { tenant_id, user_id } = req.tenantContext;
    const result = await this.hubService.createChannel(tenant_id, dto, user_id);
    return this.ok(tenant_id, {
      channel: safeChannel(result.channel),
      plainClientId: result.plainClientId,
      plainClientSecret: result.plainClientSecret,
      warning:
        "Store clientId and clientSecret securely — they will NOT be shown again.",
    });
  }

  @Get("channels/:id")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getChannel(@Req() req: RequestWithTenant, @Param("id") id: string) {
    const { tenant_id } = req.tenantContext;
    const data = await this.hubService.getChannel(tenant_id, id);
    return this.ok(tenant_id, safeChannel(data));
  }

  @Put("channels/:id")
  async updateChannel(
    @Req() req: RequestWithTenant,
    @Param("id") id: string,
    @Body() dto: UpdateRetailChannelDto,
  ) {
    const { tenant_id, user_id } = req.tenantContext;
    const data = await this.hubService.updateChannel(tenant_id, id, dto, user_id);
    return this.ok(tenant_id, safeChannel(data));
  }

  @Delete("channels/:id")
  async deleteChannel(@Req() req: RequestWithTenant, @Param("id") id: string) {
    const { tenant_id, user_id } = req.tenantContext;
    const data = await this.hubService.deleteChannel(tenant_id, id, user_id);
    return this.ok(tenant_id, data);
  }

  @Post("channels/:id/rotate-credentials")
  @HttpCode(HttpStatus.OK)
  async rotateChannelCredentials(
    @Req() req: RequestWithTenant,
    @Param("id") id: string,
  ) {
    const { tenant_id, user_id } = req.tenantContext;
    const result = await this.hubService.rotateChannelCredentials(
      tenant_id,
      id,
      user_id,
    );
    return this.ok(tenant_id, {
      ...result,
      warning:
        "Store clientId and clientSecret securely — they will NOT be shown again.",
    });
  }

  @Post("channels/:id/revoke-credentials")
  @HttpCode(HttpStatus.OK)
  async revokeChannelCredentials(
    @Req() req: RequestWithTenant,
    @Param("id") id: string,
  ) {
    const { tenant_id, user_id } = req.tenantContext;
    const data = await this.hubService.revokeChannelCredentials(
      tenant_id,
      id,
      user_id,
    );
    return this.ok(tenant_id, data);
  }

  // ── Channel Product Management ─────────────────────────────

  @Get("channels/:id/products")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async listChannelProducts(
    @Req() req: RequestWithTenant,
    @Param("id") id: string,
  ) {
    const { tenant_id } = req.tenantContext;
    const data = await this.hubService.listChannelProducts(tenant_id, id);
    return this.ok(tenant_id, data);
  }

  @Put("channels/:id/products")
  async updateChannelProducts(
    @Req() req: RequestWithTenant,
    @Param("id") id: string,
    @Body() body: { updates: any[] },
  ) {
    const { tenant_id, user_id } = req.tenantContext;
    await this.hubService.updateChannelProducts(
      tenant_id,
      id,
      body.updates,
      user_id,
    );
    return this.ok(tenant_id, { success: true });
  }

  @Get("channels/:id/categories")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getChannelCategories(
    @Req() req: RequestWithTenant,
    @Param("id") id: string,
  ) {
    const { tenant_id } = req.tenantContext;
    const data = await this.hubService.getChannelCategories(tenant_id, id);
    return this.ok(tenant_id, data);
  }

  @Put("channels/:id/categories")
  async updateChannelCategories(
    @Req() req: RequestWithTenant,
    @Param("id") id: string,
    @Body() body: { categories: string[] },
  ) {
    const { tenant_id, user_id } = req.tenantContext;
    await this.hubService.updateChannelCategories(
      tenant_id,
      id,
      body.categories,
      user_id,
    );
    return this.ok(tenant_id, { success: true });
  }
}

/** Strip the raw clientSecretHash from credential JSON before sending to client. */
function safeChannel(channel: any) {
  const { credentials, ...rest } = channel;
  const safeCreds = credentials
    ? (() => {
        const { clientSecretHash: _stripped, ...safeRest } = credentials as any;
        return safeRest;
      })()
    : null;
  return { ...rest, credentials: safeCreds };
}

