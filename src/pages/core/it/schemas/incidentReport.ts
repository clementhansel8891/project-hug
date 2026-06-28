/**
 * Zod schema for IT Incident Report modal.
 * Used to file a new incident report for infrastructure or security events.
 */
import { z } from "zod";

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

export const incidentReportSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(200, "Title must not exceed 200 characters"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description must not exceed 2000 characters"),
  type: z.enum(INCIDENT_TYPES, {
    required_error: "Incident type is required",
  }),
  severity: z.enum(INCIDENT_SEVERITY, {
    required_error: "Severity is required",
  }),
  affectedSystems: z.string().min(1, "Affected systems is required"),
  discoveredAt: z.string().min(1, "Discovery time is required"),
});

export type IncidentReportInput = z.infer<typeof incidentReportSchema>;
