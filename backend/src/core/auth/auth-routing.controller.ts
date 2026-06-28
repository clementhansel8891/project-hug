import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../persistence/prisma.service';

interface RequestWithUser extends Request {
  user?: any;
}

interface LoginRoutingInfo {
  redirect_to: string;
  message?: string;
  shift_status?: 'active' | 'upcoming' | 'recently_ended' | 'ended' | 'not_scheduled';
  shift_end?: string;
  context?: {
    store_id?: string;
    store_name?: string;
    location_id?: string;
    shift_id?: string;
    shift_start?: string;
    shift_end?: string;
    shift_status?: 'active' | 'upcoming' | 'recently_ended';
  };
}

@Controller('auth')
export class AuthRoutingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('routing-info')
  async getRoutingInfo(@Req() request: RequestWithUser): Promise<{ success: boolean; data: LoginRoutingInfo }> {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing token');
    }

    const token = authHeader.split(' ')[1];
    
    // Simple JWT decode (in production, verify signature)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const userId = payload.sub;

    if (!userId) {
      throw new UnauthorizedException('Invalid token');
    }

    // Get user with company info
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      include: {
        user_companies: {
          include: {
            companies: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Get employee record to check for active schedules
    const employee = await this.prisma.employees.findFirst({
      where: {
        tenant_id: user.tenant_id,
        user_id: user.id,
      },
    });

    // Check user role
    const userRole = user.user_companies?.[0]?.role || 'EMPLOYEE';

    // If EMPLOYEE role, check for active schedule today
    if (userRole === 'EMPLOYEE' && employee) {
      const now = new Date();

      // Find shift for today (allow 2 hours before, check if recently ended)
      const todayShift = await this.prisma.hr_work_shifts.findFirst({
        where: {
          tenant_id: user.tenant_id,
          employee_id: employee.id,
          start_time: {
            lte: new Date(now.getTime() + 2 * 60 * 60 * 1000), // Allow login 2 hours before
          },
          end_time: {
            gte: new Date(now.getTime() - 4 * 60 * 60 * 1000), // Look back 4 hours
          },
        },
        include: {
          locations: true, // Get location info
        },
        orderBy: {
          start_time: 'desc',
        },
      });

      if (todayShift) {
        const shiftStart = new Date(todayShift.start_time);
        const shiftEnd = new Date(todayShift.end_time);
        const isBeforeShift = now < shiftStart;
        const isDuringShift = now >= shiftStart && now <= shiftEnd;
        const isAfterShift = now > shiftEnd;
        const hoursSinceEnd = (now.getTime() - shiftEnd.getTime()) / (1000 * 60 * 60);

        // If shift ended more than 1 hour ago
        if (isAfterShift && hoursSinceEnd > 1) {
          console.log(`[AuthRouting] ⚠️  Shift ended ${hoursSinceEnd.toFixed(1)} hours ago`);
          return {
            success: true,
            data: {
              redirect_to: '/m/retail/workspace',
              message: 'Your shift has ended. You now have access to retail management.',
              shift_status: 'ended',
              shift_end: shiftEnd.toISOString(),
            },
          };
        }

        // Fetch stores at this shift's location
        // CRITICAL: Query stores explicitly by location_id and filter deleted stores
        if (!todayShift.location_id) {
          console.error(`[AuthRouting] ❌ Shift ${todayShift.id} has no location_id`);
          return {
            success: true,
            data: {
              redirect_to: '/m/retail/workspace',
              message: 'Your shift has no location assigned. Please contact support.',
              shift_status: 'not_scheduled',
            },
          };
        }

        const stores = await this.prisma.stores.findMany({
          where: {
            location_id: todayShift.location_id,
            deleted_at: null, // Filter out deleted stores
            tenant_id: user.tenant_id, // Ensure same tenant
          },
        });
        
        if (stores.length > 0) {
          // Filter out E2E test stores
          const realStores = stores.filter(s => 
            !s.name?.includes('E2E-') && 
            !s.name?.includes('E2E ') &&
            !s.code?.includes('E2E')
          );
          
          // Prefer active stores over inactive ones
          const activeStores = realStores.filter(s => s.status === 'active');
          const validStores = activeStores.length > 0 ? activeStores : realStores;
          
          // Pick first valid store
          const store = validStores[0] || stores[0];
          
          if (store) {
            let message = '';
            if (isBeforeShift) {
              const minutesUntil = Math.floor((shiftStart.getTime() - now.getTime()) / (1000 * 60));
              message = `Your shift starts in ${minutesUntil} minutes.`;
            } else if (isDuringShift) {
              message = 'Your shift is active.';
            } else {
              message = 'Your shift recently ended. Please close any open shifts.';
            }

            console.log(`[AuthRouting] ✅ Resolved store: ${store.name} (${store.id}) for shift ${todayShift.id}`);
            console.log(`[AuthRouting] Store code: ${store.code}, Status: ${store.status}`);
            console.log(`[AuthRouting] Location: ${todayShift.locations?.name} (${todayShift.location_id})`);
            console.log(`[AuthRouting] Shift status: ${isDuringShift ? 'active' : isBeforeShift ? 'upcoming' : 'recently ended'}`);
            console.log(`[AuthRouting] Total stores at location: ${stores.length}, Valid stores: ${validStores.length}`);
            
            return {
              success: true,
              data: {
                redirect_to: '/m/retail/operational/gateway',
                message,
                context: {
                  store_id: store.id,
                  store_name: store.name,
                  location_id: todayShift.location_id || undefined,
                  shift_id: todayShift.id,
                  shift_start: todayShift.start_time?.toISOString(),
                  shift_end: todayShift.end_time?.toISOString(),
                  shift_status: isDuringShift ? 'active' : isBeforeShift ? 'upcoming' : 'recently_ended',
                },
              },
            };
          } else {
            // Edge case: no valid stores found after filtering
            console.error(`[AuthRouting] ❌ No valid stores found for shift ${todayShift.id} at location ${todayShift.location_id}`);
            return {
              success: true,
              data: {
                redirect_to: '/m/retail/workspace',
                message: 'Unable to determine store for your shift. Please contact support.',
                shift_status: 'not_scheduled',
              },
            };
          }
        } else {
          // Edge case: no stores at this location
          console.error(`[AuthRouting] ❌ No stores found at location ${todayShift.location_id} for shift ${todayShift.id}`);
          return {
            success: true,
            data: {
              redirect_to: '/m/retail/workspace',
              message: 'No store found at your shift location. Please contact support.',
              shift_status: 'not_scheduled',
            },
          };
        }
      }

      // No shift found for today
      console.warn(`[AuthRouting] ⚠️  No shift scheduled for employee ${employee.id}`);
      
      // Check if it's a holiday or day off
      const isWeekend = now.getDay() === 0 || now.getDay() === 6; // Sunday or Saturday
      
      return {
        success: true,
        data: {
          redirect_to: '/m/retail/workspace',
          message: isWeekend 
            ? 'No shift scheduled today. Enjoy your day off!'
            : 'No shift scheduled for today. You have access to retail management.',
          shift_status: 'not_scheduled',
        },
      };
    }

    // Default routing for non-EMPLOYEE or no active schedule
    return {
      success: true,
      data: {
        redirect_to: '/core/dashboard',
      },
    };
  }
}
