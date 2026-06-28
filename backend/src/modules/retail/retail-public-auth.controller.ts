import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Request } from "express";
import { TenantInterceptor } from "../../gateway/tenant.interceptor";
import { RetailPublicAuthService } from "./retail-public-auth.service";
import { ChannelCredentialsGuard } from "./guards/channel-credentials.guard";
import { CustomerAuthGuard } from "./guards/customer-auth.guard";
import { CacheInterceptor, CacheTTL } from '../../shared/cache';

@Controller('retail/public/auth')
@UseInterceptors(TenantInterceptor)
export class RetailPublicAuthController {
  constructor(private readonly authService: RetailPublicAuthService) {}

  private toPublicCustomer(customer: any) {
    return {
      id: customer.id,
      tenant_id: customer.tenant_id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      tier: customer.tier,
      points: customer.points,
      created_at: customer.created_at?.toISOString?.() ?? customer.created_at,
      updated_at: customer.updated_at?.toISOString?.() ?? customer.updated_at,
    };
  }

  @Post("register")
  @UseGuards(ChannelCredentialsGuard)
  async register(@Req() request: Request, @Body() body: any) {
    const { tenant_id } = (request as any).tenantContext;
    const scope = (request as any).connectorScope;
    const { name, email, password, phone } = body ?? {};
    if (!name || !email || !password) {
      throw new BadRequestException("name, email, and password are required");
    }

    const result: { customer: any; tokens: any } = await this.authService.registerCustomer(
      (request as any).tenantContext,
      { name, email, password, phone },
      { ip: request.ip, user_agent: request.headers["user-agent"] ?? null },
    );

    return {
      success: true,
      data: {
        customer: this.toPublicCustomer(result.customer),
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        refreshExpiresAt: result.tokens.expires_at,
      },
    };
  }

  @Post("login")
  @UseGuards(ChannelCredentialsGuard)
  async login(@Req() request: Request, @Body() body: any) {
    const { tenant_id } = (request as any).tenantContext;
    const scope = (request as any).connectorScope;
    const { email, password } = body ?? {};
    if (!email || !password) {
      throw new BadRequestException("email and password are required");
    }

    const result: { customer: any; tokens: any } = await this.authService.loginCustomer(
      (request as any).tenantContext,
      scope,
      { email, password },
      { ip: request.ip, user_agent: request.headers["user-agent"] ?? null },
    );

    return {
      success: true,
      data: {
        customer: this.toPublicCustomer(result.customer),
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        refreshExpiresAt: result.tokens.expires_at,
      },
    };
  }

  @Post("refresh")
  @UseGuards(ChannelCredentialsGuard)
  async refresh(
    @Req() request: Request,
    @Body() body: any,
    @Headers("x-refresh-token") headerToken?: string,
  ) {
    const { tenant_id } = (request as any).tenantContext;
    const scope = (request as any).connectorScope;
    const refreshToken = body?.refreshToken ?? headerToken;
    if (!refreshToken) {
      throw new BadRequestException("refreshToken is required");
    }

    const result = await this.authService.refreshTokens(
      (request as any).tenantContext,
      scope,
      refreshToken,
      { ip: request.ip, user_agent: request.headers["user-agent"] ?? null },
    );

    return {
      success: true,
      data: {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        refreshExpiresAt: result.tokens.expires_at,
      },
    };
  }

  @Post("logout")
  @UseGuards(ChannelCredentialsGuard)
  async logout(
    @Body() body: any,
    @Headers("x-refresh-token") headerToken?: string,
  ) {
    const refreshToken = body?.refreshToken ?? headerToken;
    const result = await this.authService.logout(refreshToken);
    return { success: true, data: result };
  }

  @Get("me")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  @UseGuards(ChannelCredentialsGuard, CustomerAuthGuard)
  async me(@Req() request: Request) {
    const payload = (request as any).customerAuth;
    const customer = await this.authService.getCustomerFromToken(payload);
    return { success: true, data: this.toPublicCustomer(customer) };
  }
}

