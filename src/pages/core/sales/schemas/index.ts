/**
 * Zod schemas for all Sales domain entities.
 *
 * Provides client-side validation for:
 * - Leads (create/update)
 * - Opportunities (create/update stage)
 * - Quotations (create with line items)
 * - Orders (create from opportunity)
 * - Timeline Events (create)
 * - Tasks (create)
 *
 * Business rules:
 * - Lead company: 2-200 chars
 * - Lead potential_value: >= 0
 * - Quotation line items: min 1, qty > 0, unitPrice > 0
 * - Line total = qty × unitPrice × (1 - discountPercent/100) for percentage
 *             or qty × unitPrice - fixedDiscount for fixed
 * - Lead-to-opportunity conversion: carry over company, contact, potential_value; set lead status "converted"
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Lead Schemas
// ---------------------------------------------------------------------------

export const createLeadSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters").max(200, "Company name must be at most 200 characters"),
  contactName: z.string().min(1, "Contact person is required").max(200),
  contactEmail: z.string().email("Invalid email format").optional().or(z.literal("")),
  contactPhone: z.string().max(30).optional().or(z.literal("")),
  potentialValue: z.coerce.number().min(0, "Potential value must be >= 0").default(0),
  source: z.enum(["MARKETING", "REFERRAL", "INBOUND", "OUTBOUND", "PARTNER", "DIRECT"]).default("DIRECT"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadStatusSchema = z.object({
  status: z.enum(["NEW", "ASSIGNED", "CONTACTED", "QUALIFIED", "DISQUALIFIED", "CONVERTED"]),
});

export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>;

// ---------------------------------------------------------------------------
// Opportunity Schemas
// ---------------------------------------------------------------------------

export const createOpportunitySchema = z.object({
  leadId: z.string().optional(),
  accountName: z.string().min(2, "Company name must be at least 2 characters").max(200),
  contactName: z.string().min(1, "Contact is required").max(200),
  amount: z.coerce.number().min(0, "Value must be >= 0"),
  stage: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"]).default("NEW"),
  probability: z.coerce.number().min(0).max(100).default(10),
  expectedCloseDate: z.string().min(1, "Expected close date is required"),
  nextAction: z.string().max(500).optional().or(z.literal("")),
});

export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;

export const moveOpportunityStageSchema = z.object({
  stage: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"]),
});

export type MoveOpportunityStageInput = z.infer<typeof moveOpportunityStageSchema>;

// ---------------------------------------------------------------------------
// Quotation Line Item Schema
// ---------------------------------------------------------------------------

export const quotationLineItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  itemName: z.string().optional().default(""),
  quantity: z.coerce.number().gt(0, "Quantity must be greater than 0"),
  unitPrice: z.coerce.number().gt(0, "Unit price must be greater than 0"),
  discountType: z.enum(["percentage", "fixed"]).default("percentage"),
  discountValue: z.coerce.number().min(0, "Discount must be >= 0").default(0),
});

export type QuotationLineItemInput = z.infer<typeof quotationLineItemSchema>;

// ---------------------------------------------------------------------------
// Quotation Schemas
// ---------------------------------------------------------------------------

export const createQuotationSchema = z.object({
  opportunityId: z.string().min(1, "Opportunity is required"),
  notes: z.string().max(1000).optional().or(z.literal("")),
  validDays: z.coerce.number().min(1).max(365).default(30),
  lineItems: z.array(quotationLineItemSchema).min(1, "At least one line item is required"),
});

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;

/**
 * Legacy simple quote schema for backward compatibility with existing QuoteDesk form.
 * Uses a single amount + discountPercent instead of line items.
 */
export const createSimpleQuoteSchema = z.object({
  opportunityId: z.string().min(1, "Opportunity is required"),
  amount: z.coerce.number().gt(0, "Amount must be greater than 0"),
  discountPercent: z.coerce.number().min(0, "Discount must be >= 0").max(100, "Discount cannot exceed 100%").default(0),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type CreateSimpleQuoteInput = z.infer<typeof createSimpleQuoteSchema>;

// ---------------------------------------------------------------------------
// Order Schemas
// ---------------------------------------------------------------------------

export const createOrderSchema = z.object({
  opportunityId: z.string().min(1, "Opportunity is required"),
  quotationId: z.string().optional().or(z.literal("")),
  customerName: z.string().min(2, "Customer name is required").max(200),
  paymentTerms: z.enum(["NET_30", "NET_60", "NET_90", "CASH", "COD"]).default("NET_30"),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ---------------------------------------------------------------------------
// Timeline Event Schemas
// ---------------------------------------------------------------------------

export const createTimelineEventSchema = z.object({
  opportunityId: z.string().min(1, "Opportunity is required"),
  leadId: z.string().optional().or(z.literal("")),
  channel: z.enum(["NOTE", "EMAIL", "WHATSAPP", "SMS", "CALL", "MEETING"]).default("NOTE"),
  direction: z.enum(["OUTBOUND", "INBOUND", "INTERNAL"]).default("OUTBOUND"),
  summary: z.string().min(1, "Summary is required").max(500),
  detail: z.string().max(2000).optional().or(z.literal("")),
});

export type CreateTimelineEventInput = z.infer<typeof createTimelineEventSchema>;

// ---------------------------------------------------------------------------
// Task Schemas
// ---------------------------------------------------------------------------

export const createSalesTaskSchema = z.object({
  opportunityId: z.string().optional().or(z.literal("")),
  leadId: z.string().optional().or(z.literal("")),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional().or(z.literal("")),
  dueDate: z.string().min(1, "Due date is required"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
});

export type CreateSalesTaskInput = z.infer<typeof createSalesTaskSchema>;

// ---------------------------------------------------------------------------
// Lead Conversion Schema (for lead-to-opportunity)
// ---------------------------------------------------------------------------

export const convertLeadSchema = z.object({
  leadId: z.string().min(1, "Lead ID is required"),
  expectedCloseDate: z.string().optional(),
  probability: z.coerce.number().min(0).max(100).default(20),
});

export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;

// ---------------------------------------------------------------------------
// Incentive Config Schemas
// ---------------------------------------------------------------------------

export const createIncentivePlanSchema = z.object({
  name: z.string().min(2, "Plan name must be at least 2 characters").max(200),
  description: z.string().max(500).optional().or(z.literal("")),
  type: z.enum(["PERCENTAGE", "FIXED", "TIERED"], { required_error: "Plan type is required" }),
  value: z.coerce.number().min(0, "Value must be >= 0"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export type CreateIncentivePlanInput = z.infer<typeof createIncentivePlanSchema>;

// ---------------------------------------------------------------------------
// Calculation Utilities
// ---------------------------------------------------------------------------

/**
 * Calculate line total for a quotation line item.
 * - Percentage discount: qty × unitPrice × (1 - discountPercent/100)
 * - Fixed discount: qty × unitPrice - fixedDiscount
 */
export function calculateLineTotal(item: {
  quantity: number;
  unitPrice: number;
  discountType: "percentage" | "fixed";
  discountValue: number;
}): number {
  const subtotal = item.quantity * item.unitPrice;
  if (item.discountType === "percentage") {
    return subtotal * (1 - item.discountValue / 100);
  }
  return subtotal - item.discountValue;
}

/**
 * Calculate grand total for all quotation line items.
 */
export function calculateGrandTotal(items: Array<{
  quantity: number;
  unitPrice: number;
  discountType: "percentage" | "fixed";
  discountValue: number;
}>): number {
  return items.reduce((sum, item) => sum + calculateLineTotal(item), 0);
}
