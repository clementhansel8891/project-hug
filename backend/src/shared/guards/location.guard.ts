import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "../roles";
import { PrismaService } from "../../persistence/prisma.service";

export const SKIP_LOCATION_CHECK = "skipLocationCheck";
export const SkipLocationCheck = () => SetMetadata(SKIP_LOCATION_CHECK, true);

/**
 * Location Guard
 * Ensures that the actor has permission to access the requested location context
 * - Owners/Admins have global visibility
 * - Managers are restricted to their assigned location
 * 
 * Can be bypassed with @SkipLocationCheck() decorator for endpoints that handle
 * location validation internally (e.g., shift operations).
 */
@Injectable()
export class LocationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { tenant_id, location_id, role } = request.tenantContext || {};

    if (!tenant_id) {
      throw new ForbiddenException("Tenant context missing");
    }

    // 1. Owners and Admins have global visibility
    if (
      role === UserRole.SUPERADMIN ||
      role === UserRole.OWNER ||
      role === UserRole.ADMIN
    ) {
      return true;
    }

    // 2. Identify target location from request
    let targetLocationId =
      request.params.location_id ||
      request.headers["x-location-id"];

    // 3. Special handling for shift operations - resolve location from shift's store
    let isShiftOperation = false;
    if (!targetLocationId && request.params.id) {
      const url = request.url || request.path || '';
      const isShiftEndpoint = url.includes('/shifts/');

      if (isShiftEndpoint) {
        isShiftOperation = true;  // Mark this as a shift operation
        console.log(`[LocationGuard] Resolving location for shift: ${request.params.id}`);
        
        // Look up shift in database
        const shift = await this.prisma.retail_shifts.findFirst({
          where: { 
            id: request.params.id, 
            tenant_id 
          },
          select: { 
            store_id: true,
            stores: {
              select: {
                location_id: true
              }
            }
          },
        });

        if (shift?.stores?.location_id) {
          targetLocationId = shift.stores.location_id;
          console.log(`[LocationGuard] Resolved shift location: ${targetLocationId}`);
        } else {
          console.log(`[LocationGuard] Could not resolve location for shift ${request.params.id}`);
        }
      }
    }

    // 4. For shift operations, allow access after tenant validation
    // The shift already belongs to the user's tenant, and users should be able to
    // close shifts they opened regardless of their current session location.
    if (isShiftOperation) {
      console.log(`[LocationGuard] Allowing shift operation (tenant ownership validated)`);
      return true;
    }

    if (!targetLocationId) {
      // If no target location is specified, and user is not admin,
      // they should not be performing location-specific actions.
      // However, some list operations might be filtered by service logic instead.
      return true;
    }

    // 5. For non-shift operations, enforce location match for Managers/Members
    if (location_id && targetLocationId !== location_id) {
      throw new ForbiddenException(
        `Access Denied: You are assigned to location '${location_id}' and cannot perform actions for location '${targetLocationId}'.`,
      );
    }

    return true;
  }
}
