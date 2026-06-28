/**
 * Property-Based Test — Stock Opname Parity
 * Spec: .kiro/specs/stock-opname-parity
 *
 * Property 1: Modal close never leaves page locked
 *   Validates: Requirements 3, 3.1, 3.3, 3.4
 *
 * This test uses fast-check to verify that after UnresolvedBarcodesModal closes
 * via any path (close button, unmount, flag anomalies),
 * document.body always has pointer-events: auto.
 *
 * TEST METHODOLOGY:
 *   - Generate arbitrary modal open/close sequences covering all exit paths
 *   - After each close operation, assert document.body.style.pointerEvents === 'auto'
 *   - Run ≥100 iterations as specified in task 8.1
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import fc from "fast-check";

// --- Mocks (hoisted) -------------------------------------------------------

const mockOnClose = vi.fn();
const mockOnFlagAnomalies = vi.fn();
const mockOnItemsRegistered = vi.fn();

const mockSession = {
  tenant_id: "tenant_1",
  user_id: "user_1",
  location_id: "loc_1",
  department_id: "dept_1",
  role: "OWNER",
  permissions: [],
};

// Mock retailService.batchCreateItemsJson
vi.mock("@/core/services/retail/retailService", () => ({
  retailService: {
    batchCreateItemsJson: vi.fn(),
    listCategories: vi.fn(),
  },
}));

// Mock session context
vi.mock("@/core/security/session", () => ({
  useSession: vi.fn(() => mockSession),
}));

// Mock toast hook
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

import { retailService } from "@/core/services/retail/retailService";
import { useSession } from "@/core/security/session";
import { UnresolvedBarcodesModal } from "@/components/shared/UnresolvedBarcodesModal";

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

const rs = retailService as unknown as {
  batchCreateItemsJson: ReturnType<typeof vi.fn>;
  listCategories: ReturnType<typeof vi.fn>;
};

// --- Setup/Teardown --------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockOnClose.mockClear();
  mockOnFlagAnomalies.mockClear();
  mockOnItemsRegistered.mockClear();
  (useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSession);
  // Reset pointer-events before each test
  resetBodyPointerEvents();
});

afterEach(() => {
  cleanup();
  // Ensure document.body pointer-events is reset after each test
  resetBodyPointerEvents();
});

// --- Helper: Check pointer-events on body ---------------------------------

function getBodyPointerEvents(): string {
  return document.body.style.pointerEvents || "auto";
}

function resetBodyPointerEvents(): void {
  document.body.style.pointerEvents = "";
}

/**
 * Wrapper component that simulates the parent controlling isOpen.
 * When onClose is called, it sets isOpen to false (mimicking real usage).
 */
function ControlledModal({
  unresolvedBarcodes,
  onCloseCallback,
  onFlagAnomalies,
  onItemsRegistered,
}: {
  unresolvedBarcodes: string[];
  onCloseCallback: () => void;
  onFlagAnomalies: (barcodes: string[]) => void;
  onItemsRegistered: (items: any[]) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(true);

  const handleClose = React.useCallback(() => {
    setIsOpen(false);
    onCloseCallback();
  }, [onCloseCallback]);

  const handleFlagAnomalies = React.useCallback(
    (barcodes: string[]) => {
      onFlagAnomalies(barcodes);
      // Parent closes modal after flagging all
      if (barcodes.length === unresolvedBarcodes.length) {
        setIsOpen(false);
        onCloseCallback();
      }
    },
    [onFlagAnomalies, onCloseCallback, unresolvedBarcodes.length]
  );

  return (
    <UnresolvedBarcodesModal
      isOpen={isOpen}
      onClose={handleClose}
      unresolvedBarcodes={unresolvedBarcodes}
      onFlagAnomalies={handleFlagAnomalies}
      onItemsRegistered={onItemsRegistered}
      categoryOptions={[]}
    />
  );
}

// --- Test: Modal close never leaves page locked ----------------------------

describe("Property 1: Modal close never leaves page locked", () => {
  it("closes cleanly via all paths with pointer-events: auto on document.body", async () => {
    const unresolvedBarcodes = ["BARCODE-001", "BARCODE-002", "BARCODE-003"];

    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Close via close button (X) - always closes
          fc.constant("closeButton"),
          // Flagging all items as anomalies - parent closes modal
          fc.constant("flagAnomaliesFull")
        ).map((operation) => ({ operation })),
        async ({ operation }) => {
          // Reset before iteration
          cleanup();
          resetBodyPointerEvents();
          mockOnClose.mockClear();
          mockOnFlagAnomalies.mockClear();

          const { unmount } = renderWithQueryClient(
            <ControlledModal
              unresolvedBarcodes={unresolvedBarcodes}
              onCloseCallback={mockOnClose}
              onFlagAnomalies={mockOnFlagAnomalies}
              onItemsRegistered={mockOnItemsRegistered}
            />
          );

          try {
            // Verify modal is open
            await waitFor(() => {
              expect(screen.getByRole("dialog")).toBeInTheDocument();
            });

            // Perform the chosen operation
            if (operation === "closeButton") {
              // Click the close button (X in top-right) — it has sr-only "Close" text
              const closeBtn = screen.getByRole("button", { name: /close/i });
              await act(async () => {
                closeBtn.click();
              });
            } else if (operation === "flagAnomaliesFull") {
              // All barcodes are pre-selected by the modal's useEffect,
              // so just click Flag as Anomalies directly
              const flagBtn = screen.getByRole("button", { name: /flag as anomalies/i });
              await act(async () => {
                flagBtn.click();
              });
            }

            // Wait for modal to close
            await waitFor(
              () => {
                expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
              },
              { timeout: 2000 }
            );

            // Verify document.body pointer-events is 'auto' after close
            const pointerEvents = getBodyPointerEvents();
            expect(pointerEvents).toBe("auto");

            // Verify onClose was called
            expect(mockOnClose).toHaveBeenCalled();
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});

// --- Additional: Direct pointer-events manipulation test -------------------

describe("Property 1 (direct): document.body.pointerEvents", () => {
  it("always returns 'auto' after UnresolvedBarcodesModal unmounts (simulating close)", async () => {
    const unresolvedBarcodes = ["TEST-001"];

    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant("closeButton"),
          fc.constant("unmount")
        ).map((operation) => ({ operation })),
        async ({ operation }) => {
          // Ensure clean state before iteration
          cleanup();
          resetBodyPointerEvents();
          mockOnClose.mockClear();

          const { unmount } = renderWithQueryClient(
            <ControlledModal
              unresolvedBarcodes={unresolvedBarcodes}
              onCloseCallback={mockOnClose}
              onFlagAnomalies={mockOnFlagAnomalies}
              onItemsRegistered={mockOnItemsRegistered}
            />
          );

          try {
            // Verify modal is open
            await waitFor(() => {
              expect(screen.getByRole("dialog")).toBeInTheDocument();
            });

            // Perform close operation
            if (operation === "closeButton") {
              const closeBtn = screen.getByRole("button", { name: /close/i });
              await act(async () => {
                closeBtn.click();
              });

              // Wait for modal to close
              await waitFor(
                () => {
                  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
                },
                { timeout: 2000 }
              );
            } else if (operation === "unmount") {
              // Simulate parent unmounting the modal entirely
              unmount();
            }

            // Direct assertion on document.body.pointerEvents
            const pointerEvents = getBodyPointerEvents();
            expect(pointerEvents).toBe("auto");
          } finally {
            // unmount may have already been called in the "unmount" path
            try {
              unmount();
            } catch {
              // already unmounted
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});
