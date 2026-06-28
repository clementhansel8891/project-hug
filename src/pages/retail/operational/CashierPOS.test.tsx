import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Component tests for the flagship Retail POS terminal — Retail Page_Group (task 10.3).
 *
 * Focus areas:
 * - Real_Data binding: the product catalog is sourced from the live retailService,
 *   scoped to the tenant — the page imports no `@/lib/mock-data` sample arrays
 *   (Requirements 14.3, 14.1).
 * - Currency presentation: catalog prices render via `@/lib/format` formatCurrency as
 *   IDR "Rp …" with id-ID digit grouping (Requirements 14.4).
 * - Loading_Indicator: the terminal shows a syncing indicator while the catalog loads
 *   and then resolves to the populated POS surface (Requirements 14.2, 3.3).
 * - POS action feedback: completing a cash checkout calls the live checkout service and
 *   surfaces a success Feedback_Message (Requirements 14.2, 3.5).
 */

// ─── Mocks ──────────────────────────────────────────────────────────────────
const {
  mockNavigate,
  mockToast,
  mockListInventory,
  mockListCategories,
  mockListPromotions,
  mockCheckout,
  mockPrintReceipt,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockToast: vi.fn(),
  mockListInventory: vi.fn(),
  mockListCategories: vi.fn(),
  mockListPromotions: vi.fn(),
  mockCheckout: vi.fn(),
  mockPrintReceipt: vi.fn().mockResolvedValue(undefined),
}));

const session = {
  user_id: "cashier-01",
  tenant_id: "tenant-demo",
  location_id: "LOC-HQ",
  fullName: "Test Cashier",
};

const activeStore = { id: "store-1", name: "Flagship Store", currency: "IDR" };
const activeShift = { id: "shift-xyz789", status: "open" };

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/core/security/session", () => ({
  useSession: () => session,
}));

vi.mock("../context/RetailContext", () => ({
  useRetail: () => ({ activeStore, activeShift, isLoading: false }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: mockToast,
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/core/services/retail/retailService", () => ({
  retailService: {
    listInventory: mockListInventory,
    listCategories: mockListCategories,
    listPromotions: mockListPromotions,
    checkout: mockCheckout,
  },
}));

vi.mock("@/core/services/hardware/printerService", () => ({
  printerService: { printReceipt: mockPrintReceipt },
}));

vi.mock("@/core/services/payment/paymentService", () => ({
  paymentService: {},
}));

// react-barcode renders an SVG only inside the success modal; stub it for determinism.
vi.mock("react-barcode", () => ({
  default: ({ value }: { value: string }) => <div data-testid="barcode">{value}</div>,
}));

import CashierPOS from "./CashierPOS";

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

const PRODUCTS = [
  { id: "p1", name: "Cola Zero 500ml", sku: "SKU-COLA", price: 15000, stock: 42, categoryName: "Drinks" },
  { id: "p2", name: "Artisan Bread", sku: "SKU-BREAD", price: 28000, stock: 7, categoryName: "Bakery" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockListCategories.mockResolvedValue([{ id: "c1", name: "Drinks" }]);
  mockListInventory.mockResolvedValue(PRODUCTS);
  mockListPromotions.mockResolvedValue([]);
  mockCheckout.mockResolvedValue({ id: "ORDER-1" });
});

describe("CashierPOS — Real_Data binding + currency", () => {
  // Validates: Requirements 14.3, 14.1, 14.4
  it("renders catalog products sourced from retailService scoped to the tenant", async () => {
    renderWithProviders(<CashierPOS />);

    // Populated state: products from the live service appear on the terminal.
    expect(await screen.findByText("Cola Zero 500ml")).toBeInTheDocument();
    expect(screen.getByText("Artisan Bread")).toBeInTheDocument();

    // Real_Data is fetched within the tenant scope (no mock-data arrays).
    expect(mockListInventory).toHaveBeenCalled();
    expect(mockListInventory.mock.calls[0][0]).toBe("tenant-demo");
  });

  // Validates: Requirements 14.4 (IDR currency via @/lib/format)
  it("formats catalog prices as IDR 'Rp' with id-ID digit grouping", async () => {
    renderWithProviders(<CashierPOS />);
    await screen.findByText("Cola Zero 500ml");

    // 15000 → "Rp 15.000" via formatCurrency(value, "IDR", "id-ID").
    const priceNodes = screen.getAllByText(/Rp\s?15\.000/);
    expect(priceNodes.length).toBeGreaterThan(0);
  });
});

describe("CashierPOS — loading indicator", () => {
  // Validates: Requirements 14.2, 3.3 (Loading_Indicator in flight, then populated)
  it("shows the syncing indicator while the catalog loads then resolves to the POS", async () => {
    let resolveCatalog: (v: unknown) => void = () => {};
    mockListInventory.mockReturnValue(
      new Promise((resolve) => {
        resolveCatalog = resolve;
      }),
    );

    renderWithProviders(<CashierPOS />);

    // In flight: the terminal presents a defined loading surface (never blank).
    expect(screen.getByText(/syncing pos environment/i)).toBeInTheDocument();

    resolveCatalog(PRODUCTS);

    expect(await screen.findByText("Cola Zero 500ml")).toBeInTheDocument();
    expect(screen.queryByText(/syncing pos environment/i)).not.toBeInTheDocument();
  });
});

describe("CashierPOS — POS action feedback", () => {
  // Validates: Requirements 14.2, 3.5 (cash checkout calls live service + success feedback)
  it("finalizes a cash sale through retailService and surfaces a success Feedback_Message", async () => {
    renderWithProviders(<CashierPOS />);

    // Add a product to the cart (the whole catalog card is the click target).
    fireEvent.click(await screen.findByText("Cola Zero 500ml"));

    // Open the cash tender modal from the cart panel.
    fireEvent.click(screen.getByRole("button", { name: /^cash$/i }));

    // Tender a sufficient amount via a quick-amount preset (50.000 ≥ 15.000 due).
    fireEvent.click(await screen.findByRole("button", { name: "50K" }));

    // Finalize the transaction.
    fireEvent.click(screen.getByRole("button", { name: /finalize transaction/i }));

    // Real_Data checkout call is made within the tenant scope.
    await waitFor(() => expect(mockCheckout).toHaveBeenCalledTimes(1));
    expect(mockCheckout.mock.calls[0][0]).toBe("tenant-demo");
    expect(mockCheckout.mock.calls[0][2]).toEqual(
      expect.objectContaining({ store_id: "store-1", shift_id: "shift-xyz789" }),
    );

    // Feedback_Message: the success surface confirms completion to the operator.
    expect(await screen.findByText(/payment received/i)).toBeInTheDocument();
  });
});
