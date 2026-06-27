import { Injectable, Inject, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../persistence/prisma.service';
import { IJVRepository } from '../repositories/interfaces/jv.repository.interface';

export interface CreateJVExpenseDto {
  jv_profile_id: string;
  description: string;
  amount: number;
  category_id?: string;
  expense_date: string;
  receipt_url?: string;
  split_method?: 'equal' | 'by_share' | 'custom' | 'category_burden';
  custom_split?: { participant_tenant_id: string; pct: number }[];
  currency?: string;
}

export interface ApproveExpenseDto {
  expense_id: string;
}

export interface RejectExpenseDto {
  expense_id: string;
  reason: string;
}

@Injectable()
export class JVExpenseService {
  private readonly logger = new Logger(JVExpenseService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('IJVRepository') private readonly jvRepo: IJVRepository,
  ) {}

  /**
   * Create a new JV expense entry.
   * Can be submitted by either party (host or partner).
   */
  async createExpense(
    tenantId: string,
    submitterTenantId: string,
    userId: string,
    dto: CreateJVExpenseDto,
  ) {
    // Validate the JV profile exists and submitter is a participant
    const profile = await this.prisma.finance_jv_profiles.findFirst({
      where: { id: dto.jv_profile_id, is_active: true },
      include: { participants: true },
    });

    if (!profile) {
      throw new BadRequestException('JV Profile not found or inactive.');
    }

    // Verify submitter is either the host or a participant
    const isHost = profile.tenant_id === submitterTenantId;
    const isParticipant = profile.participants.some(
      p => p.participant_tenant_id === submitterTenantId
    );

    if (!isHost && !isParticipant) {
      throw new ForbiddenException('You are not a member of this Joint Venture.');
    }

    const expense = await this.prisma.finance_jv_expenses.create({
      data: {
        tenant_id: tenantId,
        jv_profile_id: dto.jv_profile_id,
        submitted_by: userId,
        submitter_tenant_id: submitterTenantId,
        category_id: dto.category_id,
        description: dto.description,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency || 'IDR',
        receipt_url: dto.receipt_url,
        expense_date: new Date(dto.expense_date),
        split_method: dto.split_method || 'by_share',
        custom_split: dto.custom_split ? JSON.parse(JSON.stringify(dto.custom_split)) : undefined,
        status: 'SUBMITTED',
      },
    });

    this.logger.log(`JV Expense ${expense.id} created by ${userId} (tenant: ${submitterTenantId}) for profile ${dto.jv_profile_id}`);
    return expense;
  }

  /**
   * Approve an expense and calculate allocations.
   * Only the counterparty (the one who didn't submit) can approve.
   */
  async approveExpense(
    tenantId: string,
    approverTenantId: string,
    approverId: string,
    dto: ApproveExpenseDto,
  ) {
    const expense = await this.prisma.finance_jv_expenses.findFirst({
      where: { id: dto.expense_id, tenant_id: tenantId, status: 'SUBMITTED' },
    });

    if (!expense) {
      throw new BadRequestException('Expense not found or not in SUBMITTED status.');
    }

    // The submitter cannot approve their own expense
    if (expense.submitter_tenant_id === approverTenantId) {
      throw new ForbiddenException('You cannot approve your own expense submission. The counterparty must approve.');
    }

    // Fetch participants for allocation calculation
    const participants = await this.jvRepo.getParticipants(expense.jv_profile_id);
    const profile = await this.prisma.finance_jv_profiles.findUnique({
      where: { id: expense.jv_profile_id },
    });

    if (!profile) {
      throw new BadRequestException('JV Profile not found.');
    }

    // Calculate allocations based on split method
    const allocations = await this.calculateAllocations(
      expense,
      participants,
      profile.tenant_id,
    );

    // Write allocations and update status in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Update expense status
      await tx.finance_jv_expenses.update({
        where: { id: expense.id },
        data: {
          status: 'APPROVED',
          approved_by: approverId,
          approved_at: new Date(),
        },
      });

      // Create allocation records
      if (allocations.length > 0) {
        await tx.finance_jv_expense_allocations.createMany({
          data: allocations,
        });
      }
    });

    this.logger.log(`JV Expense ${expense.id} approved by ${approverId}. ${allocations.length} allocations created.`);

    return {
      expense_id: expense.id,
      status: 'APPROVED',
      allocations,
    };
  }

  /**
   * Reject an expense with a reason.
   */
  async rejectExpense(
    tenantId: string,
    rejectorTenantId: string,
    rejectorId: string,
    dto: RejectExpenseDto,
  ) {
    const expense = await this.prisma.finance_jv_expenses.findFirst({
      where: { id: dto.expense_id, tenant_id: tenantId, status: 'SUBMITTED' },
    });

    if (!expense) {
      throw new BadRequestException('Expense not found or not in SUBMITTED status.');
    }

    if (expense.submitter_tenant_id === rejectorTenantId) {
      throw new ForbiddenException('You cannot reject your own expense.');
    }

    await this.prisma.finance_jv_expenses.update({
      where: { id: expense.id },
      data: {
        status: 'REJECTED',
        rejection_reason: dto.reason,
      },
    });

    return { expense_id: expense.id, status: 'REJECTED', reason: dto.reason };
  }

  /**
   * List expenses for a JV profile with optional filters.
   */
  async listExpenses(tenantId: string, profileId: string, filters?: {
    status?: string;
    submitter_tenant_id?: string;
    from_date?: string;
    to_date?: string;
  }) {
    const where: any = {
      tenant_id: tenantId,
      jv_profile_id: profileId,
    };

    if (filters?.status) where.status = filters.status;
    if (filters?.submitter_tenant_id) where.submitter_tenant_id = filters.submitter_tenant_id;
    if (filters?.from_date || filters?.to_date) {
      where.expense_date = {};
      if (filters.from_date) where.expense_date.gte = new Date(filters.from_date);
      if (filters.to_date) where.expense_date.lte = new Date(filters.to_date);
    }

    return this.prisma.finance_jv_expenses.findMany({
      where,
      include: {
        allocations: true,
      },
      orderBy: { expense_date: 'desc' },
    });
  }

  /**
   * Calculate how an expense is split among participants.
   */
  private async calculateAllocations(
    expense: any,
    participants: any[],
    hostTenantId: string,
  ): Promise<any[]> {
    const amount = Number(expense.amount);
    const allocations: any[] = [];

    switch (expense.split_method) {
      case 'equal': {
        // Split equally: host + all participants
        const totalParties = participants.length + 1; // +1 for host
        const share = amount / totalParties;
        const sharePct = new Prisma.Decimal((100 / totalParties).toFixed(4));

        // Host allocation
        allocations.push({
          expense_id: expense.id,
          participant_id: 'HOST',
          tenant_id: hostTenantId,
          amount: new Prisma.Decimal(share.toFixed(4)),
          burden_pct: sharePct,
        });

        // Partner allocations
        for (const p of participants) {
          allocations.push({
            expense_id: expense.id,
            participant_id: p.id,
            tenant_id: p.participant_tenant_id,
            amount: new Prisma.Decimal(share.toFixed(4)),
            burden_pct: sharePct,
          });
        }
        break;
      }

      case 'by_share': {
        // Use profit_share_pct from participant records
        // Host gets the remainder
        let partnerTotal = 0;

        for (const p of participants) {
          const pct = Number(p.profit_share_pct || 0);
          const allocated = (amount * pct) / 100;
          partnerTotal += allocated;

          allocations.push({
            expense_id: expense.id,
            participant_id: p.id,
            tenant_id: p.participant_tenant_id,
            amount: new Prisma.Decimal(allocated.toFixed(4)),
            burden_pct: new Prisma.Decimal(pct.toFixed(4)),
          });
        }

        // Host bears the remainder
        const hostShare = amount - partnerTotal;
        const hostPct = ((amount - partnerTotal) / amount) * 100;
        allocations.push({
          expense_id: expense.id,
          participant_id: 'HOST',
          tenant_id: hostTenantId,
          amount: new Prisma.Decimal(hostShare.toFixed(4)),
          burden_pct: new Prisma.Decimal(hostPct.toFixed(4)),
        });
        break;
      }

      case 'custom': {
        // Use custom_split from the expense record
        const customSplit = expense.custom_split as any[] || [];
        for (const entry of customSplit) {
          const allocated = (amount * entry.pct) / 100;
          allocations.push({
            expense_id: expense.id,
            participant_id: entry.participant_tenant_id === hostTenantId ? 'HOST' : entry.participant_tenant_id,
            tenant_id: entry.participant_tenant_id,
            amount: new Prisma.Decimal(allocated.toFixed(4)),
            burden_pct: new Prisma.Decimal(entry.pct.toFixed(4)),
          });
        }
        break;
      }

      case 'category_burden': {
        // Use finance_jv_cost_mapping for the category
        if (!expense.category_id) {
          // Fallback to by_share if no category
          return this.calculateAllocations(
            { ...expense, split_method: 'by_share' },
            participants,
            hostTenantId,
          );
        }

        const costMappings = await this.prisma.finance_jv_cost_mapping.findMany({
          where: {
            category_id: expense.category_id,
            participant: {
              jv_profile_id: expense.jv_profile_id,
            },
          },
          include: { participant: true },
        });

        if (costMappings.length === 0) {
          // Fallback to by_share
          return this.calculateAllocations(
            { ...expense, split_method: 'by_share' },
            participants,
            hostTenantId,
          );
        }

        let mappedTotal = 0;
        for (const mapping of costMappings) {
          const pct = Number(mapping.burden_pct);
          const allocated = (amount * pct) / 100;
          mappedTotal += allocated;

          allocations.push({
            expense_id: expense.id,
            participant_id: mapping.participant_id,
            tenant_id: mapping.participant.participant_tenant_id,
            amount: new Prisma.Decimal(allocated.toFixed(4)),
            burden_pct: new Prisma.Decimal(pct.toFixed(4)),
          });
        }

        // Host bears unmapped remainder
        if (mappedTotal < amount) {
          const hostShare = amount - mappedTotal;
          const hostPct = (hostShare / amount) * 100;
          allocations.push({
            expense_id: expense.id,
            participant_id: 'HOST',
            tenant_id: hostTenantId,
            amount: new Prisma.Decimal(hostShare.toFixed(4)),
            burden_pct: new Prisma.Decimal(hostPct.toFixed(4)),
          });
        }
        break;
      }
    }

    return allocations;
  }
}
