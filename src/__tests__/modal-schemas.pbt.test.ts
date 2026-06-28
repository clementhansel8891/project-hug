/**
 * Property-Based Tests for Zod Schema Validation — Modal Wiring
 *
 * Uses fast-check (fc.assert / fc.property) with vitest.
 * Each property runs a minimum of 100 iterations.
 *
 * Tests representative Zod schemas from each tier:
 *   Tier 1 (Retail): registerDeviceFormSchema, cashPaymentSchema
 *   Tier 2 (Finance): journalEntrySchema, treasuryTransferSchema
 *   Tier 3 (HR): createRequisitionSchema, terminateEmployeeSchema
 *   Tier 4 (Procurement): requisitionSchema, supplierMasterSchema
 *   Tier 5 (Shared): mapFieldErrors behavior
 *   Tier 6 (Inventory): stockAdjustmentSchema, createTransferSchema
 *
 * **Validates: Requirements 2.1, 2.3**
 *
 * Correctness Properties:
 *   1. Given a valid input conforming to the schema shape, schema.safeParse(input).success SHALL be true
 *   2. Given an input missing a required field, schema.safeParse(input).success SHALL be false
 *   3. Given an input with a field violating type/length/format constraints, schema.safeParse(input).success SHALL be false
 */

import { describe, test, expect } from "vitest";
import * as fc from "fast-check";
import { z } from "zod";

// Tier 2 (Finance)
import {
  journalEntrySchema,
  treasuryTransferSchema,
} from "@/core/finance/schemas";

// Tier 3 (HR)
import {
  createRequisitionSchema,
  terminateEmployeeSchema,
} from "@/pages/core/HR/schemas/index";

// Tier 4 (Procurement)
import {
  requisitionSchema,
  supplierMasterSchema,
} from "@/modules/procurement/schemas";

// Tier 6 (Inventory)
import {
  stockAdjustmentSchema,
  createTransferSchema,
} from "@/pages/core/inventory/schemas/index";

// Tier 5 (Shared) — mapFieldErrors
import { mapFieldErrors } from "@/lib/modal-helpers";

// ---------------------------------------------------------------------------
// Tier 1 Schemas — co-located in component files, so we replicate them here
// to avoid importing React component dependencies in a pure schema test.
// ---------------------------------------------------------------------------

const connTypeValues = ["tcp_ip", "usb", "bluetooth", "com_port", "wifi", "other", ""] as const;

const registerDeviceFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or fewer"),
  subType: z.string().min(1, "Type is required"),
  model: z.string().max(100).optional().default(""),
  serial: z.string().max(100).optional().default(""),
  ip: z.string().max(45).optional().default(""),
  mac: z.string().max(17).optional().default(""),
  connType: z.enum(connTypeValues).optional().default(""),
  comPort: z.string().max(20).optional().default(""),
  usbPort: z.string().max(50).optional().default(""),
  placement: z.string().max(200).optional().default(""),
  notes: z.string().max(500).optional().default(""),
});

const cashPaymentSchema = z.object({
  receivedAmount: z.number().positive("Amount must be greater than 0"),
  paymentMethod: z.literal("cash"),
  notes: z.string().max(500).optional().default(""),
});

// ---------------------------------------------------------------------------
// Arbitraries — generators for valid inputs
// ---------------------------------------------------------------------------

/** Non-empty string with configurable max length */
const nonEmptyStr = (maxLen = 50) =>
  fc.string({ minLength: 1, maxLength: maxLen }).filter((s) => s.trim().length > 0);

/** Date string in ISO-ish format YYYY-MM-DD */
const dateStr = () =>
  fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }).map(
    (d) => d.toISOString().slice(0, 10)
  );

// --- Tier 1: registerDeviceFormSchema ---
const validRegisterDevice = () =>
  fc.record({
    name: nonEmptyStr(100),
    subType: nonEmptyStr(50),
    model: fc.string({ maxLength: 100 }),
    serial: fc.string({ maxLength: 100 }),
    ip: fc.string({ maxLength: 45 }),
    mac: fc.string({ maxLength: 17 }),
    connType: fc.constantFrom(...connTypeValues),
    comPort: fc.string({ maxLength: 20 }),
    usbPort: fc.string({ maxLength: 50 }),
    placement: fc.string({ maxLength: 200 }),
    notes: fc.string({ maxLength: 500 }),
  });

// --- Tier 1: cashPaymentSchema ---
const validCashPayment = () =>
  fc.record({
    receivedAmount: fc.double({ min: 0.01, max: 1_000_000, noNaN: true }),
    paymentMethod: fc.constant("cash" as const),
    notes: fc.string({ maxLength: 500 }),
  });

// --- Tier 2: journalEntrySchema (double-entry balanced) ---
const validJournalEntry = () =>
  fc.double({ min: 0.01, max: 1_000_000, noNaN: true }).chain((amount) =>
    fc.record({
      description: nonEmptyStr(200),
      ref: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
      lines: fc.constant([
        { accountCode: "1001", description: "Debit account", debit: amount, credit: 0 },
        { accountCode: "2001", description: "Credit account", debit: 0, credit: amount },
      ]),
    })
  );

// --- Tier 2: treasuryTransferSchema ---
const validTreasuryTransfer = () =>
  fc.record({
    sourceId: nonEmptyStr(36),
    destinationId: nonEmptyStr(36),
    amount: fc.double({ min: 0.01, max: 1_000_000, noNaN: true }),
    description: nonEmptyStr(200),
  });

// --- Tier 3: createRequisitionSchema ---
const validCreateRequisition = () =>
  fc.record({
    title: nonEmptyStr(200),
    departmentId: nonEmptyStr(36),
    openings: fc.integer({ min: 1, max: 100 }),
    description: fc.string({ maxLength: 500 }),
    priority: fc.constantFrom("low", "medium", "high", "critical"),
  });

// --- Tier 3: terminateEmployeeSchema ---
const validTerminateEmployee = () =>
  fc.record({
    employeeId: nonEmptyStr(36),
    reason: nonEmptyStr(500),
    effectiveDate: dateStr(),
    finalSettlement: fc.double({ min: 0, max: 1_000_000, noNaN: true }),
  });

// --- Tier 4: requisitionSchema ---
const validRequisition = () =>
  fc.record({
    title: nonEmptyStr(200),
    description: nonEmptyStr(200),
    category: nonEmptyStr(50),
    branchCode: nonEmptyStr(20),
    budgetClass: fc.constantFrom("OPEX", "CAPEX", "EMERGENCY"),
    amount: fc.double({ min: 0.01, max: 10_000_000, noNaN: true }),
    contractRequired: fc.boolean(),
  });

// --- Tier 4: supplierMasterSchema ---
const validSupplierMaster = () =>
  fc.record({
    name: nonEmptyStr(200),
    taxId: nonEmptyStr(30),
    categories: nonEmptyStr(100),
    website: fc.constant(""),
    contactPerson: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
    contactEmail: fc.constant(""),
    contactPhone: fc.option(fc.string({ maxLength: 30 }), { nil: undefined }),
    address: fc.option(fc.string({ maxLength: 300 }), { nil: undefined }),
  });

// --- Tier 6: stockAdjustmentSchema ---
const validStockAdjustment = () =>
  fc.record({
    item_id: nonEmptyStr(36),
    location_id: nonEmptyStr(36),
    department_id: fc.string({ maxLength: 36 }),
    requested_delta: fc.integer({ min: 1, max: 10_000 }),
    reason: nonEmptyStr(500),
  });

// --- Tier 6: createTransferSchema (from != to) ---
const validCreateTransfer = () =>
  fc.tuple(nonEmptyStr(36), nonEmptyStr(36))
    .filter(([a, b]) => a !== b)
    .chain(([fromLoc, toLoc]) =>
      fc.record({
        item_id: nonEmptyStr(36),
        from_location_id: fc.constant(fromLoc),
        to_location_id: fc.constant(toLoc),
        quantity: fc.double({ min: 0.01, max: 100_000, noNaN: true }),
        from_department_id: fc.string({ maxLength: 36 }),
        to_department_id: fc.string({ maxLength: 36 }),
        reason: fc.string({ maxLength: 500 }),
      })
    );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 1: Schema Validation Consistency", () => {
  describe("Tier 1 — Retail", () => {
    test("registerDeviceFormSchema accepts valid inputs", () => {
      fc.assert(
        fc.property(validRegisterDevice(), (input) => {
          const result = registerDeviceFormSchema.safeParse(input);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    test("cashPaymentSchema accepts valid inputs", () => {
      fc.assert(
        fc.property(validCashPayment(), (input) => {
          const result = cashPaymentSchema.safeParse(input);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    test("registerDeviceFormSchema rejects missing required fields", () => {
      fc.assert(
        fc.property(validRegisterDevice(), (input) => {
          // Remove name (required)
          const withoutName = { ...input, name: "" };
          expect(registerDeviceFormSchema.safeParse(withoutName).success).toBe(false);

          // Remove subType (required)
          const withoutSubType = { ...input, subType: "" };
          expect(registerDeviceFormSchema.safeParse(withoutSubType).success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    test("cashPaymentSchema rejects invalid amounts", () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1_000_000, max: 0, noNaN: true }),
          (badAmount) => {
            const input = { receivedAmount: badAmount, paymentMethod: "cash" as const, notes: "" };
            expect(cashPaymentSchema.safeParse(input).success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("Tier 2 — Finance", () => {
    test("journalEntrySchema accepts balanced entries", () => {
      fc.assert(
        fc.property(validJournalEntry(), (input) => {
          const result = journalEntrySchema.safeParse(input);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    test("journalEntrySchema rejects unbalanced entries", () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 1_000_000, noNaN: true }),
          fc.double({ min: 1, max: 1_000_000, noNaN: true }),
          (debitAmt, creditAmt) => {
            // Only test when amounts differ beyond tolerance
            fc.pre(Math.abs(debitAmt - creditAmt) > 0.01);
            const input = {
              description: "Test entry",
              lines: [
                { accountCode: "1001", description: "", debit: debitAmt, credit: 0 },
                { accountCode: "2001", description: "", debit: 0, credit: creditAmt },
              ],
            };
            expect(journalEntrySchema.safeParse(input).success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test("journalEntrySchema rejects fewer than 2 line items", () => {
      const input = {
        description: "Test",
        lines: [{ accountCode: "1001", description: "", debit: 100, credit: 0 }],
      };
      expect(journalEntrySchema.safeParse(input).success).toBe(false);
    });

    test("treasuryTransferSchema accepts valid inputs", () => {
      fc.assert(
        fc.property(validTreasuryTransfer(), (input) => {
          const result = treasuryTransferSchema.safeParse(input);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    test("treasuryTransferSchema rejects missing required fields", () => {
      fc.assert(
        fc.property(validTreasuryTransfer(), (input) => {
          const withoutSource = { ...input, sourceId: "" };
          expect(treasuryTransferSchema.safeParse(withoutSource).success).toBe(false);

          const withoutDest = { ...input, destinationId: "" };
          expect(treasuryTransferSchema.safeParse(withoutDest).success).toBe(false);

          const withoutDesc = { ...input, description: "" };
          expect(treasuryTransferSchema.safeParse(withoutDesc).success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    test("treasuryTransferSchema rejects non-positive amounts", () => {
      fc.assert(
        fc.property(
          validTreasuryTransfer(),
          fc.double({ min: -1_000_000, max: 0, noNaN: true }),
          (input, badAmount) => {
            const invalid = { ...input, amount: badAmount };
            expect(treasuryTransferSchema.safeParse(invalid).success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("Tier 3 — HR", () => {
    test("createRequisitionSchema accepts valid inputs", () => {
      fc.assert(
        fc.property(validCreateRequisition(), (input) => {
          const result = createRequisitionSchema.safeParse(input);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    test("createRequisitionSchema rejects zero openings", () => {
      fc.assert(
        fc.property(validCreateRequisition(), (input) => {
          const invalid = { ...input, openings: 0 };
          expect(createRequisitionSchema.safeParse(invalid).success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    test("terminateEmployeeSchema accepts valid inputs", () => {
      fc.assert(
        fc.property(validTerminateEmployee(), (input) => {
          const result = terminateEmployeeSchema.safeParse(input);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    test("terminateEmployeeSchema rejects missing required fields", () => {
      fc.assert(
        fc.property(validTerminateEmployee(), (input) => {
          const noEmployee = { ...input, employeeId: "" };
          expect(terminateEmployeeSchema.safeParse(noEmployee).success).toBe(false);

          const noReason = { ...input, reason: "" };
          expect(terminateEmployeeSchema.safeParse(noReason).success).toBe(false);

          const noDate = { ...input, effectiveDate: "" };
          expect(terminateEmployeeSchema.safeParse(noDate).success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("Tier 4 — Procurement", () => {
    test("requisitionSchema accepts valid inputs", () => {
      fc.assert(
        fc.property(validRequisition(), (input) => {
          const result = requisitionSchema.safeParse(input);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    test("requisitionSchema rejects missing required fields", () => {
      fc.assert(
        fc.property(validRequisition(), (input) => {
          const noTitle = { ...input, title: "" };
          expect(requisitionSchema.safeParse(noTitle).success).toBe(false);

          const noCategory = { ...input, category: "" };
          expect(requisitionSchema.safeParse(noCategory).success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    test("requisitionSchema rejects non-positive amounts", () => {
      fc.assert(
        fc.property(
          validRequisition(),
          fc.double({ min: -1_000_000, max: 0, noNaN: true }),
          (input, badAmount) => {
            const invalid = { ...input, amount: badAmount };
            expect(requisitionSchema.safeParse(invalid).success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test("supplierMasterSchema accepts valid inputs", () => {
      fc.assert(
        fc.property(validSupplierMaster(), (input) => {
          const result = supplierMasterSchema.safeParse(input);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    test("supplierMasterSchema rejects missing name and taxId", () => {
      fc.assert(
        fc.property(validSupplierMaster(), (input) => {
          const noName = { ...input, name: "" };
          expect(supplierMasterSchema.safeParse(noName).success).toBe(false);

          const noTax = { ...input, taxId: "" };
          expect(supplierMasterSchema.safeParse(noTax).success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("Tier 5 — Shared (mapFieldErrors)", () => {
    test("mapFieldErrors maps field errors from ApiError-shaped objects onto form", () => {
      fc.assert(
        fc.property(
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /^[a-zA-Z_]\w*$/.test(s)),
            fc.string({ minLength: 1, maxLength: 100 })
          ),
          (fieldErrors) => {
            fc.pre(Object.keys(fieldErrors).length > 0);

            const errors: Record<string, { message: string }> = {};
            const mockForm = {
              setError: (field: string, opts: { message: string }) => {
                errors[field] = opts;
              },
            } as any;

            const apiError = { data: { fieldErrors }, message: "Validation failed" };
            mapFieldErrors(apiError, mockForm);

            // Every field in the error object should have been mapped
            for (const [field, msg] of Object.entries(fieldErrors)) {
              expect(errors[field]).toEqual({ message: msg });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test("mapFieldErrors does nothing when no fieldErrors present", () => {
      fc.assert(
        fc.property(fc.anything(), (errorValue) => {
          const errors: Record<string, unknown> = {};
          const mockForm = {
            setError: (field: string, opts: unknown) => {
              errors[field] = opts;
            },
          } as any;

          // Pass various non-fieldErrors shapes
          mapFieldErrors(errorValue, mockForm);
          mapFieldErrors(undefined, mockForm);
          mapFieldErrors({ data: {} }, mockForm);
          mapFieldErrors({ data: { fieldErrors: null } }, mockForm);

          expect(Object.keys(errors).length).toBe(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("Tier 6 — Inventory", () => {
    test("stockAdjustmentSchema accepts valid inputs", () => {
      fc.assert(
        fc.property(validStockAdjustment(), (input) => {
          const result = stockAdjustmentSchema.safeParse(input);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    test("stockAdjustmentSchema rejects zero delta", () => {
      fc.assert(
        fc.property(validStockAdjustment(), (input) => {
          const invalid = { ...input, requested_delta: 0 };
          expect(stockAdjustmentSchema.safeParse(invalid).success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    test("stockAdjustmentSchema rejects missing required fields", () => {
      fc.assert(
        fc.property(validStockAdjustment(), (input) => {
          const noItem = { ...input, item_id: "" };
          expect(stockAdjustmentSchema.safeParse(noItem).success).toBe(false);

          const noLocation = { ...input, location_id: "" };
          expect(stockAdjustmentSchema.safeParse(noLocation).success).toBe(false);

          const noReason = { ...input, reason: "" };
          expect(stockAdjustmentSchema.safeParse(noReason).success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    test("createTransferSchema accepts valid inputs (different locations)", () => {
      fc.assert(
        fc.property(validCreateTransfer(), (input) => {
          const result = createTransferSchema.safeParse(input);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    test("createTransferSchema rejects same origin and destination", () => {
      fc.assert(
        fc.property(nonEmptyStr(36), (location) => {
          const input = {
            item_id: "item-1",
            from_location_id: location,
            to_location_id: location,
            quantity: 10,
            from_department_id: "",
            to_department_id: "",
            reason: "Test",
          };
          expect(createTransferSchema.safeParse(input).success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    test("createTransferSchema rejects non-positive quantity", () => {
      fc.assert(
        fc.property(
          validCreateTransfer(),
          fc.double({ min: -10_000, max: 0, noNaN: true }),
          (input, badQty) => {
            const invalid = { ...input, quantity: badQty };
            expect(createTransferSchema.safeParse(invalid).success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
