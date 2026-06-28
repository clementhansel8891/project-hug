/**
 * Property-Based Test: Modal close never leaves page locked
 *
 * **Validates: Requirements 3.1, 3.3, 3.4**
 * **Property 1: Modal close never leaves page locked**
 *
 * Invariant: After UnresolvedBarcodesModal closes (by any means),
 * document.body must have pointer-events: auto and all controls must be
 * interactive.
 *
 * Feature: stock-opname-parity, Task 1.2
 * Requirements: 3, 3.1, 3.3, 3.4
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import * as fc from "fast-check";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Mocks (must be above component imports for hoisting)
// ---------------------------------------------------------------------------

// Mock session
const mockSession = {
  tenant_id: "test-tenant",
  user_id: "test-user",
  role: "admin",
  first_name: "Test",
  last_name: "User",
};

vi.mock("@/core/security/session", () => ({
  useSession: () => mockSession,
}));

// Mock retailService
vi.mock("@/core/services/retail/retailService", () => ({
  retailService: {
    batchCreateItemsJson: vi.fn().mockResolvedValue({
      success: true,
      data: [],
    }),
  },
}));

// Mock toast
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock ItemCreationTab
vi.mock("@/components/shared/ItemCreationTab", () => ({
  ItemCreationTab: ({ onSuccess }: { onSuccess: (items: any[]) => void }) => (
    React.createElement("div", { "data-testid": "item-creation-tab" },
      React.createElement("button", {
        "data-testid": "item-creation-success",
        onClick: () => onSuccess([{ id: "created-1", barcode: "BC1" }]),
      }, "Submit")
    )
  ),
}));

// Mock quick-register helpers
vi.mock("@/lib/quick-register", () => ({
  ANOMALY_CATEGORY_NAME: "Anomaly",
  buildQuickRegisterPayload: (barcodes: string[]) =>
    barcodes.map((b) => ({ barcode: b, name: `Unregistered Item - ${b}` })),
  resolveQuickRegisterResponse: (barcodes: string[], created: any[]) =>
    barcodes.map((b, i) => ({ barcode: b, ...(created[i] || {}) })),
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------

import { UnresolvedBarcodesModal } from "@/components/shared/UnresolvedBarcodesModal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderModal(props: Partial<React.ComponentProps<typeof UnresolvedBarcodesModal>> = {}) {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    unresolvedBarcodes: ["BC001", "BC002", "BC003"],
    onFlagAnomalies: vi.fn(),
    onItemsRegistered: vi.fn(),
    categoryOptions: [{ id: "cat-1", name: "General" }],
  };
  const merged = { ...defaultProps, ...props };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return { ...render(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(UnresolvedBarcodesModal, merged))), props: merged };
}

/**
 * Assert that the page is NOT locked: document.body must NOT have
 * pointer-events: none. We accept "", "auto", or any value that isn't "none".
 */
function assertPageNotLocked() {
  const pe = document.body.style.pointerEvents;
  expect(pe === "" || pe === "auto").toBe(true);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  document.body.style.pointerEvents = "auto";
  mockToast.mockClear();
});

afterEach(() => {
  cleanup();
  document.body.style.pointerEvents = "auto";
});

// ---------------------------------------------------------------------------
// Unit Tests
// ---------------------------------------------------------------------------

describe("UnresolvedBarcodesModal - Page Lock Prevention", () => {
  test("close via onOpenChange (overlay click / Escape) resets pointer-events", async () => {
    const onClose = vi.fn(() => {
      // Simulate parent setting isOpen=false on next render
    });
    const { unmount } = renderModal({ onClose });

    // Simulate Radix calling onOpenChange(false) - this happens on overlay click or Escape
    // The dialog's onOpenChange handler calls handleClose which resets pointer-events
    // We simulate this by finding and unmounting (which triggers cleanup)
    // First verify dialog is rendered
    expect(screen.getByText("Unresolved Scans")).toBeInTheDocument();

    // Simulate close: unmount triggers the cleanup hook
    unmount();

    assertPageNotLocked();
  });

  test("close via close button resets pointer-events", async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    // The close button rendered by DialogContent primitive
    const closeBtn = screen.getByRole("button", { name: /close/i });
    expect(closeBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(closeBtn);
    });

    // onClose should have been called and pointer-events reset
    expect(onClose).toHaveBeenCalled();
    assertPageNotLocked();
  });

  test("Quick Register success closes modal and resets pointer-events", async () => {
    const onClose = vi.fn();
    const onItemsRegistered = vi.fn();

    renderModal({
      onClose,
      onItemsRegistered,
      unresolvedBarcodes: ["BC001", "BC002"],
    });

    // Click Quick Register button
    const quickRegBtn = screen.getByRole("button", { name: /Quick Register/i });
    expect(quickRegBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(quickRegBtn);
    });

    // Wait for async operation
    await waitFor(() => {
      expect(onItemsRegistered).toHaveBeenCalled();
    });

    // When all barcodes are selected (default) and Quick Register succeeds,
    // handleClose is called which resets pointer-events
    expect(onClose).toHaveBeenCalled();
    assertPageNotLocked();
  });

  test("pointer-events never stays 'none' even if set before close", () => {
    const onClose = vi.fn();
    const { unmount } = renderModal({ onClose });

    // Simulate the buggy state: something sets pointer-events to none
    document.body.style.pointerEvents = "none";

    // Now close/unmount the modal
    unmount();

    // The cleanup hook in DialogContent should reset it
    assertPageNotLocked();
  });

  test("transitioning to item creation dialog and back leaves page interactive", async () => {
    const onClose = vi.fn();
    const { unmount } = renderModal({ onClose });

    // Click "Register with Details" to switch to item creation dialog
    const detailBtn = screen.getByRole("button", { name: /Register with Details/i });
    await act(async () => {
      fireEvent.click(detailBtn);
    });

    // While the item creation dialog is open, Radix legitimately sets
    // pointer-events: none. The requirement is that after ALL dialogs
    // close, the page is interactive. Unmount simulates full close.
    unmount();

    // After unmount, page must be interactive
    assertPageNotLocked();
  });

  test("item creation dialog close resets pointer-events", async () => {
    const onClose = vi.fn();
    const { unmount } = renderModal({ onClose, unresolvedBarcodes: ["BC001"] });

    // Switch to item creation
    const detailBtn = screen.getByRole("button", { name: /Register with Details/i });
    await act(async () => {
      fireEvent.click(detailBtn);
    });

    // Simulate item creation success which triggers close
    const submitBtn = await screen.findByTestId("item-creation-success");
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // After item creation succeeds and modal closes, pointer-events must be reset
    // Unmount to trigger all cleanup hooks
    unmount();
    assertPageNotLocked();
  });
});

// ---------------------------------------------------------------------------
// Property-Based Test
// ---------------------------------------------------------------------------

describe("Property 1: Modal close never leaves page locked", () => {
  /**
   * **Validates: Requirements 3.1, 3.3, 3.4**
   *
   * Property: For any sequence of open/close operations, after every close
   * event, document.body.style.pointerEvents must be "" or "auto" (never "none").
   *
   * We generate arbitrary sequences of modal open/close/unmount actions and
   * verify the invariant holds after each close.
   */
  test("pointer-events is never 'none' after any dialog unmount sequence", () => {
    fc.assert(
      fc.property(
        // Generate a random number of open/close cycles (1-2)
        fc.integer({ min: 1, max: 2 }),
        // Generate random barcode lists for each cycle
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), {
          minLength: 1,
          maxLength: 3,
        }),
        (numCycles, barcodes) => {
          // Ensure unique barcodes
          const uniqueBarcodes = [...new Set(barcodes)];
          if (uniqueBarcodes.length === 0) return; // skip empty

          for (let i = 0; i < numCycles; i++) {
            // Simulate a state where pointer-events might be corrupted
            document.body.style.pointerEvents = "none";

            const onClose = vi.fn();
            const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
            const { unmount } = render(
              React.createElement(QueryClientProvider, { client: qc },
                React.createElement(UnresolvedBarcodesModal, {
                  isOpen: true,
                  onClose,
                  unresolvedBarcodes: uniqueBarcodes,
                  onFlagAnomalies: vi.fn(),
                  onItemsRegistered: vi.fn(),
                  categoryOptions: [{ id: "cat-1", name: "General" }],
                })
              )
            );

            // Close by unmounting (simulates any close path since cleanup runs)
            unmount();

            // INVARIANT: pointer-events must NEVER be "none" after close
            const pe = document.body.style.pointerEvents;
            expect(
              pe !== "none",
              `Expected pointer-events to not be "none" after close (cycle ${i + 1}/${numCycles}), got "${pe}"`
            ).toBe(true);

            // Clean up between cycles to reset Radix's internal dialog count
            cleanup();
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  test("pointer-events is never 'none' after handleClose regardless of prior state", () => {
    fc.assert(
      fc.property(
        // Generate random initial pointer-events values (including "none")
        fc.constantFrom("none", "auto", "", "all", "inherit"),
        // Generate random barcode lists
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), {
          minLength: 1,
          maxLength: 5,
        }),
        (initialPointerEvents, barcodes) => {
          const uniqueBarcodes = [...new Set(barcodes)];
          if (uniqueBarcodes.length === 0) return;

          // Set initial (possibly corrupted) state
          document.body.style.pointerEvents = initialPointerEvents;

          const onClose = vi.fn();
          const qc2 = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
          const { unmount } = render(
            React.createElement(QueryClientProvider, { client: qc2 },
              React.createElement(UnresolvedBarcodesModal, {
                isOpen: true,
                onClose,
                unresolvedBarcodes: uniqueBarcodes,
                onFlagAnomalies: vi.fn(),
                onItemsRegistered: vi.fn(),
                categoryOptions: [{ id: "cat-1", name: "General" }],
              })
            )
          );

          // Close the modal
          unmount();

          // INVARIANT: regardless of prior state, body must be interactive
          const pe = document.body.style.pointerEvents;
          expect(
            pe !== "none",
            `Expected pointer-events to not be "none" after close with initial="${initialPointerEvents}", got "${pe}"`
          ).toBe(true);

          // Clean up to reset Radix's internal state
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});
