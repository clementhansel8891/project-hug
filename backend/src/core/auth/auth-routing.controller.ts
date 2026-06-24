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
          locations: {
            include: {
              stores: true,
            },
          },
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
              redirect_to: '/m/retail/management',
              message: 'Your shift has ended. You now have access to retail management.',
              shift_status: 'ended',
              shift_end: shiftEnd.toISOString(),
            },
          };
        }

        // If before shift or during shift or within 1 hour after
        const locations = todayShift.locations;
        if (locations) {
          const stores = locations.stores || [];
          
          // Filter E2E stores
          const realStores = stores.filter(s => 
            !s.name?.includes('E2E-') && 
            !s.name?.includes('E2E ') &&
            !s.code?.includes('E2E') &&
            !s.deleted_at
          );
          
          // Prefer Seminyak
          const store = realStores.find(s => s.code === 'BS-03' || s.name === 'Seminyak') 
                       || realStores[0] 
                       || stores.filter(s => !s.deleted_at)[0];
          
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

            console.log(`[AuthRouting] ✅ Resolved store: ${store.name} (${store.code})`);
            console.log(`[AuthRouting] Location: ${locations.name} (${todayShift.location_id})`);
            console.log(`[AuthRouting] Shift status: ${isDuringShift ? 'active' : isBeforeShift ? 'upcoming' : 'recently ended'}`);
            
            return {
              success: true,
              data: {
                redirect_to: '/m/retail/operational/pos',
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
          }
        }
      }

      // No shift found for today
      console.warn(`[AuthRouting] ⚠️  No shift scheduled for employee ${employee.id}`);
      
      // Check if it's a holiday or day off
      const isWeekend = now.getDay() === 0 || now.getDay() === 6; // Sunday or Saturday
      
      return {
        success: true,
        data: {
          redirect_to: '/m/retail/management',
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
