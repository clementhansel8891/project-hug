import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../persistence/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { PaginationParams } from '../pipes/pagination.pipe';

export type WorkflowStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED' | 'MODIFIED';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async createRequest(params: {
    tenant_id: string;
    entity_type: string;
    entity_id: string;
    maker_dept: string;
    destination_dept: string;
    requested_by: string;
    notes?: string;
    metadata?: any;
  }) {
    const request = await this.prisma.workflow_requests.create({
      data: {
        id: randomUUID(),
        updated_at: new Date(),
        tenant_id: params.tenant_id,
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        maker_dept: params.maker_dept,
        destination_dept: params.destination_dept,
        requested_by: params.requested_by,
        notes: params.notes,
        metadata: params.metadata || {},
        status: 'PENDING',
        cycle: 1,
      },
    });

    await this.eventBus.publish({
      event_type: 'workflow.created',
      tenant_id: params.tenant_id,
      entity_id: request.id,
      entity_type: 'WORKFLOW_REQUEST',
      source_module: 'WORKFLOW',
      payload: { entity_type: params.entity_type, entity_id: params.entity_id },
    });

    return request;
  }

  async approveRequest(tenant_id: string, id: string, user_id: string, notes?: string) {
    const request = await this.prisma.workflow_requests.findUnique({
      where: { id, tenant_id },
    });

    if (!request) throw new NotFoundException('Workflow request not found');
    if (request.status !== 'PENDING') throw new BadRequestException('Request is no longer pending');

    const updated = await this.prisma.workflow_requests.update({
      where: { id },
      data: {
        status: 'APPROVED',
        last_action: 'APPROVE',
        notes: notes || request.notes,
      },
    });

    // Audit Log entry
    await this.prisma.workflow_audit_entries.create({
      data: {
        id: randomUUID(),
        updated_at: new Date(),
        tenant_id,
        workflow_id: id,
        action: 'APPROVE',
        actor_id: user_id,
        notes,
        cycle: request.cycle,
        after: { status: 'APPROVED' },
      },
    });

    await this.eventBus.publish({
      event_type: 'workflow.approved',
      tenant_id: tenant_id,
      entity_id: id,
      entity_type: 'WORKFLOW_REQUEST',
      source_module: 'WORKFLOW',
      user_id: user_id,
      payload: { entity_type: request.entity_type, entity_id: request.entity_id },
    });

    return updated;
  }

  async rejectRequest(tenant_id: string, id: string, user_id: string, notes?: string) {
    const request = await this.prisma.workflow_requests.findUnique({
      where: { id, tenant_id: tenant_id },
    });

    if (!request) throw new NotFoundException('Workflow request not found');

    const updated = await this.prisma.workflow_requests.update({
      where: { id },
      data: {
        status: 'REJECTED',
        last_action: 'REJECT',
        notes: notes || request.notes,
      },
    });

    await this.prisma.workflow_audit_entries.create({
      data: {
        id: randomUUID(),
        updated_at: new Date(),
        tenant_id,
        workflow_id: id,
        action: 'REJECT',
        actor_id: user_id,
        notes,
        cycle: request.cycle,
        after: { status: 'REJECTED' },
      },
    });

    await this.eventBus.publish({
      event_type: 'workflow.rejected',
      tenant_id: tenant_id,
      entity_id: id,
      entity_type: 'WORKFLOW_REQUEST',
      source_module: 'WORKFLOW',
      user_id: user_id,
      payload: { entity_type: request.entity_type, entity_id: request.entity_id },
    });

    return updated;
  }

  async listInbox(tenant_id: string, dept: string, pagination: PaginationParams) {
    const skip = (pagination.page - 1) * pagination.pageSize;
    const where = {
      tenant_id: tenant_id,
      destination_dept: dept,
      status: 'PENDING' as const,
    };

    const [data, totalCount] = await Promise.all([
      this.prisma.workflow_requests.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: pagination.pageSize,
      }),
      this.prisma.workflow_requests.count({ where }),
    ]);

    return {
      data,
      totalCount,
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
    };
  }

  async listAll(tenant_id: string, pagination: PaginationParams) {
    const skip = (pagination.page - 1) * pagination.pageSize;
    const where = { tenant_id: tenant_id };

    const [data, totalCount] = await Promise.all([
      this.prisma.workflow_requests.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: pagination.pageSize,
      }),
      this.prisma.workflow_requests.count({ where }),
    ]);

    return {
      data,
      totalCount,
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
    };
  }
}
