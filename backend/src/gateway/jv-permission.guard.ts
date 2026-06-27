import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../persistence/prisma.service";

/**
 * JV Module Permission Key — used with @JVModule() decorator
 */
export const JV_MODULE_KEY = "jv_module";

/**
 * JV Module Permission Guard
 * 
 * Replaces the old binary JVReadOnlyGuard with granular module-level permission checks.
 * When a user is in JV_PARTNER mode (accessing a host tenant via JV participation),
 * this guard checks `finance_jv_permissions` to determine what they can do.
 * 
 * Access Levels:
 * - "none"    → blocked entirely
 * - "read"    → GET only
 * - "write"   → GET + POST/PATCH/PUT (create/update)
 * - "manage"  → full access including DELETE
 */
@Injectable()
export class JVPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantContext = request.tenantContext;

    // Only applies to JV partners in mirror mode
    if (!tenantContext?.is_jv_context) {
      return true;
    }

    const method = request.method;
    const jvParticipantId = tenantContext.jv_participant_id;

    if (!jvParticipantId) {
      // Fallback: if we're in JV context but no participant resolved, block writes
      if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
        throw new ForbiddenException(
          "ACCESS_DENIED: JV participation context could not be resolved."
        );
      }
      return true;
    }

    // Determine which module this request targets
    const requiredModule = this.reflector.getAllAndOverride<string>(JV_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no @JVModule() is defined, use legacy read-only behavior
    if (!requiredModule) {
      if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
        throw new ForbiddenException(
          "ACCESS_DENIED: This module has not been configured for JV partner access."
        );
      }
      return true;
    }

    // Lookup the permission
    const permission = await this.prisma.finance_jv_permissions.findUnique({
      where: {
        participant_id_module: {
          participant_id: jvParticipantId,
          module: requiredModule,
        },
      },
    });

    const accessLevel = permission?.access_level || "none";

    // Check access based on HTTP method
    if (accessLevel === "none") {
      throw new ForbiddenException(
        `ACCESS_DENIED: Your JV partnership does not include access to the '${requiredModule}' module.`
      );
    }

    if (accessLevel === "read" && ["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
      throw new ForbiddenException(
        `ACCESS_DENIED: Your JV partnership grants read-only access to '${requiredModule}'. Write operations are not permitted.`
      );
    }

    if (accessLevel === "write" && method === "DELETE") {
      throw new ForbiddenException(
        `ACCESS_DENIED: Your JV partnership does not allow delete operations on '${requiredModule}'.`
      );
    }

    // "manage" access level = full access
    return true;
  }
}
