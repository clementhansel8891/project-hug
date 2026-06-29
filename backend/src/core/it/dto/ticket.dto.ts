import { IsString, IsNotEmpty, IsOptional, IsIn } from "class-validator";

export const TICKET_CATEGORIES = [
  "hardware",
  "software",
  "network",
  "security",
  "access",
  "other",
] as const;

export const IMPACT_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const PRIORITY_LEVELS = ["Low", "Medium", "High", "Critical"] as const;
export const TICKET_STATUSES = [
  "open",
  "assigned",
  "in_progress",
  "escalated",
  "resolved",
  "closed",
] as const;

/**
 * Server-side priority assignment — mirrors the client rule in
 * src/pages/core/it/schemas/index.ts so priority is authoritative on the server.
 */
export function assignPriority(category: string, impact: string): string {
  if (impact === "CRITICAL") return "Critical";
  if (impact === "HIGH" && (category === "security" || category === "network")) {
    return "Critical";
  }
  if (impact === "HIGH") return "High";
  if (impact === "MEDIUM") return "Medium";
  return "Low";
}

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsIn(TICKET_CATEGORIES as unknown as string[])
  category: string;

  @IsString()
  @IsIn(IMPACT_LEVELS as unknown as string[])
  impact: string;

  @IsString()
  @IsOptional()
  priority?: string;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsString()
  @IsOptional()
  reporterId?: string;
}

export class UpdateTicketDto {
  @IsString()
  @IsOptional()
  @IsIn(TICKET_STATUSES as unknown as string[])
  status?: string;

  @IsString()
  @IsOptional()
  @IsIn(PRIORITY_LEVELS as unknown as string[])
  priority?: string;

  @IsString()
  @IsOptional()
  assigneeId?: string;
}

export class EscalateTicketDto {
  @IsString()
  @IsNotEmpty()
  ticketId: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsNotEmpty()
  escalatedTo: string;

  @IsString()
  @IsIn(PRIORITY_LEVELS as unknown as string[])
  priority: string;
}

export class ResolveTicketDto {
  @IsString()
  @IsNotEmpty()
  ticketId: string;

  @IsString()
  @IsNotEmpty()
  resolutionNotes: string;

  @IsString()
  @IsIn(TICKET_CATEGORIES as unknown as string[])
  category: string;
}
