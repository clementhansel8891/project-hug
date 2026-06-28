/**
 * Marketing Module Zod Schemas
 *
 * Validates all marketing domain entities with proper field constraints:
 * - Campaign: name 3-100 chars, start date required, end date >= start date, >= 1 audience segment
 * - Lead: company name, contact name, source, email (optional)
 * - Funnel: name required, initial step type
 * - Nurture Workflow: name, trigger event, steps
 * - Execution: campaign selection, channel, scheduled time
 * - Connected Account: provider selection, account name
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Campaign Schemas
// ---------------------------------------------------------------------------

export const createCampaignSchema = z.object({
  name: z.string()
    .min(3, "Campaign name must be at least 3 characters")
    .max(100, "Campaign name cannot exceed 100 characters"),
  objective: z.enum(["LEAD_GENERATION", "AWARENESS", "NURTURE", "REMARKETING"], {
    required_error: "Objective is required",
  }),
  channelMix: z.array(z.enum([
    "META_ADS", "GOOGLE_ADS", "EMAIL", "WHATSAPP", "WEBINAR", "LANDING_PAGE", "EVENT",
  ])).min(1, "At least one channel is required"),
  budget: z.coerce.number().min(0, "Budget must be non-negative"),
  currency: z.enum(["IDR", "USD"]).default("USD"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  audience: z.string().min(1, "At least 1 audience segment is required"),
}).refine(
  (data) => {
    if (!data.startDate || !data.endDate) return true;
    return new Date(data.endDate) >= new Date(data.startDate);
  },
  {
    message: "End date must be on or after start date",
    path: ["endDate"],
  }
);

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const updateCampaignStatusSchema = z.object({
  status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED", "FAILED"], {
    required_error: "Status is required",
  }),
});

export type UpdateCampaignStatusInput = z.infer<typeof updateCampaignStatusSchema>;

// ---------------------------------------------------------------------------
// Lead Schemas
// ---------------------------------------------------------------------------

export const captureLeadSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(200),
  contactName: z.string().min(1, "Contact name is required").max(200),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  source: z.enum([
    "LANDING_PAGE", "EMBEDDED_FORM", "CHATBOT", "WEBINAR",
    "META_LEAD_ADS", "GOOGLE_ADS", "PARTNER_API",
  ], { required_error: "Source is required" }),
  campaignId: z.string().optional().or(z.literal("")),
  industry: z.string().optional().or(z.literal("")),
  employeeBand: z.string().optional().or(z.literal("")),
});

export type CaptureLeadInput = z.infer<typeof captureLeadSchema>;

// ---------------------------------------------------------------------------
// Funnel Schemas
// ---------------------------------------------------------------------------

export const createFunnelSchema = z.object({
  name: z.string().min(1, "Funnel name is required").max(200),
  status: z.enum(["active", "draft"]).default("draft"),
});

export type CreateFunnelInput = z.infer<typeof createFunnelSchema>;

export const editFunnelStepSchema = z.object({
  name: z.string().min(1, "Step name is required").max(200),
  type: z.enum(["landing", "checkout", "upsell", "thankyou"], {
    required_error: "Step type is required",
  }),
  conversionRate: z.coerce.number().min(0).max(100, "Conversion rate must be 0-100"),
  isABTest: z.boolean().default(false),
});

export type EditFunnelStepInput = z.infer<typeof editFunnelStepSchema>;

// ---------------------------------------------------------------------------
// Nurture Workflow Schemas
// ---------------------------------------------------------------------------

export const createWorkflowSchema = z.object({
  name: z.string().min(1, "Workflow name is required").max(200),
  trigger: z.enum(["NEW_LEAD", "SCORE_BELOW_THRESHOLD", "REENGAGEMENT"], {
    required_error: "Trigger event is required",
  }),
  steps: z.array(z.object({
    channel: z.enum(["EMAIL", "WHATSAPP", "RETARGETING"]),
    waitHours: z.coerce.number().min(0, "Wait hours must be non-negative"),
    messageTemplate: z.string().min(1, "Message template is required"),
  })).min(1, "At least one step is required"),
});

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;

// ---------------------------------------------------------------------------
// Execution Schemas
// ---------------------------------------------------------------------------

export const scheduleExecutionSchema = z.object({
  campaignId: z.string().min(1, "Campaign selection is required"),
  channel: z.enum([
    "META_ADS", "GOOGLE_ADS", "EMAIL", "WHATSAPP", "WEBINAR", "LANDING_PAGE", "EVENT",
  ], { required_error: "Channel is required" }),
  scheduledAt: z.string().min(1, "Scheduled time is required"),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type ScheduleExecutionInput = z.infer<typeof scheduleExecutionSchema>;

// ---------------------------------------------------------------------------
// Connected Account Schemas
// ---------------------------------------------------------------------------

export const connectAccountSchema = z.object({
  provider: z.enum(["META", "GOOGLE", "TIKTOK", "YOUTUBE", "INSTAGRAM", "FACEBOOK"], {
    required_error: "Provider is required",
  }),
  accountName: z.string().min(1, "Account name is required").max(200),
  scopes: z.string().min(1, "At least one scope is required"),
});

export type ConnectAccountInput = z.infer<typeof connectAccountSchema>;

export const accountSettingsSchema = z.object({
  dailyBudgetLimit: z.coerce.number().min(0, "Budget must be non-negative").optional(),
  syncFrequency: z.enum(["1H", "4H", "12H", "24H"]).default("4H"),
});

export type AccountSettingsInput = z.infer<typeof accountSettingsSchema>;

// ---------------------------------------------------------------------------
// Creative Asset Schemas
// ---------------------------------------------------------------------------

export const uploadAssetSchema = z.object({
  name: z.string().min(1, "Asset name is required").max(200),
  type: z.enum(["IMAGE", "VIDEO", "DOCUMENT", "TEMPLATE"], {
    required_error: "Asset type is required",
  }),
  description: z.string().max(500).optional().or(z.literal("")),
  tags: z.string().optional().or(z.literal("")),
});

export type UploadAssetInput = z.infer<typeof uploadAssetSchema>;

export const editAssetTagsSchema = z.object({
  tags: z.string().min(1, "At least one tag is required"),
});

export type EditAssetTagsInput = z.infer<typeof editAssetTagsSchema>;

// ---------------------------------------------------------------------------
// Appointment Schema
// ---------------------------------------------------------------------------

export const createAppointmentSchema = z.object({
  contactId: z.string().min(1, "Contact is required"),
  title: z.string().min(1, "Title is required").max(200),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

// ---------------------------------------------------------------------------
// Omnichannel Config Schema
// ---------------------------------------------------------------------------

export const omnichannelConfigSchema = z.object({
  channel: z.enum(["WHATSAPP", "SMS", "EMAIL"], {
    required_error: "Channel is required",
  }),
  autoReply: z.boolean().default(false),
  autoReplyMessage: z.string().max(500).optional().or(z.literal("")),
  assignTo: z.enum(["ROUND_ROBIN", "MANUAL", "AI_ROUTING"]).default("MANUAL"),
  maxConcurrentChats: z.coerce.number().min(1).max(100).default(10),
  businessHoursOnly: z.boolean().default(true),
});

export type OmnichannelConfigInput = z.infer<typeof omnichannelConfigSchema>;
