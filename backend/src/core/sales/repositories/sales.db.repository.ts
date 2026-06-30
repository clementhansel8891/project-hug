import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { BadRequestException } from "../../_shared";
import {
  ISalesRepository,
  SalesDashboard,
  SalesManagerMetrics,
  SalesExecutiveForecast,
  SalesNextAction,
} from "./sales.repository.interface";
import { TenantScope } from "../../../shared/scope/tenant-scope";
import { MultiTenancyUtil } from "../../../shared/utils/multi-tenancy.util";
import { PrismaService } from "../../../persistence/prisma.service";
import { SalesLead } from "../entities/sales-lead.entity";
import { SalesOpportunity } from "../entities/sales-opportunity.entity";
import { SalesOrder } from "../entities/sales-order.entity";
import { SalesQuote } from "../entities/sales-quote.entity";
import { SalesTask } from "../entities/sales-task.entity";
import { SalesTimelineEvent } from "../entities/sales-timeline-event.entity";
import { SalesAlert } from "../entities/sales-alert.entity";
import { SalesAuditEvent } from "../entities/sales-audit.entity";
import { CreateLeadDto } from "../dto/create-lead.dto";
import { UpdateLeadStatusDto } from "../dto/update-lead-status.dto";
import { CreateOpportunityDto } from "../dto/create-opportunity.dto";
import { MoveOpportunityStageDto } from "../dto/move-opportunity-stage.dto";
import { CloseOpportunityDto } from "../dto/close-opportunity.dto";
import { CreateQuoteDto } from "../dto/create-quote.dto";
import { QuoteDecisionDto } from "../dto/quote-decision.dto";
import { CreateTimelineEventDto } from "../dto/create-timeline-event.dto";
import { CreateTaskDto } from "../dto/create-task.dto";
import { defineFieldMap } from "../../common";

/**
 * Explicit, schema-aligned writable columns and DTO-to-column mappers for the
 * Sales tables (`prisma/schema.prisma`). Each create/update path binds DTO
 * field values to their single corresponding snake_case column through these
 * deterministic mappers (Task 1.4 field-mapping discipline). A supplied field
 * that resolves to no known column rejects the whole request with
 * `UnresolvedFieldError` (HTTP 400) before any write, so nothing is persisted
 * (Requirements 5.1–5.4, 10.2).
 *
 * Server-managed columns (`id`, `created_at`, `updated_at` — all carry schema
 * `@default` values), the always-context-derived scope (`tenant_id`,
 * `company_id`), and derived/defaulted values (status, version, net_amount,
 * sla/close dates, the actor-derived owner) are bound explicitly by the
 * repository rather than spread from the DTO. Transient DTO fields that carry no
 * column on the target table (`validDays`, `dueAt` — handled explicitly) are
 * declared in `ignore` so they are dropped rather than rejected.
 */

/** `sales_leads` writable columns. */
const LEAD_COLUMNS = [
  "company_name",
  "contact_name",
  "contact_email",
  "contact_phone",
  "source",
  "owner_id",
  "owner_name",
  "score",
  "potential_value",
  "currency",
  "priority",
  "status",
  "sla_due_at",
  "first_response_at",
  "company_id",
  "contact_id",
] as const;
const mapLeadToColumns = defineFieldMap({ columns: LEAD_COLUMNS });

/** `sales_opportunities` writable columns. */
const OPPORTUNITY_COLUMNS = [
  "lead_id",
  "account_name",
  "owner_id",
  "owner_name",
  "stage",
  "probability",
  "amount",
  "currency",
  "expected_close_date",
  "health",
  "next_action",
  "last_activity_at",
  "company_id",
] as const;
const mapOpportunityToColumns = defineFieldMap({ columns: OPPORTUNITY_COLUMNS });

/** `sales_quotes` writable columns. `validDays` is transient (computes valid_until). */
const QUOTE_COLUMNS = [
  "opportunity_id",
  "account_name",
  "version",
  "amount",
  "discount_percent",
  "net_amount",
  "currency",
  "status",
  "valid_until",
  "approval_by",
  "approval_at",
  "notes",
  "created_by",
  "company_id",
] as const;
const mapQuoteToColumns = defineFieldMap({
  columns: QUOTE_COLUMNS,
  ignore: ["validDays"],
});

/** `sales_timeline_events` writable columns. */
const TIMELINE_EVENT_COLUMNS = [
  "opportunity_id",
  "lead_id",
  "channel",
  "direction",
  "summary",
  "detail",
  "created_by",
  "company_id",
] as const;
const mapTimelineEventToColumns = defineFieldMap({
  columns: TIMELINE_EVENT_COLUMNS,
});

/** `sales_tasks` writable columns. `dueAt` is mapped explicitly to a Date. */
const TASK_COLUMNS = [
  "opportunity_id",
  "lead_id",
  "title",
  "owner_id",
  "owner_name",
  "status",
  "priority",
  "due_at",
  "completed_at",
  "company_id",
] as const;
const mapTaskToColumns = defineFieldMap({
  columns: TASK_COLUMNS,
  ignore: ["dueAt"],
});

/** Fallback owner/actor when no verified `user_id` is threaded through. */
const UNASSIGNED_ACTOR = "UNASSIGNED";

/**
 * Sales_Pipeline transition guards (Requirements 10.3, 10.4, 10.5, 10.6, 4.6,
 * 4.7).
 *
 * The persisted opportunity `stage` and quote `status` columns use upper-snake
 * values (`NEW`, `CONTACTED`, …, `CLOSED_WON`; `DRAFT`, `PENDING_APPROVAL`,
 * `APPROVED`, `REJECTED`). The DTOs accept the lower-case forms, so every
 * transition normalises both the CURRENT state (read inside the
 * Atomic_Operation BEFORE any write) and the requested target through
 * {@link normState} before validating. An illegal transition is rejected with a
 * `BadRequestException` that names the current and target state, and because the
 * throw happens before any write nothing is persisted and the entity is left
 * unchanged (Requirements 10.6, 4.7).
 */

/** Ordered open opportunity stages; closing is handled by `closeOpportunity`. */
const OPPORTUNITY_OPEN_STAGES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
] as const;
/** Terminal opportunity stages — no further stage move is legal from these. */
const OPPORTUNITY_TERMINAL_STAGES = new Set(["CLOSED_WON", "CLOSED_LOST"]);
/** A lead may be converted only while it is neither converted nor disqualified. */
const LEAD_UNCONVERTIBLE_STATES = new Set(["CONVERTED", "DISQUALIFIED"]);
/** A quote may be submitted for approval only from these states. */
const QUOTE_SUBMITTABLE_STATES = new Set(["DRAFT", "REJECTED"]);
/** A quote decision is legal only while the quote is pending approval. */
const QUOTE_DECIDABLE_STATES = new Set(["PENDING_APPROVAL"]);

/** Normalise a persisted/requested state value to its canonical upper form. */
function normState(value: unknown): string {
  return String(value ?? "").toUpperCase();
}

/**
 * Build the standard invalid-transition error naming the entity, its current
 * state, and the rejected target state (Requirement 10.6).
 */
function invalidSalesTransition(
  entity: string,
  id: string,
  current: string,
  target: string,
): BadRequestException {
  return new BadRequestException(
    `Invalid Sales_Pipeline transition for ${entity} '${id}': ` +
      `cannot transition from '${current}' to '${target}'.`,
  );
}

@Injectable()
export class SalesDbRepository implements ISalesRepository {
  private readonly logger = new Logger(SalesDbRepository.name);
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(ctx: TenantScope): Promise<SalesDashboard> {
    const scope = MultiTenancyUtil.getScope(ctx);
    this.logger.log(`[getDashboard] tenant=${ctx.tenant_id} company=${ctx.company_id}`);
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [leads, opportunities, quotes, alerts, followUps] = await Promise.all([
        this.prisma.sales_leads.count({ 
          where: { ...scope, status: "NEW" } 
        }),
        this.prisma.sales_opportunities.findMany({ 
          where: { ...scope, stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } } 
        }),
        this.prisma.sales_quotes.count({
          where: { ...scope, status: "PENDING_APPROVAL" },
        }),
        this.prisma.sales_alerts.count({
          where: { ...scope, acknowledged: false },
        }),
        this.prisma.sales_tasks.count({
          where: { ...scope, status: { not: "COMPLETED" }, due_at: { lt: now } }
        })
      ]);

      const slaDueToday = await this.prisma.sales_leads.count({
        where: { ...scope, sla_due_at: { gte: startOfToday, lt: new Date(startOfToday.getTime() + 86400000) } }
      });

      const pipelineValue = opportunities.reduce(
        (sum: number, op: any) => sum + Number(op.amount),
        0,
      );
      const weightedValue = opportunities.reduce(
        (sum: number, op: any) => sum + Number(op.amount) * (op.probability / 100),
        0,
      );

      return {
        openLeads: leads,
        slaDueToday,
        overdueFollowUps: followUps,
        openOpportunities: opportunities.length,
        pipelineValue,
        weightedPipelineValue: Math.round(weightedValue),
        pendingQuoteApprovals: quotes,
        dealRiskCount: alerts,
      };
    } catch (err) {
      this.logger.error(
        `[getDashboard] Failed for tenant=${ctx.tenant_id}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }

  async getManagerMetrics(ctx: TenantScope): Promise<SalesManagerMetrics> {
    const scope = MultiTenancyUtil.getScope(ctx);
    const opportunities = await this.prisma.sales_opportunities.findMany({
      where: { ...scope, stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } },
    });

    const reps = await this.prisma.sales_opportunities.groupBy({
      by: ['owner_id'],
      where: scope,
      _count: true
    });

    const stalledCount = await this.prisma.sales_opportunities.count({
      where: { 
        ...scope, 
        stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
        updated_at: { lt: new Date(Date.now() - 72 * 60 * 60 * 1000) } // 72h no activity
      }
    });

    const breaches = await this.prisma.sales_alerts.count({
      where: { ...scope, type: "lead_sla_breach", acknowledged: false }
    });

    const quotes = await this.prisma.sales_quotes.count({
      where: { ...scope, status: "PENDING_APPROVAL" }
    });

    return {
      totalReps: reps.length,
      openPipeline: opportunities.reduce(
        (sum: number, op: any) => sum + Number(op.amount),
        0,
      ),
      weightedForecast: Math.round(opportunities.reduce(
        (sum: number, op: any) => sum + Number(op.amount) * (op.probability / 100),
        0,
      )),
      stalledDeals: stalledCount,
      slaBreaches: breaches,
      approvalsPending: quotes,
    };
  }

  async getExecutiveForecast(ctx: TenantScope): Promise<SalesExecutiveForecast> {
    const scope = MultiTenancyUtil.getScope(ctx);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);

    const [openOpps, closedOpps] = await Promise.all([
      this.prisma.sales_opportunities.findMany({
        where: { ...scope, stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } }
      }),
      this.prisma.sales_opportunities.findMany({
        where: { ...scope, stage: { in: ["CLOSED_WON", "CLOSED_LOST"] }, updated_at: { gte: startOfMonth } }
      })
    ]);

    const wonThisPeriod = closedOpps
      .filter(o => o.stage === "CLOSED_WON")
      .reduce((sum, o) => sum + Number(o.amount), 0);

    const lostThisPeriod = closedOpps
      .filter(o => o.stage === "CLOSED_LOST")
      .reduce((sum, o) => sum + Number(o.amount), 0);

    const wonCount = closedOpps.filter(o => o.stage === "CLOSED_WON").length;
    const closedCount = closedOpps.length;
    const conversionRate = closedCount > 0 ? (wonCount / closedCount) * 100 : 0;

    const weightedValue = openOpps.reduce(
      (sum, op) => sum + Number(op.amount) * (op.probability / 100),
      0
    );

    // Avg Deal Cycle calculation (for won deals)
    const wonDealsHistory = await this.prisma.sales_opportunities.findMany({
      where: { ...scope, stage: "CLOSED_WON" },
      select: { created_at: true, updated_at: true }
    });

    let totalDays = 0;
    wonDealsHistory.forEach(d => {
      totalDays += (d.updated_at.getTime() - d.created_at.getTime()) / (1000 * 60 * 60 * 24);
    });
    const avgCycle = wonDealsHistory.length > 0 ? totalDays / wonDealsHistory.length : 0;

    return {
      openPipelineValue: openOpps.reduce((sum, o) => sum + Number(o.amount), 0),
      weightedForecastValue: Math.round(weightedValue),
      wonThisPeriod,
      lostThisPeriod,
      conversionRate: Math.round(conversionRate),
      avgDealCycleDays: Math.round(avgCycle),
      forecastAccuracy: 0, // Needs historical baseline to calculate
    };
  }

  async getNextBestActions(ctx: TenantScope): Promise<any[]> {
    return [];
  }

  async getSalesAnalytics(ctx: TenantScope): Promise<any> {
    const scope = MultiTenancyUtil.getScope(ctx);
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);

    const orders = await this.prisma.sales_orders.findMany({
      where: { ...scope, created_at: { gte: startOfYear } },
      select: { amount: true, created_at: true }
    });

    const revenueByMonth = Array(12).fill(0);
    orders.forEach(o => {
      const month = o.created_at.getMonth();
      revenueByMonth[month] += Number(o.amount);
    });

    const topReps = await this.prisma.sales_opportunities.groupBy({
      by: ['owner_name'],
      where: { ...scope, stage: "CLOSED_WON" },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5
    });

    return {
      revenueByMonth: revenueByMonth.map((val, idx) => ({ 
        month: new Date(0, idx).toLocaleString('default', { month: 'short' }),
        revenue: val 
      })),
      topReps: topReps.map(r => ({ name: r.owner_name, total: r._sum.amount }))
    };
  }

  async getForecast(ctx: TenantScope): Promise<any> {
    const scope = MultiTenancyUtil.getScope(ctx);
    const now = new Date();
    
    const openOpps = await this.prisma.sales_opportunities.findMany({
      where: { 
        ...scope, 
        stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
        expected_close_date: { gte: now }
      },
      select: { amount: true, probability: true, expected_close_date: true }
    });

    // Project 6 months forward
    const projections = Array(6).fill(0).map((_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      return {
        month: date.toLocaleString('default', { month: 'short' }),
        year: date.getFullYear(),
        weighted: 0,
        commit: 0
      };
    });

    openOpps.forEach(op => {
      const monthDiff = (op.expected_close_date.getFullYear() - now.getFullYear()) * 12 + 
                        (op.expected_close_date.getMonth() - now.getMonth());
      if (monthDiff >= 0 && monthDiff < 6) {
        projections[monthDiff].weighted += Number(op.amount) * (op.probability / 100);
        if (op.probability >= 80) {
          projections[monthDiff].commit += Number(op.amount);
        }
      }
    });

    return projections;
  }

  async getPipelineVelocity(ctx: TenantScope): Promise<any> {
    return {};
  }

  async getSLAPerformance(ctx: TenantScope): Promise<any> {
    return {};
  }

  async getPipeline(ctx: TenantScope): Promise<any[]> {
    const scope = MultiTenancyUtil.getScope(ctx);
    this.logger.log(`[getPipeline] tenant=${ctx.tenant_id} company=${ctx.company_id}`);
    try {
      const STAGE_ORDER = [
        "NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION",
        "CLOSED_WON", "CLOSED_LOST",
      ];

      const opportunities = await this.prisma.sales_opportunities.findMany({
        where: scope,
        select: { stage: true, amount: true, probability: true },
      });

      // Aggregate by stage
      const stageMap: Record<string, { count: number; totalAmount: number; weightedAmount: number }> = {};
      for (const op of opportunities) {
        const stage = op.stage;
        if (!stageMap[stage]) {
          stageMap[stage] = { count: 0, totalAmount: 0, weightedAmount: 0 };
        }
        stageMap[stage].count += 1;
        stageMap[stage].totalAmount += Number(op.amount);
        stageMap[stage].weightedAmount += Number(op.amount) * (op.probability / 100);
      }

      // Return sorted by defined stage order, then any unknown stages alphabetically
      const result = STAGE_ORDER
        .filter((s) => stageMap[s])
        .map((stage) => ({
          stage,
          count: stageMap[stage].count,
          totalAmount: Math.round(stageMap[stage].totalAmount),
          weightedAmount: Math.round(stageMap[stage].weightedAmount),
        }));

      // Append any stages not in STAGE_ORDER
      const unknownStages = Object.keys(stageMap).filter((s) => !STAGE_ORDER.includes(s));
      unknownStages.sort().forEach((stage) => {
        result.push({
          stage,
          count: stageMap[stage].count,
          totalAmount: Math.round(stageMap[stage].totalAmount),
          weightedAmount: Math.round(stageMap[stage].weightedAmount),
        });
      });

      return result;
    } catch (err) {
      this.logger.error(
        `[getPipeline] Failed for tenant=${ctx.tenant_id}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }

  async getLeads(ctx: TenantScope): Promise<SalesLead[]> {
    return this.prisma.sales_leads.findMany({ where: MultiTenancyUtil.getScope(ctx) }) as any;
  }

  async createLead(
    ctx: TenantScope,
    dto: CreateLeadDto,
    user_id?: string,
    tx?: any,
  ): Promise<SalesLead> {
    // Explicit DTO-to-column mapping; an unresolved field rejects the whole
    // request before any write, persisting nothing (Req 5.1–5.4, 10.2).
    const data: Record<string, any> = {
      tenant_id: ctx.tenant_id,
      company_id: ctx.company_id ?? null,
      ...mapLeadToColumns(dto as unknown as Record<string, unknown>),
    };
    // Required schema columns absent from the DTO: owner is the verified actor
    // (Req 2.10), with a 24h SLA default.
    data.owner_id = data.owner_id ?? user_id ?? UNASSIGNED_ACTOR;
    data.owner_name = data.owner_name ?? user_id ?? UNASSIGNED_ACTOR;
    data.sla_due_at =
      data.sla_due_at ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
    return (tx || this.prisma).sales_leads.create({ data }) as any;
  }

  async updateLeadStatus(ctx: TenantScope,
    lead_id: string,
    dto: UpdateLeadStatusDto,
  ): Promise<SalesLead> {
    // Composite-key read so a lead owned by another tenant surfaces as not-found
    // rather than being mutated cross-tenant (Req 2.9, 4.5).
    const existing = await this.prisma.sales_leads.findFirst({
      where: { id: lead_id, tenant_id: ctx.tenant_id },
    });
    if (!existing) throw new NotFoundException("Lead not found");
    return this.prisma.sales_leads.update({
      where: { id: lead_id },
      data: { status: dto.status },
    }) as any;
  }

  async convertLead(ctx: TenantScope,
    lead_id: string,
    actor_id: string,
    tx?: any,
  ): Promise<SalesOpportunity> {
    const client = tx ?? this.prisma;
    // Composite-key read: resolve the lead by id AND tenant_id so a lead owned
    // by another tenant surfaces as not-found rather than leaking across tenant
    // boundaries (Requirements 2.1, 4.5). Read inside the Atomic_Operation
    // BEFORE any write.
    const lead = await client.sales_leads.findFirst({
      where: { id: lead_id, tenant_id: ctx.tenant_id },
    });
    if (!lead) throw new NotFoundException("Lead not found");

    // Validate the conversion against the lead's CURRENT status: a lead that is
    // already converted (or disqualified) cannot be converted again. An invalid
    // transition is rejected naming current+target, leaving the lead unchanged
    // (Requirements 10.5, 10.6).
    const current = normState(lead.status);
    if (LEAD_UNCONVERTIBLE_STATES.has(current)) {
      throw invalidSalesTransition("lead", lead_id, current, "CONVERTED");
    }

    // Create the opportunity AND mark the lead converted on the SAME transaction
    // client so both commit together or neither is persisted; any failure here
    // rolls both back, leaving the lead unconverted (Requirements 10.3, 10.4).
    const opportunity = await client.sales_opportunities.create({
      data: {
        ...MultiTenancyUtil.getScope(ctx),
        lead_id: lead_id,
        account_name: lead.company_name,
        owner_id: lead.owner_id,
        owner_name: lead.owner_name,
        stage: "QUALIFIED",
        amount: lead.potential_value,
        currency: lead.currency,
        expected_close_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await client.sales_leads.update({
      where: { id: lead_id },
      data: { status: "CONVERTED" },
    });
    return opportunity as any;
  }

  async getOpportunities(ctx: TenantScope): Promise<SalesOpportunity[]> {
    return this.prisma.sales_opportunities.findMany({
      where: MultiTenancyUtil.getScope(ctx),
    }) as any;
  }

  async createOpportunity(ctx: TenantScope,
    dto: CreateOpportunityDto,
    user_id?: string,
    tx?: any
  ): Promise<SalesOpportunity> {
    // Explicit DTO-to-column mapping; `nextAction` resolves to `next_action`.
    // An unresolved field rejects the whole request before any write (Req 5.x).
    const data: Record<string, any> = {
      tenant_id: ctx.tenant_id,
      company_id: ctx.company_id ?? null,
      ...mapOpportunityToColumns(dto as unknown as Record<string, unknown>),
    };
    // Required schema columns absent from the DTO: owner defaults to the
    // verified actor (Req 2.10); a 30-day expected close as a sensible default.
    data.owner_id = data.owner_id ?? user_id ?? UNASSIGNED_ACTOR;
    data.owner_name = data.owner_name ?? user_id ?? UNASSIGNED_ACTOR;
    data.expected_close_date =
      data.expected_close_date ??
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return (tx || this.prisma).sales_opportunities.create({ data }) as any;
  }

  async moveOpportunityStage(ctx: TenantScope,
    opportunityId: string,
    dto: MoveOpportunityStageDto,
    tx?: any,
  ): Promise<SalesOpportunity> {
    const client = tx ?? this.prisma;
    // Read the CURRENT state inside the Atomic_Operation, scoped by tenant_id,
    // BEFORE any write (Requirements 10.5, 10.6, 4.6, 4.7).
    const existing = await client.sales_opportunities.findFirst({
      where: { id: opportunityId, ...MultiTenancyUtil.getScope(ctx) },
    });
    if (!existing) throw new NotFoundException("Opportunity not found");

    const current = normState(existing.stage);
    const target = normState(dto.stage);

    // Closing an opportunity (CLOSED_WON/CLOSED_LOST) is performed by
    // `closeOpportunity`, which also writes the resulting order; a stage move to
    // a terminal stage is therefore rejected.
    if (OPPORTUNITY_TERMINAL_STAGES.has(target)) {
      throw invalidSalesTransition(
        "opportunity",
        opportunityId,
        current,
        target,
      );
    }

    // A stage move is legal only as a forward progression between known open
    // stages (NEW → CONTACTED → … → NEGOTIATION). A move from a terminal stage,
    // to/from an unknown stage, or backward/in-place is rejected.
    const fromIndex = OPPORTUNITY_OPEN_STAGES.indexOf(current as any);
    const targetIndex = OPPORTUNITY_OPEN_STAGES.indexOf(target as any);
    if (fromIndex === -1 || targetIndex === -1 || targetIndex <= fromIndex) {
      throw invalidSalesTransition(
        "opportunity",
        opportunityId,
        current,
        target,
      );
    }

    return client.sales_opportunities.update({
      where: { id: opportunityId },
      data: { stage: target, last_activity_at: new Date() },
    }) as any;
  }

  async closeOpportunity(ctx: TenantScope,
    opportunityId: string,
    dto: CloseOpportunityDto,
    tx?: any,
  ): Promise<SalesOpportunity | SalesOrder> {
    const client = tx ?? this.prisma;
    // Read the CURRENT state inside the Atomic_Operation, scoped by tenant_id,
    // BEFORE any write (Requirements 10.5, 10.6, 4.6, 4.7).
    const existing = await client.sales_opportunities.findFirst({
      where: { id: opportunityId, ...MultiTenancyUtil.getScope(ctx) },
    });
    if (!existing) throw new NotFoundException("Opportunity not found");

    const current = normState(existing.stage);
    const target = dto.result === "won" ? "CLOSED_WON" : "CLOSED_LOST";

    // An opportunity can be closed only from an open (non-terminal) stage; a
    // second close is rejected naming current+target, leaving it unchanged.
    if (OPPORTUNITY_TERMINAL_STAGES.has(current)) {
      throw invalidSalesTransition(
        "opportunity",
        opportunityId,
        current,
        target,
      );
    }

    const result = await client.sales_opportunities.update({
      where: { id: opportunityId },
      data: { stage: target },
    });

    if (dto.result === "won") {
      // The won opportunity and its resulting order are written on the same
      // transaction client so both commit or neither (Requirement 10.5).
      return client.sales_orders.create({
        data: {
          ...MultiTenancyUtil.getScope(ctx),
          opportunity_id: opportunityId,
          customer_name: result.account_name,
          amount: result.amount,
          currency: result.currency,
          created_by: dto.actor_id || "system",
        },
      }) as any;
    }
    return result as any;
  }

  async getQuotes(ctx: TenantScope): Promise<SalesQuote[]> {
    return this.prisma.sales_quotes.findMany({ where: MultiTenancyUtil.getScope(ctx) }) as any;
  }

  async createQuote(ctx: TenantScope,
    dto: CreateQuoteDto,
    user_id?: string,
  ): Promise<SalesQuote> {
    // Composite-key read of the parent opportunity within scope so a quote can
    // only be created against an in-scope opportunity (Req 2.1, 4.5).
    const opportunity = await this.prisma.sales_opportunities.findFirst({
      where: { id: dto.opportunityId, tenant_id: ctx.tenant_id },
    });
    if (!opportunity) throw new NotFoundException("Opportunity not found");

    // Explicit DTO-to-column mapping; `opportunityId`→`opportunity_id`,
    // `discountPercent`→`discount_percent`, `createdBy`→`created_by`. `validDays`
    // is transient (ignored) and used to derive `valid_until`.
    const amount = Number(dto.amount);
    const discount = Math.max(0, Math.min(100, Number(dto.discountPercent ?? 0)));
    const data: Record<string, any> = {
      tenant_id: ctx.tenant_id,
      company_id: ctx.company_id ?? opportunity.company_id ?? null,
      ...mapQuoteToColumns(dto as unknown as Record<string, unknown>),
    };
    // Derived/required columns bound explicitly (Req 5.1).
    data.account_name = opportunity.account_name;
    data.currency = data.currency ?? opportunity.currency;
    data.net_amount = Math.max(0, amount - amount * (discount / 100));
    data.valid_until = new Date(
      Date.now() + (dto.validDays ?? 14) * 24 * 60 * 60 * 1000,
    );
    data.created_by = data.created_by ?? user_id ?? UNASSIGNED_ACTOR;
    return this.prisma.sales_quotes.create({ data: data as any }) as any;
  }

  async submitQuote(ctx: TenantScope, quoteId: string, tx?: any): Promise<SalesQuote> {
    const client = tx ?? this.prisma;
    // Read the CURRENT state inside the Atomic_Operation, scoped by tenant_id,
    // BEFORE any write (Requirements 10.5, 10.6, 4.6, 4.7).
    const quote = await client.sales_quotes.findFirst({
      where: { id: quoteId, tenant_id: ctx.tenant_id },
    });
    if (!quote) throw new NotFoundException("Quote not found");

    const current = normState(quote.status);
    if (!QUOTE_SUBMITTABLE_STATES.has(current)) {
      throw invalidSalesTransition("quote", quoteId, current, "PENDING_APPROVAL");
    }

    return client.sales_quotes.update({
      where: { id: quoteId },
      data: { status: "PENDING_APPROVAL" },
    }) as any;
  }

  async decideQuote(ctx: TenantScope,
    quoteId: string,
    dto: QuoteDecisionDto,
    tx?: any,
  ): Promise<SalesQuote> {
    const client = tx ?? this.prisma;
    // Read the CURRENT state inside the Atomic_Operation, scoped by tenant_id,
    // BEFORE any write (Requirements 10.5, 10.6, 4.6, 4.7).
    const quote = await client.sales_quotes.findFirst({
      where: { id: quoteId, tenant_id: ctx.tenant_id },
    });
    if (!quote) throw new NotFoundException("Quote not found");

    const current = normState(quote.status);
    const target = dto.approved ? "APPROVED" : "REJECTED";
    // A decision is legal only while the quote is pending approval; deciding a
    // draft/already-decided quote is rejected, leaving it unchanged.
    if (!QUOTE_DECIDABLE_STATES.has(current)) {
      throw invalidSalesTransition("quote", quoteId, current, target);
    }

    return client.sales_quotes.update({
      where: { id: quoteId },
      data: {
        status: target,
        approval_by: dto.decidedBy ?? "manager",
        approval_at: new Date(),
      },
    }) as any;
  }

  async getTimeline(ctx: TenantScope): Promise<SalesTimelineEvent[]> {
    return this.prisma.sales_timeline_events.findMany({
      where: MultiTenancyUtil.getScope(ctx),
    }) as any;
  }

  async createTimelineEvent(ctx: TenantScope,
    dto: CreateTimelineEventDto,
    user_id?: string,
  ): Promise<SalesTimelineEvent> {
    // Explicit DTO-to-column mapping; `opportunityId`→`opportunity_id`,
    // `createdBy`→`created_by`. Unresolved fields are rejected (Req 5.x).
    const data: Record<string, any> = {
      tenant_id: ctx.tenant_id,
      company_id: ctx.company_id ?? null,
      ...mapTimelineEventToColumns(dto as unknown as Record<string, unknown>),
    };
    data.created_by = data.created_by ?? user_id ?? UNASSIGNED_ACTOR;
    return this.prisma.sales_timeline_events.create({ data: data as any }) as any;
  }

  async getTasks(ctx: TenantScope): Promise<SalesTask[]> {
    return this.prisma.sales_tasks.findMany({ where: MultiTenancyUtil.getScope(ctx) }) as any;
  }

  async createTask(
    ctx: TenantScope,
    dto: CreateTaskDto,
    user_id?: string,
  ): Promise<SalesTask> {
    // Explicit DTO-to-column mapping; `opportunityId`→`opportunity_id`. `dueAt`
    // is transient (ignored) and bound explicitly as a Date.
    const data: Record<string, any> = {
      tenant_id: ctx.tenant_id,
      company_id: ctx.company_id ?? null,
      ...mapTaskToColumns(dto as unknown as Record<string, unknown>),
    };
    data.due_at = new Date(dto.dueAt);
    // Required schema columns: owner defaults to the verified actor (Req 2.10).
    data.owner_id = data.owner_id ?? user_id ?? UNASSIGNED_ACTOR;
    data.owner_name =
      data.owner_name ?? data.owner_id ?? user_id ?? UNASSIGNED_ACTOR;
    return this.prisma.sales_tasks.create({ data: data as any }) as any;
  }

  async getDeals(ctx: TenantScope): Promise<any[]> {
    return this.prisma.sales_opportunities.findMany({ where: { ...MultiTenancyUtil.getScope(ctx) } });
  }

  async createDeal(ctx: TenantScope, dto: any, tx?: any): Promise<any> {
    return (tx || this.prisma).sales_opportunities.create({
      data: {
        id: `DEAL-${Date.now()}`,
        updated_at: new Date(),
        ...MultiTenancyUtil.getScope(ctx),
        ...dto,
      },
    });
  }

  async completeTask(ctx: TenantScope, taskId: string): Promise<SalesTask> {
    return this.prisma.sales_tasks.update({
      where: { id: taskId },
      data: { status: "COMPLETED", completed_at: new Date() },
    }) as any;
  }

  async getOrders(ctx: TenantScope): Promise<SalesOrder[]> {
    return this.prisma.sales_orders.findMany({ where: MultiTenancyUtil.getScope(ctx) }) as any;
  }

  async getAlerts(ctx: TenantScope): Promise<SalesAlert[]> {
    return this.prisma.sales_alerts.findMany({ where: MultiTenancyUtil.getScope(ctx) }) as any;
  }

  /**
   * Run the Sales SLA sweep over ONLY the records within the swept
   * Tenant_Scope, recording the actor `user_id` from the verified
   * Tenant_Context for any resulting change (Requirement 10.8).
   *
   * The sweep is filtered by the resolved scope (via
   * {@link MultiTenancyUtil.getScope}) exactly like every other Sales read, so
   * leads belonging to another tenant are never evaluated and never produce an
   * alert. It flags leads whose follow-up SLA has elapsed
   * (`sla_due_at < now`) with no first response recorded, excluding leads that
   * are already converted/disqualified/rejected.
   *
   * The sweep is idempotent: a lead that already carries an open
   * (unacknowledged) SLA_BREACH alert is skipped so repeated runs do not
   * duplicate alerts. Every alert created and its corresponding
   * actor-attributed `sales_audit_events` entry are written inside a single
   * Atomic_Operation so the change and its actor record commit together or roll
   * back together (Requirements 10.8, 4.1, 4.2). The actor is sourced from the
   * Tenant_Context (`actor_id`), never a client header (Requirement 2.10).
   */
  async runSlaSweep(ctx: TenantScope, actor_id: string): Promise<SalesAlert[]> {
    const scope = MultiTenancyUtil.getScope(ctx);
    const now = new Date();

    // Evaluate ONLY in-scope overdue leads (Requirements 10.8, 2.1, 2.7).
    const overdueLeads = await this.prisma.sales_leads.findMany({
      where: {
        ...scope,
        sla_due_at: { lt: now },
        first_response_at: null,
        status: { notIn: ["CONVERTED", "DISQUALIFIED", "REJECTED"] },
      },
      select: {
        id: true,
        contact_name: true,
        company_name: true,
        company_id: true,
      },
    });
    if (overdueLeads.length === 0) return [];

    // Skip leads that already carry an open SLA_BREACH alert so repeated sweeps
    // are idempotent and never duplicate alerts for the same breach.
    const existingAlerts = await this.prisma.sales_alerts.findMany({
      where: {
        ...scope,
        type: "SLA_BREACH",
        entity_type: "LEAD",
        acknowledged: false,
        entity_id: { in: overdueLeads.map((l) => l.id) },
      },
      select: { entity_id: true },
    });
    const alreadyAlerted = new Set(existingAlerts.map((a) => a.entity_id));
    const toAlert = overdueLeads.filter((l) => !alreadyAlerted.has(l.id));
    if (toAlert.length === 0) return [];

    // Persist every alert and its actor-attributed audit entry inside one
    // Atomic_Operation (Requirements 10.8, 4.1, 4.2).
    return this.prisma.$transaction(async (tx) => {
      const created: SalesAlert[] = [];
      for (const lead of toAlert) {
        const alert = await tx.sales_alerts.create({
          data: {
            tenant_id: ctx.tenant_id,
            company_id: lead.company_id ?? ctx.company_id ?? null,
            type: "SLA_BREACH",
            severity: "HIGH",
            entity_type: "LEAD",
            entity_id: lead.id,
            message:
              `Lead ${lead.contact_name} (${lead.company_name}) has exceeded ` +
              `its follow-up SLA and requires immediate attention.`,
            acknowledged: false,
          },
        });
        // Record the actor responsible for the sweep change (Req 10.8, 2.10).
        await tx.sales_audit_events.create({
          data: {
            tenant_id: ctx.tenant_id,
            company_id: lead.company_id ?? ctx.company_id ?? null,
            actor_id,
            action: "SLA_BREACH_FLAGGED",
            entity_type: "LEAD",
            entity_id: lead.id,
            detail:
              `SLA sweep flagged lead ${lead.id} as breached ` +
              `(alert ${alert.id}).`,
          },
        });
        created.push(alert as unknown as SalesAlert);
      }
      return created;
    });
  }

  async getAuditEvents(ctx: TenantScope): Promise<SalesAuditEvent[]> {
    return this.prisma.sales_audit_events.findMany({ where: MultiTenancyUtil.getScope(ctx) }) as any;
  }

  async recordConsolidatedSale(ctx: TenantScope, data: any): Promise<void> {
    // Non-blocking mirror of a completed retail sale into the sales module.
    // Must never throw: it runs in an async event handler, and a failure here
    // must not affect the originating retail order flow.
    try {
      // sales_orders.opportunity_id is a required FK. Retail consolidated sales
      // are not opportunity-driven, so attach them to a stable, per-tenant
      // synthetic "Retail Consolidated Sales" opportunity (get-or-create).
      const syntheticOpportunityId = `OPP-RETAIL-SYNC-${ctx.tenant_id}`;
      await this.prisma.sales_opportunities.upsert({
        where: { id: syntheticOpportunityId },
        update: {},
        create: {
          id: syntheticOpportunityId,
          tenant_id: ctx.tenant_id,
          company_id: data.company_id || null,
          account_name: "Retail Consolidated Sales",
          owner_id: "RETAIL_MODULE_SYNC",
          owner_name: "Retail Module",
          stage: "CLOSED_WON",
          probability: 100,
          amount: 0,
          currency: data.currency || "IDR",
          expected_close_date: new Date(),
          updated_at: new Date(),
        },
      });

      await this.prisma.sales_orders.create({
        data: {
          id: `SALES-${data.external_id || Date.now()}`,
          updated_at: new Date(),
          tenant_id: ctx.tenant_id,
          company_id: data.company_id || null,
          ecommerce_id: data.ecommerce_id || null,
          opportunity_id: syntheticOpportunityId,
          customer_name: data.customer_name || "Retail Customer",
          amount: data.amount ?? 0,
          currency: data.currency || "IDR",
          status: "CLOSED_WON",
          created_by: "RETAIL_MODULE_SYNC",
        },
      });
    } catch (err: any) {
      // Duplicate mirror (same external_id) or transient error — log and move on.
      console.error(
        `[recordConsolidatedSale] skipped for order ${data?.external_id}: ${err?.message ?? err}`,
      );
    }
  }

  async getOverview(ctx: TenantScope): Promise<any> {
    return this.getDashboard(ctx);
  }
}
