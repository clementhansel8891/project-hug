import { Controller, Get, Post, Body, Param, Patch, Delete, Query } from '@nestjs/common';
import { IncentivesService } from './incentives.service';
import { CreateIncentivePlanDto } from './dto/create-plan.dto';
import { CreateIncentiveRuleDto } from './dto/create-rule.dto';
import { UpdateIncentivePlanDto } from './dto/update-plan.dto';

@Controller('incentives')
export class IncentivesController {
  constructor(private readonly incentivesService: IncentivesService) {}

  @Post('plans')
  createPlan(@Body() dto: CreateIncentivePlanDto) {
    return this.incentivesService.createPlan(dto);
  }

  @Get('plans')
  getPlans(@Query('tenant_id') tenant_id: string, @Query('company_id') company_id: string) {
    return this.incentivesService.getPlans(tenant_id, company_id);
  }

  @Get('plans/:id')
  getPlanById(@Param('id') id: string) {
    return this.incentivesService.getPlanById(id);
  }

  @Patch('plans/:id/status')
  updateStatus(@Param('id') id: string, @Body('is_active') is_active: boolean, @Body('actor_id') actor_id?: string) {
    return this.incentivesService.updatePlanStatus(id, is_active, actor_id);
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() dto: UpdateIncentivePlanDto, @Body('actor_id') actor_id?: string) {
    return this.incentivesService.updatePlan(id, dto, actor_id);
  }

  @Get('plans/:id/audit-logs')
  getAuditLogs(@Param('id') id: string) {
    return this.incentivesService.getAuditLogs(id);
  }

  @Delete('plans/:id')
  deletePlan(@Param('id') id: string) {
    return this.incentivesService.deletePlan(id);
  }

  @Post('rules')
  createRule(@Body() dto: CreateIncentiveRuleDto) {
    return this.incentivesService.createRule(dto);
  }

  @Post('plans/:id/eligibility')
  setEligibility(@Param('id') id: string, @Body() eligibility: any[]) {
    return this.incentivesService.setEligibility(id, eligibility);
  }

  @Get('plans/:id/eligible-staff')
  getEligibleStaff(@Param('id') id: string) {
    return this.incentivesService.getEligibleStaff(id);
  }

  @Post('recalculate')
  recalculate(
    @Query('tenant_id') tenant_id: string,
    @Query('company_id') company_id: string,
    @Body() data: { start_date: string; end_date: string }
  ) {
    return this.incentivesService.recalculatePeriod(
      tenant_id,
      company_id,
      new Date(data.start_date),
      new Date(data.end_date)
    );
  }

  @Get('analytics')

  getAnalytics(@Query('tenant_id') tenant_id: string, @Query('company_id') company_id: string) {
    return this.incentivesService.getIncentiveAnalytics(tenant_id, company_id);
  }

  @Post('process-payouts')
  processPayouts(
    @Body() data: { tenant_id: string; company_id: string; start_date: string; end_date: string }
  ) {
    return this.incentivesService.processPayouts(
      data.tenant_id,
      data.company_id,
      new Date(data.start_date),
      new Date(data.end_date)
    );
  }

  @Get('attributions')
  getAttributions(@Query('tenant_id') tenant_id: string, @Query('company_id') company_id?: string) {
    return this.incentivesService.getAttributions(tenant_id, company_id);
  }

  @Get('payouts')
  getPayouts(@Query('tenant_id') tenant_id: string, @Query('company_id') company_id?: string) {
    return this.incentivesService.getPayouts(tenant_id, company_id);
  }

  @Get('employee/:id')
  getEmployeeIncentives(@Param('id') employeeId: string, @Query('tenant_id') tenant_id: string) {
    return this.incentivesService.getEmployeeIncentives(tenant_id, employeeId);
  }
}
