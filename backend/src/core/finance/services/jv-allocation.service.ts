import { Injectable, Inject, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IJVRepository } from '../repositories/interfaces/jv.repository.interface';
import { JVParticipantRole } from '../domain/finance.constants';

@Injectable()
export class JVAllocationService {
  private readonly logger = new Logger(JVAllocationService.name);

  constructor(
    @Inject('IJVRepository')
    private readonly jvRepo: IJVRepository
  ) {}

  /**
   * Main entry point for JV allocation hook.
   * Resolves scope, locks config, freezes snapshot, and writes shadow ledger.
   * 
   * Allocation logic:
   * - If journal has metadata.net_profit → split NET PROFIT (revenue - COGS)
   * - Otherwise fall back to splitting individual journal line amounts
   * 
   * This ensures the JV split is on PURE PROFIT after capital/COGS, not gross revenue.
   */
  async allocate(tenant_id: string, journalEntry: any, lines: any[], tx?: Prisma.TransactionClient): Promise<void> {
    try {
      // 1. Resolve Scope Precedence
      const scope = {
        ecommerce_id: journalEntry.metadata?.ecommerce_id,
        branch_id: lines[0]?.branch_id || journalEntry.metadata?.branch_id,
        company_id: journalEntry.company_id
      };

      const profile = await this.jvRepo.findProfileByScope(tenant_id, scope);
      if (!profile) {
        this.logger.debug(`No JV profile resolved for journal ${journalEntry.id} in scope ${JSON.stringify(scope)}`);
        return;
      }

      // 1b. Check Date Eligibility (Mid-Month Strategy)
      const journalDate = new Date(journalEntry.posting_date || journalEntry.created_at || new Date());
      const effectiveFrom = new Date(profile.effective_from);
      const effectiveTo = profile.effective_to ? new Date(profile.effective_to) : null;

      if (journalDate < effectiveFrom) {
        this.logger.debug(`Journal ${journalEntry.id} date is before JV profile ${profile.code} activation.`);
        return;
      }

      if (effectiveTo && journalDate > effectiveTo) {
        this.logger.debug(`Journal ${journalEntry.id} date is after JV profile ${profile.code} expiration.`);
        return;
      }

      // 2. Lock Configuration (Fetch Participants)
      const participants = await this.jvRepo.getParticipants(profile.id);
      if (participants.length === 0) {
        this.logger.warn(`JV profile ${profile.code} (v${profile.version}) has no participants.`);
        return;
      }

      // 3. Freeze Snapshot (Immutable Audit)
      await this.jvRepo.createSnapshot({
        jv_profile_id: profile.id,
        journal_id: journalEntry.id,
        config_json: {
          profile,
          participants,
          metadata: journalEntry.metadata,
        }
      }, tx);

      // 4. Write Shadow Ledger Distribution
      const shadowEntries: any[] = [];

      // Check if we have net_profit metadata (from POS with COGS calculation)
      const netProfit = journalEntry.metadata?.net_profit;

      if (netProfit !== undefined && netProfit !== null) {
        // ─── NET PROFIT MODE ───
        // Split the pure profit (revenue - COGS) among participants
        // This ensures capital/cost-of-goods is excluded from the split
        for (const participant of participants) {
          const sharePct = Number(participant.profit_share_pct || participant.revenue_share_pct || 0);
          const allocatedAmt = (netProfit * sharePct) / 100;

          shadowEntries.push({
            tenant_id,
            jv_profile_id: profile.id,
            journal_id: journalEntry.id,
            line_id: `profit-${participant.id}`,
            participant_id: participant.participant_tenant_id,
            allocated_amt: new Prisma.Decimal(allocatedAmt.toFixed(4)),
            side: 'CREDIT',
            account_code: '4000',
            type: 'PROFIT',
            period_id: journalEntry.period_id || journalEntry.fiscal_period_id || journalEntry.finance_journal_lines?.[0]?.id
          });
        }

        // Also record the COGS as a cost entry for reporting
        if (journalEntry.metadata?.total_cogs > 0) {
          shadowEntries.push({
            tenant_id,
            jv_profile_id: profile.id,
            journal_id: journalEntry.id,
            line_id: `cogs-${journalEntry.id}`,
            participant_id: tenant_id, // COGS stays with host
            allocated_amt: new Prisma.Decimal(Number(journalEntry.metadata.total_cogs).toFixed(4)),
            side: 'DEBIT',
            account_code: '5000',
            type: 'COST',
            period_id: journalEntry.period_id || journalEntry.fiscal_period_id || journalEntry.finance_journal_lines?.[0]?.id
          });
        }
      } else {
        // ─── LEGACY LINE-BY-LINE MODE ───
        // For journal entries without COGS metadata (non-POS sources),
        // split each line by revenue share
        for (const line of lines) {
          for (const participant of participants) {
            const sharePct = participant.revenue_share_pct || participant.profit_share_pct || 0;
            const lineAmount = line.amount || line.debit || line.credit || 0;
            const allocatedAmt = typeof lineAmount === 'object' && lineAmount.mul
              ? lineAmount.mul(sharePct).div(100)
              : new Prisma.Decimal(((Number(lineAmount) * Number(sharePct)) / 100).toFixed(4));

            shadowEntries.push({
              tenant_id,
              jv_profile_id: profile.id,
              journal_id: journalEntry.id,
              line_id: line.id,
              participant_id: participant.participant_tenant_id,
              allocated_amt: allocatedAmt,
              side: line.side,
              account_code: line.account_code || line.accountCode,
              type: 'REVENUE',
              period_id: journalEntry.period_id || journalEntry.fiscal_period_id
            });
          }
        }
      }

      await this.jvRepo.writeLedger(shadowEntries, tx);
      this.logger.log(`Successfully allocated JV for journal ${journalEntry.id} via profile ${profile.code} (mode: ${netProfit !== undefined ? 'NET_PROFIT' : 'LINE_BY_LINE'})`);
    } catch (error) {
      this.logger.error(`JV Allocation Failed for journal ${journalEntry.id}: ${error.message}`, error.stack);
      throw error; 
    }
  }
}
