/**
 * Accessibility Audit: Modal Components — axe-core
 *
 * Task 22 — stub-modals-wiring spec
 *
 * Tests 5 representative modals (1 per tier):
 *   Tier 1 (Retail): RegisterModal — device registration
 *   Tier 2 (Finance): TreasuryTransferModal — fund transfer
 *   Tier 3 (HR): CreateCaseModal — HR case creation
 *   Tier 4 (Procurement): PurchaseRequestDesk — requisition creation form
 *   Tier 6 (Inventory): AdjustmentDialog — stock adjustment
 *
 * Each test verifies:
 *   1. aria-labelledby: Modal has a title connected via aria-labelledby or DialogTitle
 *   2. Focus trapping: First interactive element gets focus on open (Radix Dialog)
 *   3. aria-describedby on error fields: Validation errors are associated with fields
 *   4. No axe violations: axe-core reports no accessibility violations
 *
 * Requirements references:
 * - Requirement 8 (Accessibility): AC 8.1-8.6
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";

// Extend Vitest expect with axe matchers
expect.extend(matchers);

// ---------------------------------------------------------------------------
// Global Mocks
// ---------------------------------------------------------------------------

const mockSession = {
  tenant_id: "test-tenant",
  user_id: "test-user",
  role: "admin",
  first_name: "Test",
  last_name: "User",
  branch_id: "branch-1",
  location_id: "loc-1",
  token: "test-token",
};

vi.mock("@/core/security/session", () => ({
  useSession: () => mockSession,
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
  toast: (...args: any[]) => mockToast(...args),
}));

const mockApiRequest = vi.fn();
vi.mock("@/core/api/apiClient", () => ({
  apiRequest: (...args: any[]) => mockApiRequest(...args),
  ApiError: class ApiError extends Error {
    status: number;
    data: any;
    constructor(message: string, status: number, data: any = null) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.data = data;
    }
  },
}));

// Mock inventory service for AdjustmentDialog
const mockRequestAdjustment = vi.fn();
vi.mock("@/core/services/inventory/inventoryService", () => ({
  inventoryService: {
    requestAdjustment: (...args: any[]) => mockRequestAdjustment(...args),
  },
}));

// Mock procurement service for PurchaseRequestDesk
vi.mock("@/core/services/procurement/procurementService", () => ({
  procurementService: {
    createSupplierMaster: vi.fn().mockResolvedValue({}),
    listSupplierMasters: vi.fn().mockResolvedValue([]),
    listSupplierBranches: vi.fn().mockResolvedValue([]),
    listCategories: vi.fn().mockResolvedValue([]),
    listRequisitions: vi.fn().mockResolvedValue([]),
    listDraftPos: vi.fn().mockResolvedValue([]),
    getSupplierRecommendations: vi.fn().mockResolvedValue([]),
    getProcurementOverview: vi.fn().mockResolvedValue({ totalRequisitions: 0, totalDraftPos: 0, pendingApprovals: 0 }),
  },
}));

// Mock finance log service
vi.mock("@/core/services/finance/logService", () => ({
  logService: {
    log: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    children
  );
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockToast.mockClear();
  mockApiRequest.mockReset();
  mockRequestAdjustment.mockReset();
  document.body.style.pointerEvents = "auto";
});

afterEach(() => {
  cleanup();
  document.body.style.pointerEvents = "auto";
});

// ===========================================================================
// TIER 1: RegisterModal (Retail — Device Registration)
// ===========================================================================

describe("Tier 1 — RegisterModal: Accessibility", () => {
  let RegisterModal: any;

  beforeEach(async () => {
    const mod = await import(
      "@/pages/retail/management/components/device-control/RegisterModal"
    );
    RegisterModal = mod.default;
  });

  test("aria-labelledby: dialog has accessible title via DialogTitle", () => {
    render(
      React.createElement(TestWrapper, null,
        React.createElement(RegisterModal, {
          open: true,
          tab: "devices",
          onClose: vi.fn(),
        })
      )
    );

    // Radix Dialog automatically associates DialogTitle with the dialog role via aria-labelledby
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-labelledby");
    expect(screen.getByText(/Register New Device/i)).toBeInTheDocument();
  });

  test("focus trapping: first interactive element receives focus on open", async () => {
    render(
      React.createElement(TestWrapper, null,
        React.createElement(RegisterModal, {
          open: true,
          tab: "devices",
          onClose: vi.fn(),
        })
      )
    );

    // The first focusable element in RegisterModal is the name input (has autoFocus)
    await waitFor(() => {
      const nameInput = screen.getByLabelText(/Device Name/i);
      expect(nameInput).toHaveFocus();
    });
  });

  test("aria-describedby on error fields: validation errors linked to fields", async () => {
    render(
      React.createElement(TestWrapper, null,
        React.createElement(RegisterModal, {
          open: true,
          tab: "devices",
          onClose: vi.fn(),
        })
      )
    );

    // Submit without filling required fields to trigger validation errors
    const submitBtn = screen.getByRole("button", { name: /Register Device/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Wait for validation error to appear
    await waitFor(() => {
      expect(screen.getByText("Type is required")).toBeInTheDocument();
    });

    // The error element should have role="alert" for screen reader announcement
    const errorEl = screen.getByText("Type is required");
    expect(errorEl).toHaveAttribute("role", "alert");
    // Verify error message element has an id (for aria-describedby linkage)
    expect(errorEl).toHaveAttribute("id");
  });

  test("no axe violations on open modal", async () => {
    const { container } = render(
      React.createElement(TestWrapper, null,
        React.createElement(RegisterModal, {
          open: true,
          tab: "devices",
          onClose: vi.fn(),
        })
      )
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ===========================================================================
// TIER 2: TreasuryTransferModal (Finance — Fund Transfer)
// ===========================================================================

describe("Tier 2 — TreasuryTransferModal: Accessibility", () => {
  let TreasuryTransferModal: any;

  const testSources = [
    { id: "acc-1", name: "Operating Account", currency: "USD" },
    { id: "acc-2", name: "Reserve Account", currency: "USD" },
  ];

  beforeEach(async () => {
    const mod = await import("@/core/finance/FinanceModalForms");
    TreasuryTransferModal = mod.TreasuryTransferModal;
  });

  test("aria-labelledby: dialog has accessible title via DialogTitle", () => {
    render(
      React.createElement(TestWrapper, null,
        React.createElement(TreasuryTransferModal, {
          isOpen: true,
          onClose: vi.fn(),
          sources: testSources,
        })
      )
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-labelledby");
    expect(screen.getByText("Treasury Transfer")).toBeInTheDocument();
  });

  test("focus trapping: first interactive element receives focus on open", async () => {
    render(
      React.createElement(TestWrapper, null,
        React.createElement(TreasuryTransferModal, {
          isOpen: true,
          onClose: vi.fn(),
          sources: testSources,
        })
      )
    );

    // Radix Dialog moves focus to first focusable element within DialogContent
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  test("aria-describedby on error fields: validation errors linked to fields", async () => {
    render(
      React.createElement(TestWrapper, null,
        React.createElement(TreasuryTransferModal, {
          isOpen: true,
          onClose: vi.fn(),
          sources: testSources,
        })
      )
    );

    // Submit to trigger validation errors (required fields empty)
    const saveBtn = screen.getByRole("button", { name: /Save/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // Wait for validation errors — FormControl adds aria-describedby and aria-invalid
    await waitFor(() => {
      const invalidInputs = document.querySelectorAll("[aria-invalid='true']");
      expect(invalidInputs.length).toBeGreaterThan(0);
    });

    // Verify aria-describedby is set on invalid fields (includes form-item-message id)
    const invalidFields = document.querySelectorAll("[aria-invalid='true']");
    for (const field of invalidFields) {
      expect(field).toHaveAttribute("aria-describedby");
    }
  });

  test("no axe violations on open modal", async () => {
    const { container } = render(
      React.createElement(TestWrapper, null,
        React.createElement(TreasuryTransferModal, {
          isOpen: true,
          onClose: vi.fn(),
          sources: testSources,
        })
      )
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ===========================================================================
// TIER 3: CreateCaseModal (HR — Case Creation)
// ===========================================================================

describe("Tier 3 — CreateCaseModal: Accessibility", () => {
  let CreateCaseModal: any;

  const testEmployees = [
    { id: "emp-1", fullName: "Alice Johnson" },
    { id: "emp-2", fullName: "Bob Smith" },
  ];

  beforeEach(async () => {
    const mod = await import("@/pages/core/HR/modals/CreateCaseModal");
    CreateCaseModal = mod.CreateCaseModal;
  });

  test("aria-labelledby: dialog has accessible title via DialogTitle", () => {
    render(
      React.createElement(TestWrapper, null,
        React.createElement(CreateCaseModal, {
          isOpen: true,
          onClose: vi.fn(),
          employees: testEmployees,
        })
      )
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-labelledby");
    expect(screen.getByText("Create Case")).toBeInTheDocument();
  });

  test("focus trapping: first interactive element receives focus on open", async () => {
    render(
      React.createElement(TestWrapper, null,
        React.createElement(CreateCaseModal, {
          isOpen: true,
          onClose: vi.fn(),
          employees: testEmployees,
        })
      )
    );

    // Radix Dialog focus traps within the dialog content
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  test("aria-describedby on error fields: validation errors linked to fields", async () => {
    render(
      React.createElement(TestWrapper, null,
        React.createElement(CreateCaseModal, {
          isOpen: true,
          onClose: vi.fn(),
          employees: testEmployees,
        })
      )
    );

    // Submit without filling required fields
    const saveBtn = screen.getByRole("button", { name: /Save/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // Wait for validation errors from FormMessage components
    await waitFor(() => {
      const invalidInputs = document.querySelectorAll("[aria-invalid='true']");
      expect(invalidInputs.length).toBeGreaterThan(0);
    });

    // FormControl adds aria-describedby referencing FormMessage id when error exists
    const invalidFields = document.querySelectorAll("[aria-invalid='true']");
    for (const field of invalidFields) {
      expect(field).toHaveAttribute("aria-describedby");
      // The aria-describedby should reference an element with the error message
      const describedByIds = field.getAttribute("aria-describedby")!.split(" ");
      const hasMessageId = describedByIds.some((id) => id.includes("form-item-message"));
      expect(hasMessageId).toBe(true);
    }
  });

  test("no axe violations on open modal", async () => {
    const { container } = render(
      React.createElement(TestWrapper, null,
        React.createElement(CreateCaseModal, {
          isOpen: true,
          onClose: vi.fn(),
          employees: testEmployees,
          defaultEmployeeId: "emp-1",
        })
      )
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ===========================================================================
// TIER 4: PurchaseRequestDesk — Requisition Form (Procurement)
// ===========================================================================

describe("Tier 4 — PurchaseRequestDesk Requisition Form: Accessibility", () => {
  let PurchaseRequestDesk: any;

  beforeEach(async () => {
    const mod = await import("@/pages/core/procurement/PurchaseRequestDesk");
    PurchaseRequestDesk = mod.default;
  });

  test("aria-labelledby: requisition dialog has accessible title", async () => {
    render(
      React.createElement(TestWrapper, null,
        React.createElement(PurchaseRequestDesk)
      )
    );

    // Wait for loading to complete and "Create Requisition" button to appear
    await waitFor(() => {
      expect(screen.getByText(/Create Requisition/i)).toBeInTheDocument();
    });

    // Open the requisition dialog
    await act(async () => {
      fireEvent.click(screen.getByText(/Create Requisition/i));
    });

    // The dialog should be open
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute("aria-labelledby");
    });
  });

  test("focus trapping: focus is within dialog when requisition form opens", async () => {
    render(
      React.createElement(TestWrapper, null,
        React.createElement(PurchaseRequestDesk)
      )
    );

    await waitFor(() => {
      expect(screen.getByText(/Create Requisition/i)).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/Create Requisition/i));
    });

    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  test("aria-describedby on error fields: validation errors linked to form fields", async () => {
    render(
      React.createElement(TestWrapper, null,
        React.createElement(PurchaseRequestDesk)
      )
    );

    await waitFor(() => {
      expect(screen.getByText(/Create Requisition/i)).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/Create Requisition/i));
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Submit the form without filling required fields
    const submitBtn = screen.getByRole("button", { name: /Submit Request/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Wait for validation errors within the dialog
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      const errorElements = dialog.querySelectorAll("[role='alert']");
      expect(errorElements.length).toBeGreaterThan(0);
    });

    // Check that error elements within the dialog have proper id attributes for aria-describedby linkage
    const dialog = screen.getByRole("dialog");
    const errorElements = dialog.querySelectorAll("[role='alert']");
    for (const errorEl of errorElements) {
      expect(errorEl).toHaveAttribute("id");
    }
  });

  test("no axe violations on requisition dialog", async () => {
    const { container } = render(
      React.createElement(TestWrapper, null,
        React.createElement(PurchaseRequestDesk)
      )
    );

    await waitFor(() => {
      expect(screen.getByText(/Create Requisition/i)).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/Create Requisition/i));
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ===========================================================================
// TIER 6: AdjustmentDialog (Inventory — Stock Adjustment)
// ===========================================================================

describe("Tier 6 — AdjustmentDialog: Accessibility", () => {
  let AdjustmentDialog: any;

  const mockBalance = {
    balance: {
      location_id: "LOC-JKT",
      department_id: "DEPT-MAIN",
      quantity: 100,
    },
    item: {
      id: "item-1",
      name: "Widget Alpha",
      sku: "WGT-001",
    },
  };

  beforeEach(async () => {
    const mod = await import(
      "@/pages/core/inventory/components/AdjustmentDialog"
    );
    AdjustmentDialog = mod.AdjustmentDialog;
  });

  test("aria-labelledby: dialog has accessible title via DialogTitle", () => {
    render(
      React.createElement(TestWrapper, null,
        React.createElement(AdjustmentDialog, {
          open: true,
          onOpenChange: vi.fn(),
          selectedBalance: mockBalance,
          onSuccess: vi.fn(),
        })
      )
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-labelledby");
    expect(screen.getByText("Stock Adjustment Request")).toBeInTheDocument();
  });

  test("focus trapping: focus is within dialog on open", async () => {
    render(
      React.createElement(TestWrapper, null,
        React.createElement(AdjustmentDialog, {
          open: true,
          onOpenChange: vi.fn(),
          selectedBalance: mockBalance,
          onSuccess: vi.fn(),
        })
      )
    );

    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  test("aria-describedby on error fields: validation errors linked to fields", async () => {
    render(
      React.createElement(TestWrapper, null,
        React.createElement(AdjustmentDialog, {
          open: true,
          onOpenChange: vi.fn(),
          selectedBalance: mockBalance,
          onSuccess: vi.fn(),
        })
      )
    );

    // Submit without filling reason (required field)
    const submitBtn = screen.getByRole("button", { name: /Submit Adjustment/i });
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Quantity Delta/i), {
        target: { value: "10" },
      });
      fireEvent.click(submitBtn);
    });

    // Wait for validation error
    await waitFor(() => {
      const reasonInput = screen.getByLabelText(/Reason/i);
      expect(reasonInput).toHaveAttribute("aria-invalid", "true");
    });

    // Verify aria-describedby is set to the error message element
    const reasonInput = screen.getByLabelText(/Reason/i);
    expect(reasonInput).toHaveAttribute("aria-describedby", "reason-error");
    // The error element should exist
    const errorEl = document.getElementById("reason-error");
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveAttribute("role", "alert");
  });

  test("no axe violations on open modal", async () => {
    const { container } = render(
      React.createElement(TestWrapper, null,
        React.createElement(AdjustmentDialog, {
          open: true,
          onOpenChange: vi.fn(),
          selectedBalance: mockBalance,
          onSuccess: vi.fn(),
        })
      )
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
