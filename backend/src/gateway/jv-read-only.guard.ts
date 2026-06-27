import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JV_MODULE_KEY } from "./jv-permission.guard";

/**
 * JV Read-Only Guard (v2)
 * 
 * Updated to support the writable JV model:
 * - If the route has a @JVModule() decorator, delegate to JVPermissionGuard (skip this check)
 * - If no @JVModule(), apply legacy read-only for NON_OPERATOR partners
 * - OPERATOR partners get write access to undecorated routes too
 * 
 * This maintains backward compat for routes not yet migrated to the permission model.
 */
@Injectable()
export class JVReadOnlyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenantContext = request.tenantContext;

    // Only applies to JV partner contexts
    if (!tenantContext?.is_jv_context && !tenantContext?.is_jv_read_only) {
      return true;
    }

    // If this route has @JVModule(), the JVPermissionGuard handles access — skip legacy guard
    const hasJVModuleDecorator = this.reflector.getAllAndOverride<string>(JV_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (hasJVModuleDecorator) {
      return true;
    }

    // OPERATOR role partners can write to undecorated routes
    if (tenantContext.jv_role === 'OPERATOR') {
      return true;
    }

    // NON_OPERATOR or legacy behavior: block writes
    const method = request.method;
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      throw new ForbiddenException(
        "ACCESS_DENIED: Your JV partnership role (NON_OPERATOR) restricts write access. Contact the host tenant admin for elevated permissions."
      );
    }

    return true;
  }
}
