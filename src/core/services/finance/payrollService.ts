import { apiRequest } from "@/core/api/apiClient";
import type { SessionContext } from "@/core/security/session";
import type { PayrollEntry } from "@/core/types/finance/payrollTypes";

/**
 * Finance-side payroll service.
 * Wired to the actual backend HR payroll endpoints.
 * Falls back to empty arrays on error for graceful degradation.
 */
export const payrollService = {
  async getPayrollEntries(tenantId: string, session: SessionContext, period?: string): Promise<PayrollEntry[]> {
    try {
      const query = period ? `?period=${period}` : "";
      return await apiRequest<PayrollEntry[]>(`/v1/finance/payroll/entries${query}`, "GET", session);
    } catch {
      return [];
    }
  },

  async createPayrollEntry(session: SessionContext, entry: Partial<PayrollEntry>): Promise<PayrollEntry> {
    return apiRequest<PayrollEntry>("/v1/finance/payroll/entries", "POST", session, entry);
  },

  async updatePayrollEntry(session: SessionContext, entryId: string, updates: Partial<PayrollEntry>): Promise<PayrollEntry> {
    return apiRequest<PayrollEntry>(`/v1/finance/payroll/entries/${entryId}`, "PATCH", session, updates);
  },

  async runPayroll(tenantId: string, session: SessionContext, period: string): Promise<boolean> {
    try {
      await apiRequest<any>("/v1/finance/payroll/execute", "POST", session, { period });
      return true;
    } catch {
      return false;
    }
  },
};
