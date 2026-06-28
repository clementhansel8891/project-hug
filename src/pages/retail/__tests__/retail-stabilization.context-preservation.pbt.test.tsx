/**
 * Preservation Property Tests — Retail Module Stabilization (RetailContext behavior)
 *
 * Property 2: Preservation — Existing Context Behavior
 *   Validates: Requirement 3.5 (RetailContext auto-selection, localStorage persistence,
 *   and absence of re-render loops via the ref-based anti-loop pattern)
 *
 * METHODOLOGY (observation-first): these tests render the UNFIXED `RetailProvider` with the
 * service layer and auth mocked, observe its actual auto-selection / configuration /
 * stability behavior, and assert it. They PASS on unfixed code and fence the ref-based
 * anti-loop logic that the fix MUST NOT touch (preservation 3.5).
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
import fc from "fast-check";
import { Roles } from "@/core/security/roles";

// --- mocks (hoisted) -------------------------------------------------------
const updateLocationMock = vi.fn();
const mockSession = {
  tenant_id: "tenant_1",
  user_id: "user_1",
  location_id: "loc_1",
  department_id: "dept_1",
  role: Roles.OWNER,
  permissions: [],
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, updateLocation: updateLocationMock }),
}));

vi.mock("@/core/services/retail/retailService", () => ({
  retailService: {
    listStores: vi.fn(),
    listChannels: vi.fn(),
    listShifts: vi.fn(),
    getStore: vi.fn(),
  },
}));

import { RetailProvider, useRetail } from "@/pages/retail/context/RetailContext";
import { retailService } from "@/core/services/retail/retailService";

const rs = retailService as unknown as {
  listStores: ReturnType<typeof vi.fn>;
  listChannels: ReturnType<typeof vi.fn>;
  listShifts: ReturnType<typeof vi.fn>;
  getStore: ReturnType<typeof vi.fn>;
};

// Render counter shared with the consumer component.
let renderCount = 0;

const Consumer: React.FC = () => {
  renderCount += 1;
  const { isConfigured, activeStore, activeChannel, stores, isLoading } = useRetail();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="configured">{String(isConfigured)}</span>
      <span data-testid="active-store">{activeStore?.id ?? "none"}</span>
      <span data-testid="active-channel">{activeChannel?.id ?? "none"}</span>
      <span data-testid="count">{stores.length}</span>
    </div>
  );
};

const renderProvider = () =>
  render(
    <RetailProvider>
      <Consumer />
    </RetailProvider>,
  );

beforeEach(() => {
  renderCount = 0;
  localStorage.clear();
  updateLocationMock.mockClear();
  rs.listStores.mockReset();
  rs.listChannels.mockReset();
  rs.listShifts.mockReset();
  rs.getStore.mockReset();
  rs.listShifts.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe("Preservation — RetailContext auto-selection & configuration (3.5)", () => {
  it("3.5 — auto-selects the first store and marks the module configured when stores exist", async () => {
    rs.listStores.mockResolvedValue([{ id: "s1", locationId: "loc_s1" }, { id: "s2", locationId: "loc_s2" }]);
    rs.listChannels.mockResolvedValue([]);

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("configured").textContent).toBe("true");
    expect(screen.getByTestId("active-store").textContent).toBe("s1");
    expect(updateLocationMock).toHaveBeenCalledWith("loc_s1");
  });

  it("3.5 — restores the saved store from localStorage instead of defaulting to the first", async () => {
    localStorage.setItem("retail_active_store_id", "s2");
    rs.listStores.mockResolvedValue([{ id: "s1", locationId: "loc_s1" }, { id: "s2", locationId: "loc_s2" }]);
    rs.listChannels.mockResolvedValue([]);

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("active-store").textContent).toBe("s2");
    expect(updateLocationMock).toHaveBeenCalledWith("loc_s2");
  });

  it("3.5 — no stores or channels: isConfigured is false and nothing is auto-selected", async () => {
    rs.listStores.mockResolvedValue([]);
    rs.listChannels.mockResolvedValue([]);

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("configured").textContent).toBe("false");
    expect(screen.getByTestId("active-store").textContent).toBe("none");
    expect(screen.getByTestId("active-channel").textContent).toBe("none");
    expect(updateLocationMock).not.toHaveBeenCalled();
  });

  it("3.5 — ref-based anti-loop: renders settle and do not grow unbounded", async () => {
    rs.listStores.mockResolvedValue([{ id: "s1", locationId: "loc_s1" }, { id: "s2", locationId: "loc_s2" }]);
    rs.listChannels.mockResolvedValue([{ id: "c1" }]);

    renderProvider();
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    const settled = renderCount;
    // Allow any pending effect-driven re-renders to flush.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    // No infinite loop: render count is stable after settling.
    expect(renderCount).toBe(settled);
    // Sanity bound: a healthy mount settles in a small number of renders.
    expect(settled).toBeLessThanOrEqual(6);
  });
});

describe("Preservation — RetailContext isConfigured & auto-select invariants (3.5, property-based)", () => {
  const storesArb = fc.array(fc.record({ id: fc.uuid(), locationId: fc.uuid() }), { maxLength: 4 });
  const channelsArb = fc.array(fc.record({ id: fc.uuid() }), { maxLength: 4 });

  it("3.5 — for random store/channel populations, isConfigured and first-store auto-select hold", async () => {
    await fc.assert(
      fc.asyncProperty(storesArb, channelsArb, async (stores, channels) => {
        localStorage.clear();
        updateLocationMock.mockClear();
        rs.listStores.mockResolvedValue(stores as any);
        rs.listChannels.mockResolvedValue(channels as any);
        rs.listShifts.mockResolvedValue([]);

        const { unmount } = renderProvider();
        try {
          await waitFor(() =>
            expect(screen.getByTestId("loading").textContent).toBe("false"),
          );

          const expectedConfigured = stores.length > 0 || channels.length > 0;
          expect(screen.getByTestId("configured").textContent).toBe(
            String(expectedConfigured),
          );
          expect(screen.getByTestId("count").textContent).toBe(String(stores.length));

          // With no saved selection, an existing store fleet auto-selects the first store.
          if (stores.length > 0) {
            expect(screen.getByTestId("active-store").textContent).toBe(stores[0].id);
          } else {
            expect(screen.getByTestId("active-store").textContent).toBe("none");
          }
        } finally {
          unmount();
        }
      }),
      { numRuns: 10 },
    );
  });
});
