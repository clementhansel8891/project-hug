import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../persistence/prisma.service';
import { CreateIncentivePlanDto } from './dto/create-plan.dto';
import { CreateIncentiveRuleDto } from './dto/create-rule.dto';
import { v4 as uuidv4 } from 'uuid';
import { Decimal } from '@prisma/client/runtime/library';

import { FiscalPeriodService } from '../finance/services/fiscal-period.service';
import { LedgerPostingService } from '../finance/services/ledger-posting.service';
import { ChartOfAccountService } from '../finance/services/chart-of-account.service';
import { HRService } from '../hr/hr.service';
import { UpdateIncentivePlanDto } from './dto/update-plan.dto';
import { Inject } from '@nestjs/common';

@Injectable()
export class IncentivesService {
  private readonly logger = new Logger(IncentivesService.name);

  constructor(
    private prisma: PrismaService,
    private ledgerPostingService: LedgerPostingService,
    private fiscalPeriodService: FiscalPeriodService,
    private coaService: ChartOfAccountService,
    private hrService: HRService,
  ) {}

  async createPlan(dto: CreateIncentivePlanDto) {
    this.logger.log(`Creating incentive plan: ${dto.name}`);
    return this.prisma.sales_incentive_plans.create({
      data: {
        id: uuidv4(),
        ...dto,
        version: 1,
      },
    });
  }

  async getPlans(tenant_id: string, company_id: string) {
    return this.prisma.sales_incentive_plans.findMany({
      where: {
        tenant_id,
        company_id,
      },
      include: {
        rules: true,
      },
    });
  }

  async getPlanById(id: string) {
    return this.prisma.sales_incentive_plans.findUnique({
      where: { id },
      include: {
        rules: true,
        eligibility: true,
      },
    });
  }

  async createRule(dto: CreateIncentiveRuleDto) {
    this.logger.log(`Creating incentive rule for plan ${dto.plan_id}`);
    return this.prisma.sales_incentive_rules.create({
      data: {
        id: uuidv4(),
        ...dto,
      },
    });
  }

  async updatePlan(id: string, dto: UpdateIncentivePlanDto, actor_id: string = 'SYSTEM') {
    const before_state = await this.prisma.sales_incentive_plans.findUnique({
      where: { id },
    });

    if (!before_state) throw new Error('Plan not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.sales_incentive_plans.update({
        where: { id },
        data: {
          ...dto,
          version: { increment: 1 },
          updated_at: new Date(),
        },
      });

      await tx.sales_incentive_audit_logs.create({
        data: {
          id: uuidv4(),
          plan_id: id,
          actor_id,
          action: 'UPDATE_PLAN',
          changes: { before: before_state, after: updated } as any,
          timestamp: new Date(),
        },
      });

      return updated;
    });
  }

  async updatePlanStatus(id: string, is_active: boolean, actor_id: string = 'SYSTEM') {
    const before_state = await this.prisma.sales_incentive_plans.findUnique({
      where: { id },
    });

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.sales_incentive_plans.update({
        where: { id },
        data: { is_active, updated_at: new Date() },
      });

      await tx.sales_incentive_audit_logs.create({
        data: {
          id: uuidv4(),
          plan_id: id,
          actor_id,
          action: is_active ? 'ACTIVATE_PLAN' : 'DEACTIVATE_PLAN',
          changes: { before: before_state, after: updated } as any,
          timestamp: new Date(),
        },
      });

      return updated;
    });
  }

  async getAuditLogs(plan_id: string) {
    return this.prisma.sales_incentive_audit_logs.findMany({
      where: { plan_id },
      orderBy: { timestamp: 'desc' },
    });
  }

  async deletePlan(id: string) {
    return this.prisma.sales_incentive_plans.delete({
      where: { id },
    });
  }

  async setEligibility(plan_id: string, eligibility: { target_type: string; target_id: string; is_excluded: boolean }[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.sales_incentive_eligibility.deleteMany({
        where: { plan_id },
      });

      return tx.sales_incentive_eligibility.createMany({
        data: eligibility.map((e) => ({
          id: uuidv4(),
          plan_id,
          ...e,
        })),
      });
    });
  }

  async getEligibleStaff(plan_id: string) {
    const plan = await this.prisma.sales_incentive_plans.findUnique({
      where: { id: plan_id },
      include: { eligibility: true },
    });

    if (!plan) return [];

    const inclusions = plan.eligibility.filter((e) => !e.is_excluded);
    const exclusions = plan.eligibility.filter((e) => e.is_excluded);

    const eligibleIds = new Set<string>();

    for (const inc of inclusions) {
      const ids = await this.resolveTargetIds(inc.target_type, inc.target_id, plan.tenant_id);
      ids.forEach((id) => eligibleIds.add(id));
    }

    // Dynamic Auto-Inclusion for Sales Roles
    const salesEmployees = await this.prisma.employees.findMany({
      where: {
        tenant_id: plan.tenant_id,
        status: 'active',
        OR: [
          { department_id: { contains: 'SALES', mode: 'insensitive' } },
          { positions: { contains: 'SALES', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    salesEmployees.forEach((e) => eligibleIds.add(e.id));

    for (const exc of exclusions) {
      const ids = await this.resolveTargetIds(exc.target_type, exc.target_id, plan.tenant_id);
      ids.forEach((id) => eligibleIds.delete(id));
    }

    return Array.from(eligibleIds);
  }

  async recalculatePeriod(tenant_id: string, company_id: string, start_date: Date, end_date: Date) {
    this.logger.log(`Recalculating incentives for ${company_id} from ${start_date} to ${end_date}`);
    
    return this.prisma.$transaction(async (tx) => {
      // 1. Delete pending attributions for this period
      await tx.sales_attributions.deleteMany({
        where: {
          tenant_id,
          company_id,
          status: 'PENDING',
          created_at: { gte: start_date, lte: end_date },
        },
      });

      // 2. Fetch all orders in this period
      const retailOrders = await tx.retail_orders.findMany({
        where: { tenant_id, created_at: { gte: start_date, lte: end_date } },
        select: { id: true },
      });

      const salesOrders = await tx.sales_orders.findMany({
        where: { tenant_id, created_at: { gte: start_date, lte: end_date } },
        select: { id: true },
      });

      // 3. Re-evaluate
      for (const order of retailOrders) {
        await this.evaluateOrder(order.id, 'RETAIL');
      }
      for (const order of salesOrders) {
        await this.evaluateOrder(order.id, 'SALES');
      }

      return { processed: retailOrders.length + salesOrders.length };
    });
  }

  async getIncentiveAnalytics(tenant_id: string, company_id: string) {
    const attributions = await this.prisma.sales_attributions.findMany({
      where: { tenant_id, company_id },
    });

    const totalIncentive = attributions.reduce((sum, a) => sum.add(a.incentive_amount || 0), new Decimal(0));
    
    // Get total revenue for ROI calculation
    const retailRevenue = await this.prisma.retail_orders.aggregate({
      where: { tenant_id },
      _sum: { total_amount: true },
    });

    const salesRevenue = await this.prisma.sales_orders.aggregate({
      where: { tenant_id },
      _sum: { amount: true },
    });

    const totalRevenue = new Decimal(retailRevenue._sum.total_amount || 0).add(new Decimal(salesRevenue._sum.amount || 0));
    const roi = totalRevenue.isZero() ? 0 : totalRevenue.div(totalIncentive).toNumber();

    // Top Earners
    const earners = await this.prisma.sales_attributions.groupBy({
      by: ['employee_id'],
      where: { tenant_id, company_id },
      _sum: { incentive_amount: true },
      orderBy: { _sum: { incentive_amount: 'desc' } },
      take: 5,
    });

    return {
      totalIncentive: totalIncentive.toNumber(),
      totalRevenue: totalRevenue.toNumber(),
      roi,
      topEarners: earners.map(e => ({
        employee_id: e.employee_id,
        amount: Number(e._sum.incentive_amount),
      })),
    };
  }


  async evaluateOrder(orderId: string, type: 'RETAIL' | 'SALES') {
    this.logger.log(`Evaluating incentives for ${type} order: ${orderId}`);

    let order: any;
    if (type === 'RETAIL') {
      order = await this.prisma.retail_orders.findUnique({
        where: { id: orderId },
        include: {
          retail_order_items: {
            include: { item_masters: true },
          },
        },
      });
    } else {
      order = await this.prisma.sales_orders.findUnique({
        where: { id: orderId },
        include: {
          sales_order_items: {
            include: { item_masters: true },
          },
        },
      });
    }

    if (!order) return;

    // Resolve Attributions (Multiple People Support)
    const attributionRules = await this.prisma.sales_attribution_rules.findMany({
      where: { tenant_id: order.tenant_id, is_active: true },
    });

    const staffShares: { employee_id: string; share_percent: number }[] = [];
    
    if (type === 'RETAIL') {
        if (order.cashier_id) staffShares.push({ employee_id: order.cashier_id, share_percent: 100 });
    } else {
        // For B2B, we might have multiple people (Owner, Manager, etc.)
        // Default to owner if no attribution rules
        if (order.created_by) staffShares.push({ employee_id: order.created_by, share_percent: 100 });
    }

    const plans = await this.prisma.sales_incentive_plans.findMany({
      where: {
        tenant_id: order.tenant_id,
        is_active: true,
        start_date: { lte: order.created_at },
        OR: [{ end_date: null }, { end_date: { gte: order.created_at } }],
      },
      include: {
        rules: true,
        eligibility: true,
      },
    });

    const finalAttributions: any[] = [];

    for (const share of staffShares) {
        for (const plan of plans) {
          const eligibleStaff = await this.getEligibleStaff(plan.id);
          if (!eligibleStaff.includes(share.employee_id)) continue;

          const planAttributions = await this.applyPlanRules(plan, order, type);
          
          for (const attr of planAttributions) {
              const sharedAmount = new Decimal(attr.amount).mul(share.share_percent).div(100);
              finalAttributions.push({
                  ...attr,
                  employee_id: share.employee_id,
                  amount: sharedAmount,
                  percent: new Decimal(attr.percent).mul(share.share_percent).div(100).toNumber(),
              });
          }
        }
    }

    if (finalAttributions.length > 0) {
      await this.prisma.sales_attributions.createMany({
        data: finalAttributions.map((attr) => ({
          id: uuidv4(),
          tenant_id: order.tenant_id,
          company_id: order.tenant_id,
          entity_type: type === 'RETAIL' ? 'RETAIL_ORDER' : 'SALES_ORDER',
          entity_id: orderId,
          employee_id: attr.employee_id,
          share_percent: new Decimal(attr.percent),
          incentive_amount: new Decimal(attr.amount),
          status: 'PENDING',
          attribution_type: 'AUTOMATIC',
          metadata: { rule_id: attr.rule_id },
          created_at: new Date(),
        })),
      });
    }

    return finalAttributions;
  }

  async processPayouts(tenant_id: string, company_id: string, start_date: Date, end_date: Date) {
    this.logger.log(`Processing payouts for ${company_id} from ${start_date} to ${end_date}`);

    // 1. Fetch pending attributions
    const attributions = await this.prisma.sales_attributions.findMany({
      where: {
        tenant_id,
        company_id,
        status: 'PENDING',
        created_at: { gte: start_date, lte: end_date },
      },
    });

    if (attributions.length === 0) return [];

    // 2. Group by employee
    const employeeGroup: Record<string, any[]> = {};
    for (const attr of attributions) {
      if (!employeeGroup[attr.employee_id]) employeeGroup[attr.employee_id] = [];
      employeeGroup[attr.employee_id].push(attr);
    }

    const payouts: any[] = [];

    // 3. Create payouts in transaction
    await this.prisma.$transaction(async (tx) => {
      for (const employee_id in employeeGroup) {
        const employeeAttributions = employeeGroup[employee_id];
        const total_amount = employeeAttributions.reduce((sum, a) => sum.add(a.incentive_amount), new Decimal(0));

        const payout = await tx.sales_incentive_payouts.create({
          data: {
            id: uuidv4(),
            tenant_id,
            company_id,
            employee_id,
            period_start: start_date,
            period_end: end_date,
            gross_amount: total_amount,
            net_amount: total_amount,
            status: 'PENDING',
            created_at: new Date(),
          },
        });

        // Create HR Sales Bonus Record
        await tx.hr_sales_bonuses.create({
            data: {
                id: uuidv4(),
                tenant_id,
                employee_id,
                order_id: employeeAttributions[0].entity_id, // Reference one of the orders
                amount: total_amount,
                status: 'PENDING',
            }
        });

        // Trigger Finance Accrual
        const openPeriodId = await this.fiscalPeriodService.validatePeriodOpenForPosting(
          tenant_id,
          company_id,
          'SALES_INCENTIVE',
          'SYSTEM'
        );

        const expenseAccount = await this.coaService.findByCode(tenant_id, company_id, '6100-INC');
        const liabilityAccount = await this.coaService.findByCode(tenant_id, company_id, '2100-INC');

        if (!expenseAccount || !liabilityAccount) {
          this.logger.error(`Failed to resolve incentive accounts: EXP=${!!expenseAccount}, LIAB=${!!liabilityAccount}`);
          throw new Error('Incentive accounting configuration missing');
        }

        const employee = await this.hrService.getEmployeeById(tenant_id, employee_id);

        await this.ledgerPostingService.enqueuePosting(
          tenant_id,
          company_id,
          'INCENTIVE_ACCRUAL',
          payout.id,
          {
            amount: total_amount.toNumber(),
            currency: 'USD',
            description: `Incentive Payout Accrual for ${employee?.first_name} ${employee?.last_name} (${employee_id})`,
            fiscalPeriodId: openPeriodId,
            expenseAccountId: expenseAccount.id,
            liabilityAccountId: liabilityAccount.id,
            branch_id: employee?.location_id,
            department_id: employee?.department_id,
          },
          undefined,
          undefined,
          tx
        );

        // Update attributions
        await tx.sales_attributions.updateMany({
          where: { id: { in: employeeAttributions.map((a) => a.id) } },
          data: {
            status: 'PROCESSED',
            payout_id: payout.id,
            updated_at: new Date(),
          },
        });

        payouts.push(payout);
      }
    });

    return payouts;
  }

  private async applyPlanRules(plan: any, order: any, type: 'RETAIL' | 'SALES') {
    const attributions: any[] = [];
    const rules = [...plan.rules].sort((a: any, b: any) => b.priority - a.priority);
    const orderItems = type === 'RETAIL' ? order.retail_order_items : order.sales_order_items;

    for (const item of orderItems) {
      const itemMatches: any[] = [];

      const skuRule = rules.find((r: any) => r.dimension === 'SKU' && r.dimension_value === item.item_masters.sku);
      if (skuRule) itemMatches.push(skuRule);

      const catRule = rules.find((r: any) => r.dimension === 'CATEGORY' && r.dimension_value === item.item_masters.category_id);
      if (catRule) itemMatches.push(catRule);

      const globalRule = rules.find((r: any) => r.dimension === 'GLOBAL');
      if (globalRule) itemMatches.push(globalRule);

      if (itemMatches.length > 0) {
        const itemAttributions = [];
        for (const r of itemMatches) {
            const amount = await this.calculateAmount(r, item.total_price, order.tenant_id, order.created_by || order.cashier_id);
            itemAttributions.push({
                rule_id: r.id,
                amount,
                percent: r.base_type === 'PERCENTAGE' ? Number(r.value) : 0,
            });
        }

        attributions.push(...this.resolveConflicts(itemAttributions, plan.conflict_strategy));
      }

    }

    const totalRule = rules.find((r: any) => r.dimension === 'TRANSACTION_TOTAL');
    if (totalRule) {
      const amount = await this.calculateAmount(totalRule, order.total_amount, order.tenant_id, order.created_by || order.cashier_id);
      attributions.push({
        rule_id: totalRule.id,
        amount,
        percent: totalRule.base_type === 'PERCENTAGE' ? Number(totalRule.value) : 0,
      });
    }

    return attributions;
  }


  private resolveConflicts(matches: any[], strategy: string) {
    if (matches.length <= 1) return matches;

    switch (strategy) {
      case 'COMBINE_ALL':
        return matches;
      case 'MAX_VALUE':
        const maxMatch = matches.reduce((prev, current) => (prev.amount > current.amount) ? prev : current);
        return [maxMatch];
      case 'PRIORITY':
      default:
        return [matches[0]]; 
    }
  }

  private async calculateAmount(rule: any, baseAmount: Decimal | number, tenant_id: string, employee_id?: string): Promise<number> {
    const val = Number(rule.value);
    const base = Number(baseAmount);

    if (rule.base_type === 'PERCENTAGE') {
      return (base * val) / 100;
    } else if (rule.base_type === 'FIXED_AMOUNT') {
      return val;
    } else if (rule.base_type === 'SLIDING_SCALE' && rule.scales) {
      // Sliding Scale logic: requires cumulative volume for the employee in the current month
      if (!employee_id) return (base * val) / 100; // Fallback to base value

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const cumulative = await this.prisma.sales_attributions.aggregate({
        where: {
          tenant_id,
          employee_id,
          created_at: { gte: startOfMonth },
        },
        _sum: { incentive_amount: true },
      });

      const totalSoFar = Number(cumulative._sum.incentive_amount || 0);
      const sortedScales = [...(rule.scales as any[])].sort((a, b) => b.threshold - a.threshold);
      const activeScale = sortedScales.find(s => totalSoFar >= s.threshold);

      const scaleVal = activeScale ? Number(activeScale.value) : val;
      return (base * scaleVal) / 100;
    }
    return 0;
  }


  private async resolveTargetIds(type: string, id: string, tenant_id: string): Promise<string[]> {
    switch (type) {
      case 'INDIVIDUAL':
        return [id];
      case 'BRANCH':
        const branchEmployees = await this.prisma.employees.findMany({
          where: { location_id: id, tenant_id, status: 'active' },
          select: { id: true },
        });
        return branchEmployees.map((e) => e.id);
      case 'DEPARTMENT':
        const deptEmployees = await this.prisma.employees.findMany({
          where: { department_id: id, tenant_id, status: 'active' },
          select: { id: true },
        });
        return deptEmployees.map((e) => e.id);
      case 'COMPANY':
        const companyEmployees = await this.prisma.employees.findMany({
          where: { tenant_id: id, status: 'active' },
          select: { id: true },
        });
        return companyEmployees.map((e) => e.id);
      default:
        return [];
    }
  }

  // --- List endpoints for frontend ---

  async getAttributions(tenant_id: string, company_id?: string) {
    const where: any = { tenant_id };
    if (company_id) where.company_id = company_id;
    return this.prisma.sales_attributions.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 100,
    });
  }

  async getPayouts(tenant_id: string, company_id?: string) {
    const where: any = { tenant_id };
    if (company_id) where.company_id = company_id;
    return this.prisma.sales_incentive_payouts.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 100,
    });
  }

  async getEmployeeIncentives(tenant_id: string, employeeId: string) {
    const [attributions, payouts] = await Promise.all([
      this.prisma.sales_attributions.findMany({
        where: { tenant_id, employee_id: employeeId },
        orderBy: { created_at: 'desc' },
        take: 50,
      }),
      this.prisma.sales_incentive_payouts.findMany({
        where: { tenant_id, employee_id: employeeId },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),
    ]);
    return { attributions, payouts };
  }
}
