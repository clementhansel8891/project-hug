import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../persistence/prisma.service';
import { IJVRepository } from '../repositories/interfaces/jv.repository.interface';

export interface GenerateSettlementDto {
  jv_profile_id: string;
  period_start: string;
  period_end: string;
}

export interface ConfirmSettlementDto {
  settlement_id: string;
}

export interface MarkPaidDto {
  settlement_id: string;
  payment_ref: string;
  notes?: string;
}

export interface DisputeSettlementDto {
  settlement_id: string;
  notes: string;
}

@Injectable()
export class JVSettlementService {
  private readonly logger = new Logger(JVSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('IJVRepository') private readonly jvRepo: IJVRepository,
  ) {}

  /**
   * Generate a settlement for a JV profile covering a specific period.
   * Aggregates:
   *   - Revenue allocations from shadow ledger
   *   - Expense allocations from JV expenses
   * Produces net payable/receivable per participant.
   */
  async generateSettlement(tenantId: string, userId: string, dto: GenerateSettlementDto) {
    const profile = await this.prisma.finance_jv_profiles.findFirst({
      where: { id: dto.jv_profile_id, tenant_id: tenantId, is_active: true },
      include: { participants: true },
    });

    if (!profile) {
      throw new BadRequestException('JV Profile not found or you are not the host.');
    }

    const periodStart = new Date(dto.period_start);
    const periodEnd = new Date(dto.period_end);

    // 1. Get revenue allocations from shadow ledger for the period
    const ledgerEntries = await this.prisma.finance_jv_ledger.findMany({
      where: {
        tenant_id: tenantId,
        jv_profile_id: dto.jv_profile_id,
        created_at: { gte: periodStart, lte: periodEnd },
      },
    });

    // 2. Get approved expense allocations for the period
    const expenseAllocations = await this.prisma.finance_jv_expense_allocations.findMany({
      where: {
        expense: {
          tenant_id: tenantId,
          jv_profile_id: dto.jv_profile_id,
          status: 'APPROVED',
          expense_date: { gte: periodStart, lte: periodEnd },
        },
      },
      include: {
        expense: true,
      },
    });

    // 3. Calculate per-participant settlement lines
    const participantMap = new Map<string, {
      participant_id: string;
      participant_tenant_id: string;
      revenue_allocated: number;
      cost_burden: number;
      expenses_borne: number;
    }>();

    // Initialize all participants
    for (const p of profile.participants) {
      participantMap.set(p.participant_tenant_id, {
        participant_id: p.id,
        participant_tenant_id: p.participant_tenant_id,
        revenue_allocated: 0,
        cost_burden: 0,
        expenses_borne: 0,
      });
    }

    // Aggregate ledger (revenue/profit share)
    for (const entry of ledgerEntries) {
      const data = participantMap.get(entry.participant_id);
      if (data) {
        const amt = Number(entry.allocated_amt);
        if (entry.type === 'PROFIT' || entry.type === 'REVENUE') {
          data.revenue_allocated += amt;
        } else if (entry.type === 'COST') {
          data.cost_burden += amt;
        }
      }
    }

    // Aggregate expense allocations
    for (const alloc of expenseAllocations) {
      const data = participantMap.get(alloc.tenant_id);
      if (data) {
        data.expenses_borne += Number(alloc.amount);
      }
    }

    // 4. Create settlement record with lines
    const settlement = await this.prisma.$transaction(async (tx) => {
      const settlementRecord = await tx.finance_jv_settlements.create({
        data: {
          tenant_id: tenantId,
          jv_profile_id: dto.jv_profile_id,
          period_start: periodStart,
          period_end: periodEnd,
          status: 'DRAFT',
          generated_by: userId,
        },
      });

      const lines: any[] = [];
      for (const [, data] of participantMap) {
        const netPayable = data.revenue_allocated - data.cost_burden - data.expenses_borne;
        const direction = netPayable >= 0 ? 'RECEIVABLE' : 'PAYABLE';

        lines.push({
          settlement_id: settlementRecord.id,
          participant_id: data.participant_id,
          participant_tenant_id: data.participant_tenant_id,
          revenue_allocated: new Prisma.Decimal(data.revenue_allocated.toFixed(4)),
          cost_burden: new Prisma.Decimal(data.cost_burden.toFixed(4)),
          expenses_borne: new Prisma.Decimal(data.expenses_borne.toFixed(4)),
          net_payable: new Prisma.Decimal(Math.abs(netPayable).toFixed(4)),
          direction,
        });
      }

      if (lines.length > 0) {
        await tx.finance_jv_settlement_lines.createMany({ data: lines });
      }

      return settlementRecord;
    });

    this.logger.log(`Settlement ${settlement.id} generated for profile ${dto.jv_profile_id} (${dto.period_start} to ${dto.period_end})`);

    return this.getSettlementDetail(tenantId, settlement.id);
  }

  /**
   * Confirm a settlement — both parties agree on the numbers.
   */
  async confirmSettlement(tenantId: string, confirmerId: string, dto: ConfirmSettlementDto) {
    const settlement = await this.prisma.finance_jv_settlements.findFirst({
      where: { id: dto.settlement_id, tenant_id: tenantId, status: 'DRAFT' },
    });

    if (!settlement) {
      throw new BadRequestException('Settlement not found or not in DRAFT status.');
    }

    await this.prisma.finance_jv_settlements.update({
      where: { id: settlement.id },
      data: {
        status: 'CONFIRMED',
        confirmed_by: confirmerId,
        confirmed_at: new Date(),
      },
    });

    return { settlement_id: settlement.id, status: 'CONFIRMED' };
  }

  /**
   * Mark settlement as paid with payment reference.
   */
  async markPaid(tenantId: string, dto: MarkPaidDto) {
    const settlement = await this.prisma.finance_jv_settlements.findFirst({
      where: { id: dto.settlement_id, tenant_id: tenantId, status: 'CONFIRMED' },
    });

    if (!settlement) {
      throw new BadRequestException('Settlement not found or not in CONFIRMED status.');
    }

    await this.prisma.finance_jv_settlements.update({
      where: { id: settlement.id },
      data: {
        status: 'PAID',
        paid_at: new Date(),
        payment_ref: dto.payment_ref,
        notes: dto.notes,
      },
    });

    return { settlement_id: settlement.id, status: 'PAID', payment_ref: dto.payment_ref };
  }

  /**
   * Dispute a settlement — partner disagrees with numbers.
   */
  async disputeSettlement(tenantId: string, dto: DisputeSettlementDto) {
    const settlement = await this.prisma.finance_jv_settlements.findFirst({
      where: { id: dto.settlement_id, tenant_id: tenantId, status: { in: ['DRAFT', 'CONFIRMED'] } },
    });

    if (!settlement) {
      throw new BadRequestException('Settlement not found or already finalized.');
    }

    await this.prisma.finance_jv_settlements.update({
      where: { id: settlement.id },
      data: {
        status: 'DISPUTED',
        notes: dto.notes,
      },
    });

    return { settlement_id: settlement.id, status: 'DISPUTED' };
  }

  /**
   * List settlements for a JV profile.
   */
  async listSettlements(tenantId: string, profileId: string, status?: string) {
    const where: any = { tenant_id: tenantId, jv_profile_id: profileId };
    if (status) where.status = status;

    return this.prisma.finance_jv_settlements.findMany({
      where,
      include: { lines: true },
      orderBy: { period_end: 'desc' },
    });
  }

  /**
   * Get detailed settlement with all lines.
   */
  async getSettlementDetail(tenantId: string, settlementId: string) {
    return this.prisma.finance_jv_settlements.findFirst({
      where: { id: settlementId, tenant_id: tenantId },
      include: { lines: true },
    });
  }
}
