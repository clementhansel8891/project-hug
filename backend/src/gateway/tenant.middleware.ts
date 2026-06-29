import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { TenantContext } from "./tenant-context.interface";
import { AuthService } from "../core/auth/auth.service";
import { PrismaService } from "../persistence/prisma.service";

/**
 * Tenant Middleware
 * Extracts tenant context from request headers and attaches to request object
 * Enforces multi-tenancy by requiring x-tenant-id header
 * Verifies JWT token if present to prevent header spoofing
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService
  ) {}

  async use(req: any, res: Response, next: NextFunction) {
    // 1. Extract tenant ID from header (REQUIRED for multi-tenancy)
    const tenant_id = req.headers["x-tenant-id"];
    const bypass = req.headers["x-dev-bypass"];

    // Bypass for public inventory images
    if (req.url.includes("/inventory/images/") || req.path?.includes("/inventory/images/")) {
       return next();
    }

    // Bypass for auth routes (login, register, forgot-password)
    const fullUrl = req.originalUrl || req.url || '';
    if (fullUrl.includes('/auth/') || fullUrl.startsWith('/auth') || fullUrl.includes('/v1/auth/')) {
       return next();
    }

    // Bypass for public retail routes (headless ecommerce uses channel credentials, not JWT)
    if (fullUrl.includes('/retail/public/') || fullUrl.includes('/retail/public')) {
       return next();
    }

    // Bypass for retail events (uses EcommerceConnectorGuard, not JWT)
    if (fullUrl.match(/\/retail\/events\b/)) {
       return next();
    }

    // Bypass for monitoring/health checks
    if (fullUrl.includes('/monitoring/') || fullUrl.includes('/v1/monitoring/')) {
       return next();
    }

    console.log(
      `[V3001] URL: ${req.url}, OriginalURL: ${req.originalUrl}, Tenant: ${tenant_id}, Bypass: ${bypass}`,
    );

    if (!tenant_id) {
      throw new BadRequestException(
        "Missing required header: x-tenant-id. All requests must include a tenant identifier.",
      );
    }

    // 2. JWT Verification (HARDENING)
    const authHeader = req.headers.authorization;
    let verifiedUser: any = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        verifiedUser = await this.authService.verifyAndGetProfile(token);
      } catch (e) {
        throw new UnauthorizedException(
          "Invalid or expired authentication token",
        );
      }
    }

    // 3. Context Construction
    if (!verifiedUser) {
      throw new UnauthorizedException(
        "Valid authentication token required for this resource.",
      );
    }

    const user_id = verifiedUser.id;
    const location_id = req.headers["x-location-id"];
    const branch_id = req.headers["x-branch-id"] || location_id;
    const ecommerce_id = req.headers["x-ecommerce-id"];
    const company_id = req.headers["x-company-id"] || tenant_id;

    // 4. Role Extraction & Verification (STRICT MODE)
    const userCompanies = verifiedUser.user_companies || [];
    let activeRole: string | null = null;

    // Check for Global Superadmin first
    const isSuperAdmin = userCompanies.some(
      (uc: any) => uc.role === "SUPERADMIN",
    );

    if (isSuperAdmin) {
      activeRole = "SUPERADMIN";
      console.log(`[RBAC] User ${user_id} detected as GLOBAL SUPERADMIN. Granting access to tenant ${tenant_id}`);
    } else {
      // Strict matching for other roles (OWNER, ADMIN, etc)
      const tenantAssoc = userCompanies.find(
        (uc: any) => uc.tenant_id === tenant_id,
      );
      
      const isJVTarget = !tenantAssoc && tenant_id !== verifiedUser.tenant_id;

      if (!tenantAssoc && !isJVTarget) {
        throw new UnauthorizedException(
          `Access Denied: User ${user_id} is not associated with tenant ${tenant_id}`,
        );
      }

      if (isJVTarget) {
        // Attempt JV Mirroring
        const jvParticipation: any = await this.prisma.finance_jv_participants.findFirst({
          where: {
            participant_tenant_id: verifiedUser.tenant_id,
            jv_profiles: {
              tenant_id: tenant_id as string,
              is_active: true
            }
          },
          include: {
            jv_profiles: {
              include: {
                scopes: true
              }
            }
          }
        });

        if (jvParticipation) {
          activeRole = "JV_PARTNER";
          console.log(`[JV-MIRROR] User ${user_id} granted PARTNER access to host ${tenant_id} (role: ${jvParticipation.role})`);
          
          // Apply JV Scope to headers if not already set or override
          const scopes = jvParticipation.jv_profiles.scopes || [];
          const scope = scopes[0];
          if (scope) {
            req.headers["x-branch-id"] = scope.branch_id || req.headers["x-branch-id"];
            req.headers["x-ecommerce-id"] = scope.ecommerce_id || req.headers["x-ecommerce-id"];
          } else {
            // No scopes defined — restrict to read-only to prevent unscoped writes across all branches
            console.warn(`[JV-MIRROR] WARNING: JV Profile ${jvParticipation.jv_profile_id} has no scopes. Enforcing read-only access.`);
            req.is_jv_read_only = true;
          }

          // Enrich request with JV context for downstream guards/services
          req.jv_context = {
            participant_id: jvParticipation.id,
            jv_role: jvParticipation.role, // OPERATOR or NON_OPERATOR
            jv_profile_id: jvParticipation.jv_profile_id,
            home_tenant_id: verifiedUser.tenant_id,
          };
          req.is_jv_read_only = req.is_jv_read_only || jvParticipation.role === 'NON_OPERATOR';
        } else {
          throw new UnauthorizedException(
            `Access Denied: No active Joint Venture participation found for user ${user_id} in tenant ${tenant_id}`,
          );
        }
      } else {
        activeRole = tenantAssoc.role;
        console.log(`[RBAC] User ${user_id} authorized for tenant ${tenant_id} with role ${activeRole}`);
      }
    }

    // Attach tenant context to request object
    const jvCtx = req.jv_context;
    req.tenantContext = {
      tenant_id: tenant_id as string,
      company_id: company_id as string,
      branch_id: branch_id as string | undefined,
      location_id: location_id as string | undefined,
      ecommerce_id: ecommerce_id as string | undefined,
      user_id,
      role: activeRole,
      is_jv_read_only: req.is_jv_read_only,
      // JV enriched context
      is_jv_context: !!jvCtx,
      jv_participant_id: jvCtx?.participant_id,
      jv_role: jvCtx?.jv_role,
      jv_profile_id: jvCtx?.jv_profile_id,
      jv_home_tenant_id: jvCtx?.home_tenant_id,
    };

    req.user = verifiedUser;
    next();
  }
}
