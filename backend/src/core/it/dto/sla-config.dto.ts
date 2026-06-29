import { IsString, IsIn, IsInt, Min } from "class-validator";
import { Type } from "class-transformer";

export const PRIORITY_LEVELS = ["Low", "Medium", "High", "Critical"] as const;

export class SlaConfigDto {
  @IsString()
  @IsIn(PRIORITY_LEVELS as unknown as string[])
  priority: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  responseTimeMinutes: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  resolutionTimeMinutes: number;
}
