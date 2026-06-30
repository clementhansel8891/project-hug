import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";

/**
 * Payload for POST /sales/incentives/plans — the IncentiveConfigModal "New
 * Incentive Plan" action. The modal conflates a plan and its single reward
 * rule, so the bridge route creates the `sales_incentive_plans` row from the
 * plan fields and a default GLOBAL `sales_incentive_rules` row from
 * `type` + `value`. tenant_id/company_id are NOT accepted here — they are
 * derived from the authenticated tenant context.
 */
export class CreateIncentivePlanDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(["PERCENTAGE", "FIXED", "TIERED"])
  type: "PERCENTAGE" | "FIXED" | "TIERED";

  @IsNumber()
  @Min(0)
  value: number;

  @IsString()
  @IsNotEmpty()
  startDate: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
