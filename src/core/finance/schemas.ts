/**
 * Finance Module Zod Schemas
 *
 * Validates all Finance domain entities including:
 * - Journal Entries (double-entry accounting with balance validation)
 * - Assets (CAPEX requests, impairment, revaluation, disposal)
 * - Reconciliation (bank vs book balance)
 * - Payments (outgoing transfers)
 * - Receivables / Payables
 * - Treasury transfers
 * - Policies
 * - Invoice capture
 * - Depreciation runs
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 16.1
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const paymentMethodEnum = z.enum([
  "BANK_TRANSFER",
  "QRIS",
  "GOPAY",
  "OVO",
  "DANA",
  "SHOPEEPAY",
  "CARD",
]);

export const assetClassEnum = z.enum([
  "LAND",
  "BUILDING",
  "MACHINERY",
  "VEHICLE",
  "FURNITURE",
  "EQUIPMENT",
  "SOFTWARE",
  "OTHER",
]);

export const depreciationMethodEnum = z.enum([
  "STRAIGHT_LINE",
  "DECLINING_BALANCE",
  "UNIT_OF_PRODUCTION",
]);

export const disposalTypeEnum = z.enum(["SALE", "WRITE_OFF", "RETIREMENT"]);

export const currencyEnum = z.enum(["IDR", "USD"]);

// ---------------------------------------------------------------------------
// Journal Entry Schema (Double-Entry Accounting)
// ---------------------------------------------------------------------------

export const journalLineSchema = z.object({
  accountCode: z.string().min(1, "Account code is required"),
  description: z.string().default(""),
  debit: z.coerce.number().min(0, "Debit must be >= 0"),
  credit: z.coerce.number().min(0, "Credit must be >= 0"),
});

/**
 * Journal Entry schema with double-entry accounting validation.
 *
 * Enforces:
 * 1. lineItems.length >= 2
 * 2. |sum(debits) - sum(credits)| <= 0.01
 *
 * Requirements: 2.2, 2.4
 */
export const journalEntrySchema = z
  .object({
    description: z.string().min(1, "Description is required"),
    ref: z.string().optional(),
    lines: z.array(journalLineSchema).min(2, "At least 2 line items required"),
  })
  .refine(
    (data) => {
      const totalDebits = data.lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredits = data.lines.reduce((sum, l) => sum + l.credit, 0);
      return Math.abs(totalDebits - totalCredits) <= 0.01;
    },
    {
      message: "Total debits must equal total credits (within 0.01 tolerance)",
      path: ["lines"],
    }
  );

export type JournalEntryFormData = z.infer<typeof journalEntrySchema>;

// ---------------------------------------------------------------------------
// Asset / CAPEX Request Schema
// ---------------------------------------------------------------------------

export const capexRequestSchema = z.object({
  assetDescription: z.string().min(1, "Asset description is required"),
  requestedAmount: z.coerce.number().positive("Amount must be greater than 0"),
  department: z.string().min(1, "Department is required"),
  projectCode: z.string().optional(),
  location: z.string().optional(),
  acquisitionDate: z.string().optional(),
  usefulLifeYears: z.coerce.number().int().min(1, "Useful life must be at least 1 year").default(5),
  residualValue: z.coerce.number().min(0, "Residual value must be >= 0").default(0),
  depreciationMethod: depreciationMethodEnum.default("STRAIGHT_LINE"),
  assetClass: assetClassEnum.default("EQUIPMENT"),
});

export type CapexRequestFormData = z.infer<typeof capexRequestSchema>;

// ---------------------------------------------------------------------------
// Register Asset Schema
// ---------------------------------------------------------------------------

export const registerAssetSchema = z.object({
  description: z.string().min(1, "Asset description is required"),
  assetClass: assetClassEnum.default("EQUIPMENT"),
  location: z.string().min(1, "Location is required"),
  department: z.string().min(1, "Department is required"),
  acquisitionCost: z.coerce.number().positive("Acquisition cost must be > 0"),
  acquisitionDate: z.string().min(1, "Acquisition date is required"),
  usefulLifeYears: z.coerce.number().int().min(1, "Useful life must be at least 1 year"),
  residualValue: z.coerce.number().min(0, "Residual value must be >= 0").default(0),
  depreciationMethod: depreciationMethodEnum.default("STRAIGHT_LINE"),
});

export type RegisterAssetFormData = z.infer<typeof registerAssetSchema>;

// ---------------------------------------------------------------------------
// Asset Impairment Schema
// ---------------------------------------------------------------------------

export const assetImpairmentSchema = z.object({
  assetId: z.string().min(1),
  impairmentAmount: z.coerce.number().positive("Impairment amount must be > 0"),
  reason: z.string().min(1, "Reason is required"),
});

export type AssetImpairmentFormData = z.infer<typeof assetImpairmentSchema>;

// ---------------------------------------------------------------------------
// Asset Revaluation Schema
// ---------------------------------------------------------------------------

export const assetRevaluationSchema = z.object({
  assetId: z.string().min(1),
  revaluedAmount: z.coerce.number().positive("Revalued amount must be > 0"),
  reason: z.string().min(1, "Reason is required"),
});

export type AssetRevaluationFormData = z.infer<typeof assetRevaluationSchema>;

// ---------------------------------------------------------------------------
// Asset Disposal Schema
// ---------------------------------------------------------------------------

export const assetDisposalSchema = z.object({
  assetId: z.string().min(1),
  disposalType: disposalTypeEnum,
  proceeds: z.coerce.number().min(0, "Proceeds must be >= 0").default(0),
});

export type AssetDisposalFormData = z.infer<typeof assetDisposalSchema>;

// ---------------------------------------------------------------------------
// Asset Edit Schema
// ---------------------------------------------------------------------------

export const assetEditSchema = z.object({
  assetId: z.string().min(1),
  description: z.string().min(1, "Asset description is required"),
  assetClass: assetClassEnum,
  location: z.string().min(1, "Location is required"),
  department: z.string().min(1, "Department is required"),
  usefulLifeYears: z.coerce.number().int().min(1, "Useful life must be at least 1 year"),
  residualValue: z.coerce.number().min(0, "Residual value must be >= 0").default(0),
  depreciationMethod: depreciationMethodEnum,
});

export type AssetEditFormData = z.infer<typeof assetEditSchema>;

// ---------------------------------------------------------------------------
// Asset Transfer Schema
// ---------------------------------------------------------------------------

export const assetTransferSchema = z.object({
  assetId: z.string().min(1),
  destinationLocation: z.string().min(1, "Destination location is required"),
  destinationDepartment: z.string().min(1, "Destination department is required"),
  transferDate: z.string().min(1, "Transfer date is required"),
  reason: z.string().min(1, "Reason is required"),
});

export type AssetTransferFormData = z.infer<typeof assetTransferSchema>;

// ---------------------------------------------------------------------------
// Asset Maintenance Schema
// ---------------------------------------------------------------------------

export const assetMaintenanceSchema = z.object({
  assetId: z.string().min(1),
  maintenanceType: z.enum(["PREVENTIVE", "CORRECTIVE", "INSPECTION", "OVERHAUL"]),
  cost: z.coerce.number().min(0, "Cost must be >= 0"),
  maintenanceDate: z.string().min(1, "Maintenance date is required"),
  notes: z.string().optional().default(""),
});

export type AssetMaintenanceFormData = z.infer<typeof assetMaintenanceSchema>;

// ---------------------------------------------------------------------------
// Asset Import Schema
// ---------------------------------------------------------------------------

export const assetImportSchema = z.object({
  fileContent: z.string().min(1, "File content is required"),
  fileName: z.string().min(1, "File name is required"),
  format: z.enum(["CSV", "XLSX"]).default("CSV"),
});

export type AssetImportFormData = z.infer<typeof assetImportSchema>;

// ---------------------------------------------------------------------------
// Depreciation Run Schema
// ---------------------------------------------------------------------------

export const depreciationRunSchema = z.object({
  periodStart: z.string().min(1, "Period start is required"),
  periodEnd: z.string().min(1, "Period end is required"),
  postingDate: z.string().min(1, "Posting date is required"),
  cfoSignoff: z.boolean().default(true),
});

export type DepreciationRunFormData = z.infer<typeof depreciationRunSchema>;

// ---------------------------------------------------------------------------
// Reconciliation Schema
// ---------------------------------------------------------------------------

export const reconciliationSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  periodStart: z.string().min(1, "Period start is required"),
  periodEnd: z.string().min(1, "Period end is required"),
  bankBalance: z.coerce.number({ required_error: "Bank balance is required" }),
  bookBalance: z.coerce.number({ required_error: "Book balance is required" }),
  notes: z.string().optional(),
});

export type ReconciliationFormData = z.infer<typeof reconciliationSchema>;

// ---------------------------------------------------------------------------
// Payment Schema
// ---------------------------------------------------------------------------

export const paymentSchema = z.object({
  beneficiary: z.string().min(1, "Recipient is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  method: paymentMethodEnum.default("BANK_TRANSFER"),
  purpose: z.string().min(1, "Purpose is required"),
  source: z.string().optional(),
  department: z.string().optional(),
  currency: currencyEnum.default("IDR"),
  scheduledDate: z.string().optional(),
  extraInfo: z.string().optional(),
});

export type PaymentFormData = z.infer<typeof paymentSchema>;

// ---------------------------------------------------------------------------
// Receivable Schema
// ---------------------------------------------------------------------------

export const receivableSchema = z.object({
  customer: z.string().min(1, "Customer name is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  dueDate: z.string().min(1, "Due date is required"),
  invoiceDate: z.string().optional(),
  currency: currencyEnum.default("IDR"),
});

export type ReceivableFormData = z.infer<typeof receivableSchema>;

// ---------------------------------------------------------------------------
// Payable Schema
// ---------------------------------------------------------------------------

export const payableSchema = z.object({
  vendor: z.string().min(1, "Vendor name is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  dueDate: z.string().min(1, "Due date is required"),
  currency: currencyEnum.default("IDR"),
});

export type PayableFormData = z.infer<typeof payableSchema>;

// ---------------------------------------------------------------------------
// Invoice Capture Schema
// ---------------------------------------------------------------------------

export const invoiceCaptureSchema = z.object({
  vendor: z.string().min(1, "Vendor name is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  invoiceDate: z.string().min(1, "Invoice date is required"),
  dueDate: z.string().min(1, "Due date is required"),
});

export type InvoiceCaptureFormData = z.infer<typeof invoiceCaptureSchema>;

// ---------------------------------------------------------------------------
// Treasury Transfer Schema
// ---------------------------------------------------------------------------

export const treasuryTransferSchema = z.object({
  sourceId: z.string().min(1, "Source account is required"),
  destinationId: z.string().min(1, "Destination account is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  description: z.string().min(1, "Description is required"),
});

export type TreasuryTransferFormData = z.infer<typeof treasuryTransferSchema>;

// ---------------------------------------------------------------------------
// Policy Schema
// ---------------------------------------------------------------------------

export const policySchema = z.object({
  title: z.string().min(1, "Policy title is required"),
  type: z.string().min(1, "Policy type is required"),
  description: z.string().min(1, "Description is required"),
  threshold: z.coerce.number().min(0, "Threshold must be >= 0"),
});

export type PolicyFormData = z.infer<typeof policySchema>;

// ---------------------------------------------------------------------------
// CAPEX Budget Schema
// ---------------------------------------------------------------------------

export const capexBudgetSchema = z.object({
  department: z.string().min(1, "Department is required"),
  totalBudget: z.coerce.number().positive("Budget must be > 0"),
  fiscalYear: z.string().min(1, "Fiscal year is required"),
});

export type CapexBudgetFormData = z.infer<typeof capexBudgetSchema>;

// ---------------------------------------------------------------------------
// Close Period Schema
// ---------------------------------------------------------------------------

export const closePeriodSchema = z.object({
  periodId: z.string().min(1, "Period is required"),
  notes: z.string().optional(),
});

export type ClosePeriodFormData = z.infer<typeof closePeriodSchema>;

// ---------------------------------------------------------------------------
// Payroll Run Schema
// ---------------------------------------------------------------------------

export const payrollRunSchema = z.object({
  period: z.string().min(1, "Period is required"),
});

export type PayrollRunFormData = z.infer<typeof payrollRunSchema>;

// ---------------------------------------------------------------------------
// Source Limit Schema (Money Desk edit limits)
// ---------------------------------------------------------------------------

export const sourceLimitSchema = z.object({
  sourceId: z.string().min(1),
  limitMin: z.coerce.number().min(0, "Minimum limit must be >= 0"),
  limitMax: z.coerce.number().positive("Maximum limit must be > 0"),
});

export type SourceLimitFormData = z.infer<typeof sourceLimitSchema>;

// ---------------------------------------------------------------------------
// Finance Document Upload Schema
// ---------------------------------------------------------------------------

export const documentUploadSchema = z.object({
  title: z.string().min(1, "Document title is required"),
  type: z.string().min(1, "Document type is required"),
  description: z.string().optional(),
});

export type DocumentUploadFormData = z.infer<typeof documentUploadSchema>;

// ---------------------------------------------------------------------------
// Payslip Template Schema
// ---------------------------------------------------------------------------

export const payslipConfigSchema = z.object({
  templateName: z.string().min(1, "Template name is required"),
  companyName: z.string().min(1, "Company name is required"),
  logoUrl: z.string().optional(),
});

export type PayslipConfigFormData = z.infer<typeof payslipConfigSchema>;

// ---------------------------------------------------------------------------
// Budget Planning Schema
// ---------------------------------------------------------------------------

export const budgetLineSchema = z.object({
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be > 0"),
  period: z.string().min(1, "Period is required"),
});

export type BudgetLineFormData = z.infer<typeof budgetLineSchema>;

// ---------------------------------------------------------------------------
// Settlement Reconciliation Schema
// ---------------------------------------------------------------------------

export const settlementReconcileSchema = z.object({
  sourceId: z.string().min(1, "Source is required"),
  amount: z.coerce.number().positive("Amount must be > 0"),
});

export type SettlementReconcileFormData = z.infer<typeof settlementReconcileSchema>;

// ---------------------------------------------------------------------------
// Journal Entry Post Schema
// ---------------------------------------------------------------------------

export const journalPostSchema = z.object({
  entryId: z.string().min(1, "Entry ID is required"),
  postingDate: z.string().min(1, "Posting date is required"),
  notes: z.string().optional(),
});

export type JournalPostFormData = z.infer<typeof journalPostSchema>;

// ---------------------------------------------------------------------------
// Journal Entry Reverse Schema
// ---------------------------------------------------------------------------

export const journalReverseSchema = z.object({
  entryId: z.string().min(1, "Entry ID is required"),
  reversalDate: z.string().min(1, "Reversal date is required"),
  reason: z.string().min(1, "Reason for reversal is required"),
});

export type JournalReverseFormData = z.infer<typeof journalReverseSchema>;

// ---------------------------------------------------------------------------
// Treasury Source Create Schema
// ---------------------------------------------------------------------------

export const treasurySourceCreateSchema = z.object({
  name: z.string().min(1, "Source name is required"),
  type: z.enum(["BANK", "CASH_REGISTER", "E_WALLET", "GATEWAY_SETTLEMENT", "PETTY_CASH"], {
    required_error: "Source type is required",
  }),
  currency: currencyEnum.default("IDR"),
  balance: z.coerce.number().min(0, "Balance must be >= 0").default(0),
  provider: z.string().optional(),
});

export type TreasurySourceCreateFormData = z.infer<typeof treasurySourceCreateSchema>;

// ---------------------------------------------------------------------------
// Treasury Source Edit Schema
// ---------------------------------------------------------------------------

export const treasurySourceEditSchema = z.object({
  sourceId: z.string().min(1, "Source ID is required"),
  name: z.string().min(1, "Source name is required"),
  type: z.enum(["BANK", "CASH_REGISTER", "E_WALLET", "GATEWAY_SETTLEMENT", "PETTY_CASH"], {
    required_error: "Source type is required",
  }),
  currency: currencyEnum.default("IDR"),
  provider: z.string().optional(),
});

export type TreasurySourceEditFormData = z.infer<typeof treasurySourceEditSchema>;
