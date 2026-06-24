import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../persistence/prisma.service';

interface RequestWithUser extends Request {
  user?: any;
}

interface LoginRoutingInfo {
  redirect_to: string;
  context?: {
    store_id?: string;
    store_name?: string;
    location_id?: string;
    schedule_id?: string;
    shift_type?: string;
    shift_start?: string;
    shift_end?: string;
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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const now = new Date();

      // Find active schedule for today
      const activeSchedule = await this.prisma.hr_schedules.findFirst({
        where: {
          tenant_id: user.tenant_id,
          employee_id: employee.id,
          date: {
            gte: today,
            lt: tomorrow,
          },
          status: 'CONFIRMED',
          start_time: {
            lte: new Date(now.getTime() + 2 * 60 * 60 * 1000), // Allow login 2 hours before shift
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
          start_time: 'asc',
        },
      });

      if (activeSchedule && activeSchedule.locations?.stores?.[0]) {
        const store = activeSchedule.locations.stores[0];
        
        return {
          success: true,
          data: {
            redirect_to: '/retail/operational/pos',
            context: {
              store_id: store.id,
              store_name: store.name,
              location_id: activeSchedule.location_id,
              schedule_id: activeSchedule.id,
              shift_type: activeSchedule.shift_type || 'REGULAR',
              shift_start: activeSchedule.start_time?.toISOString(),
              shift_end: activeSchedule.end_time?.toISOString(),
            },
          },
        };
      }
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
