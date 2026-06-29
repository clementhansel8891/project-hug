import { Injectable, Inject, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
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

export interface ProposeSplitDto {
  jv_profile_id: string;
  splits: { participant_tenant_id: string; revenue_share_pct: number; profit_share_pct: number }[];
}

export interface ConfirmSplitDto {
  jv_profile_id: string;
}

@Injectable()
export class JVSettlementService {
  private readonly logger = new Logger(JVSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('IJVRepository') private readonly jvRepo: IJVRepository,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // SPLIT CONFIGURATION — Must be agreed by both parties
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Propose or update the revenue/profit split percentages.
   * Resets confirmation status — both parties must confirm again.
   */
  async proposeSplit(tenantId: string, userId: string, dto: ProposeSplitDto) {
    const profile = await this.prisma.finance_jv_profiles.findFirst({
      where: { id: dto.jv_profile_id, is_active: true },
      include: { participants: true },
    });

    if (!profile) {
      throw new BadRequestException('JV Profile not found or inactive.');
    }

    // Validate total split doesn't exceed 100%
    const totalRevenue = dto.splits.reduce((s, sp) => s + sp.revenue_share_pct, 0);
    const totalProfit = dto.splits.reduce((s, sp) => s + sp.profit_share_pct, 0);
    if (totalRevenue > 100 || totalProfit > 100) {
      throw new BadRequestException('Total split percentages cannot exceed 100%.');
    }

    // Update each participant's split and reset confirmation
    for (const split of dto.splits) {
      const participant = profile.participants.find(p => p.participant_tenant_id === split.participant_tenant_id);
      if (participant) {
        await this.prisma.finance_jv_participants.update({
          where: { id: participant.id },
          data: {
            revenue_share_pct: new Prisma.Decimal(split.revenue_share_pct),
            profit_share_pct: new Prisma.Decimal(split.profit_share_pct),
            split_confirmed: false,
            split_confirmed_at: null,
            split_proposed_by: userId,
          },
        });
      }
    }

    this.logger.log(`Split proposed for profile ${dto.jv_profile_id} by user ${userId}`);
    return { success: true, message: 'Split proposed. All parties must confirm.' };
  }

  /**
   * Confirm the current split configuration.
   * Both host and partner must call this. Once all confirm, the split is active.
   */
  async confirmSplit(tenantId: string, userId: string, dto: ConfirmSplitDto) {
    const profile = await this.prisma.finance_jv_profiles.findFirst({
      where: { id: dto.jv_profile_id, is_active: true },
      include: { participants: true },
    });

    if (!profile) {
      throw new BadRequestException('JV Profile not found.');
    }

    // Find which participant this tenant belongs to
    const myParticipant = profile.participants.find(p => p.participant_tenant_id === tenantId);
    if (!myParticipant) {
      // Check if it's the host
      if (profile.tenant_id !== tenantId) {
        throw new ForbiddenException('You are not a participant in this JV.');
      }
      // Host confirming — mark the host's participant (OPERATOR) as confirmed
      const hostParticipant = profile.participants.find(p => p.role === 'OPERATOR');
      if (hostParticipant) {
        await this.prisma.finance_jv_participants.update({
          where: { id: hostParticipant.id },
          data: { split_confirmed: true, split_confirmed_at: new Date() },
        });
      }
    } else {
      // Partner confirming their own split
      await this.prisma.finance_jv_participants.update({
        where: { id: myParticipant.id },
        data: { split_confirmed: true, split_confirmed_at: new Date() },
      });
    }

    // Check if ALL participants have confirmed
    const updatedParticipants = await this.prisma.finance_jv_participants.findMany({
      where: { jv_profile_id: dto.jv_profile_id },
    });

    const allConfirmed = updatedParticipants.every(p => p.split_confirmed);

    return {
      success: true,
      all_confirmed: allConfirmed,
      confirmations: updatedParticipants.map(p => ({
        participant_tenant_id: p.participant_tenant_id,
        role: p.role,
        revenue_share_pct: Number(p.revenue_share_pct),
        profit_share_pct: Number(p.profit_share_pct),
        confirmed: p.split_confirmed,
        confirmed_at: p.split_confirmed_at,
      })),
    };
  }

  /**
   * Get the current split configuration status.
   */
  async getSplitStatus(profileId: string) {
    const participants = await this.prisma.finance_jv_participants.findMany({
      where: { jv_profile_id: profileId },
    });

    const allConfirmed = participants.every(p => p.split_confirmed);

    return {
      all_confirmed: allConfirmed,
      participants: participants.map(p => ({
        participant_tenant_id: p.participant_tenant_id,
        role: p.role,
        revenue_share_pct: Number(p.revenue_share_pct),
        profit_share_pct: Number(p.profit_share_pct),
        confirmed: p.split_confirmed,
        confirmed_at: p.split_confirmed_at,
        proposed_by: p.split_proposed_by,
      })),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTLEMENT GENERATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate a settlement for a JV profile covering a specific period.
   * 
   * Payout Formula per participant:
   *   Payout = (Net Profit Share from Shadow Ledger) − Party's Individual Expenses
   * 
   * Where Net Profit = Revenue - COGS (capital cost of each item sold).
   * The shadow ledger already contains profit-based allocations (not gross revenue),
   * so each party's share already excludes COGS.
   * 
   * Final payout = Their allocated profit share - expenses they individually submitted.
   * 
   * The split must be confirmed by both parties before a settlement can be generated.
   */
  async generateSettlement(tenantId: string, userId: string, dto: GenerateSettlementDto) {
    const profile = await this.prisma.finance_jv_profiles.findFirst({
      where: { id: dto.jv_profile_id, tenant_id: tenantId, is_active: true },
      include: { participants: true },
    });

    if (!profile) {
      throw new BadRequestException('JV Profile not found or you are not the host.');
    }

    // Verify split is confirmed by all parties
    const allSplitConfirmed = profile.participants.every((p: any) => p.split_confirmed);
    if (!allSplitConfirmed) {
      throw new BadRequestException(
        'Cannot generate settlement: revenue split has not been confirmed by all parties. ' +
        'Both host and partner must agree on the split percentages first.'
      );
    }

    const periodStart = new Date(dto.period_start);
    const periodEnd = new Date(dto.period_end);

    // 1. Calculate GROSS REVENUE for the JV branch in this period
    //    This comes from journal entries that hit the shadow ledger
    const ledgerEntries = await this.prisma.finance_jv_ledger.findMany({
      where: {
        tenant_id: tenantId,
        jv_profile_id: dto.jv_profile_id,
        created_at: { gte: periodStart, lte: periodEnd },
      },
    });

    // Compute gross revenue (sum of all REVENUE/PROFIT allocations across all participants)
    // Each participant already got their share written — sum all unique journal amounts
    const journalTotals = new Map<string, number>();
    for (const entry of ledgerEntries) {
      if (entry.type === 'REVENUE' || entry.type === 'PROFIT') {
        const existing = journalTotals.get(entry.line_id) || 0;
        journalTotals.set(entry.line_id, existing + Number(entry.allocated_amt));
      }
    }
    // Total allocated revenue = sum of all participant allocations
    const totalAllocatedRevenue = ledgerEntries
      .filter(e => e.type === 'REVENUE' || e.type === 'PROFIT')
      .reduce((sum, e) => sum + Number(e.allocated_amt), 0);

    // 2. Get INDIVIDUAL EXPENSES per party (approved expenses where they are the submitter)
    const approvedExpenses = await this.prisma.finance_jv_expenses.findMany({
      where: {
        tenant_id: tenantId,
        jv_profile_id: dto.jv_profile_id,
        status: 'APPROVED',
        expense_date: { gte: periodStart, lte: periodEnd },
      },
    });

    // Map expenses by submitter_tenant_id (individual expenses each party claimed)
    const individualExpensesByTenant = new Map<string, number>();
    for (const exp of approvedExpenses) {
      const current = individualExpensesByTenant.get(exp.submitter_tenant_id) || 0;
      individualExpensesByTenant.set(exp.submitter_tenant_id, current + Number(exp.amount));
    }

    // Also get expense allocations (how expenses are burden-shared)
    const expenseAllocations = await this.prisma.finance_jv_expense_allocations.findMany({
      where: {
        expense: {
          tenant_id: tenantId,
          jv_profile_id: dto.jv_profile_id,
          status: 'APPROVED',
          expense_date: { gte: periodStart, lte: periodEnd },
        },
      },
    });

    // Expense burden per participant (how much of ALL expenses is allocated to them)
    const expenseBurdenByTenant = new Map<string, number>();
    for (const alloc of expenseAllocations) {
      const current = expenseBurdenByTenant.get(alloc.tenant_id) || 0;
      expenseBurdenByTenant.set(alloc.tenant_id, current + Number(alloc.amount));
    }

    // 3. Calculate per-participant settlement
    //    Formula: Payout = Revenue Share - Individual Expenses (that party submitted)
    const settlement = await this.prisma.$transaction(async (tx) => {
      const settlementRecord = await tx.finance_jv_settlements.create({
        data: {
          tenant_id: tenantId,
          jv_profile_id: dto.jv_profile_id,
          period_start: periodStart,
          period_end: periodEnd,
          status: 'PENDING_CONFIRM', // Needs both parties to confirm
          generated_by: userId,
          host_confirmed: false,
          partner_confirmed: false,
        },
      });

      const lines: any[] = [];
      for (const p of profile.participants) {
        // Revenue allocated to this participant from shadow ledger
        const revenueAllocated = ledgerEntries
          .filter(e => e.participant_id === p.participant_tenant_id && (e.type === 'REVENUE' || e.type === 'PROFIT'))
          .reduce((sum, e) => sum + Number(e.allocated_amt), 0);

        // Cost burden from shadow ledger
        const costBurden = ledgerEntries
          .filter(e => e.participant_id === p.participant_tenant_id && e.type === 'COST')
          .reduce((sum, e) => sum + Number(e.allocated_amt), 0);

        // Individual expenses this party submitted
        const individualExpenses = individualExpensesByTenant.get(p.participant_tenant_id) || 0;

        // Shared expense burden allocated to this party
        const sharedExpenseBurden = expenseBurdenByTenant.get(p.participant_tenant_id) || 0;

        // Net Payout = Revenue Share - Cost Burden - Individual Expenses
        const netPayable = revenueAllocated - costBurden - individualExpenses;
        const direction = netPayable >= 0 ? 'RECEIVABLE' : 'PAYABLE';

        lines.push({
          settlement_id: settlementRecord.id,
          participant_id: p.id,
          participant_tenant_id: p.participant_tenant_id,
          revenue_allocated: new Prisma.Decimal(revenueAllocated.toFixed(4)),
          cost_burden: new Prisma.Decimal(costBurden.toFixed(4)),
          expenses_borne: new Prisma.Decimal(sharedExpenseBurden.toFixed(4)),
          individual_expenses: new Prisma.Decimal(individualExpenses.toFixed(4)),
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

  // ═══════════════════════════════════════════════════════════════════════════
  // DUAL CONFIRMATION — Both host and partner must confirm
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Confirm a settlement from one side (host or partner).
   * Once BOTH confirm, status moves to CONFIRMED.
   */
  async confirmSettlement(tenantId: string, confirmerId: string, callerTenantId: string, dto: ConfirmSettlementDto) {
    const settlement = await this.prisma.finance_jv_settlements.findFirst({
      where: {
        id: dto.settlement_id,
        tenant_id: tenantId,
        status: { in: ['DRAFT', 'PENDING_CONFIRM'] },
      },
      include: { lines: true },
    });

    if (!settlement) {
      throw new BadRequestException('Settlement not found or not in confirmable status.');
    }

    // Determine if caller is host or partner
    const profile = await this.prisma.finance_jv_profiles.findFirst({
      where: { id: settlement.jv_profile_id },
      include: { participants: true },
    });

    if (!profile) throw new BadRequestException('Profile not found.');

    const isHost = profile.tenant_id === callerTenantId;
    const isPartner = profile.participants.some(p => p.participant_tenant_id === callerTenantId && p.role !== 'OPERATOR');

    if (!isHost && !isPartner) {
      throw new ForbiddenException('You are not a participant in this JV.');
    }

    const updateData: any = { updated_at: new Date() };

    if (isHost) {
      if (settlement.host_confirmed) {
        throw new BadRequestException('Host has already confirmed this settlement.');
      }
      updateData.host_confirmed = true;
      updateData.host_confirmed_at = new Date();
      updateData.host_confirmed_by = confirmerId;
    } else {
      if (settlement.partner_confirmed) {
        throw new BadRequestException('Partner has already confirmed this settlement.');
      }
      updateData.partner_confirmed = true;
      updateData.partner_confirmed_at = new Date();
      updateData.partner_confirmed_by = confirmerId;
    }

    // Check if both have now confirmed
    const hostConfirmed = isHost ? true : settlement.host_confirmed;
    const partnerConfirmed = isPartner ? true : settlement.partner_confirmed;

    if (hostConfirmed && partnerConfirmed) {
      updateData.status = 'CONFIRMED';
      updateData.confirmed_by = confirmerId;
      updateData.confirmed_at = new Date();
    } else {
      updateData.status = 'PENDING_CONFIRM';
    }

    await this.prisma.finance_jv_settlements.update({
      where: { id: settlement.id },
      data: updateData,
    });

    return {
      settlement_id: settlement.id,
      status: updateData.status,
      host_confirmed: hostConfirmed,
      partner_confirmed: partnerConfirmed,
      fully_confirmed: hostConfirmed && partnerConfirmed,
    };
  }

  /**
   * Mark settlement as paid with payment reference.
   * Only allowed after BOTH parties confirmed.
   */
  async markPaid(tenantId: string, dto: MarkPaidDto) {
    const settlement = await this.prisma.finance_jv_settlements.findFirst({
      where: { id: dto.settlement_id, tenant_id: tenantId, status: 'CONFIRMED' },
    });

    if (!settlement) {
      throw new BadRequestException('Settlement not found or not fully confirmed by both parties.');
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
   * Dispute a settlement — either party disagrees with numbers.
   */
  async disputeSettlement(tenantId: string, dto: DisputeSettlementDto) {
    const settlement = await this.prisma.finance_jv_settlements.findFirst({
      where: { id: dto.settlement_id, tenant_id: tenantId, status: { in: ['DRAFT', 'PENDING_CONFIRM', 'CONFIRMED'] } },
    });

    if (!settlement) {
      throw new BadRequestException('Settlement not found or already finalized.');
    }

    await this.prisma.finance_jv_settlements.update({
      where: { id: settlement.id },
      data: {
        status: 'DISPUTED',
        notes: dto.notes,
        // Reset confirmations on dispute
        host_confirmed: false,
        partner_confirmed: false,
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
