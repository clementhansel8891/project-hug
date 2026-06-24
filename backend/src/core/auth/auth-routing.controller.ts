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

      // Find active shift for today
      const activeShift = await this.prisma.hr_work_shifts.findFirst({
        where: {
          tenant_id: user.tenant_id,
          employee_id: employee.id,
          start_time: {
            lte: new Date(now.getTime() + 2 * 60 * 60 * 1000), // Allow login 2 hours before shift
          },
          end_time: {
            gte: now, // Shift hasn't ended yet
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

      if (activeShift && activeShift.locations?.stores?.[0]) {
        const store = activeShift.locations.stores[0];
        
        return {
          success: true,
          data: {
            redirect_to: '/retail/operational/pos',
            context: {
              store_id: store.id,
              store_name: store.name,
              location_id: activeShift.location_id,
              shift_id: activeShift.id,
              shift_start: activeShift.start_time?.toISOString(),
              shift_end: activeShift.end_time?.toISOString(),
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
