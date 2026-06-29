import { IsString, IsNotEmpty, IsIn } from "class-validator";

export const INCIDENT_SEVERITY = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const INCIDENT_TYPES = [
  "security_breach",
  "service_outage",
  "data_loss",
  "performance_degradation",
  "unauthorized_access",
  "hardware_failure",
  "other",
] as const;

export class CreateIncidentDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsIn(INCIDENT_TYPES as unknown as string[])
  type: string;

  @IsString()
  @IsIn(INCIDENT_SEVERITY as unknown as string[])
  severity: string;

  @IsString()
  @IsNotEmpty()
  affectedSystems: string;

  @IsString()
  @IsNotEmpty()
  discoveredAt: string;
}
