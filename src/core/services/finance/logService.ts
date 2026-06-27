import { apiRequest } from "@/core/api/apiClient";
import type { SessionContext } from "@/core/security/session";
import { v4 as uuidv4 } from "uuid";

export type AuditLog = {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  details: string;
  timestamp: string;
};

/**
 * LogService provides audit logging functionality for the finance module.
 * Writes to the backend audit system AND maintains a client-side buffer
 * for immediate UI display without waiting for round-trip.
 */
const clientBuffer: AuditLog[] = [];

export const logService = {
  /**
   * Create a new log entry — writes to backend audit system
   */
  log: (
    tenantId: string,
    userId: string,
    action: string,
    details: string = "",
    session?: SessionContext,
  ) => {
    const logEntry: AuditLog = {
      id: uuidv4(),
      tenantId,
      userId,
      action,
      details,
      timestamp: new Date().toISOString(),
    };

    // Buffer locally for immediate display
    clientBuffer.unshift(logEntry);
    if (clientBuffer.length > 200) clientBuffer.pop();

    // Fire-and-forget write to backend
    if (session) {
      apiRequest("/v1/finance/audit-log", "POST", session, {
        module: "FINANCE",
        action,
        entity_type: "FINANCE_OP",
        metadata: { details },
      }).catch(() => { /* non-critical */ });
    }

    return logEntry;
  },

  /**
   * List all logs for a tenant — fetches from backend, merges with buffer
   */
  listLogs: async (tenantId: string, session?: SessionContext): Promise<AuditLog[]> => {
    if (session) {
      try {
        const serverLogs = await apiRequest<any[]>("/v1/finance/audit-log?module=FINANCE&limit=100", "GET", session);
        if (Array.isArray(serverLogs)) {
          return serverLogs.map(l => ({
            id: l.id,
            tenantId: l.tenant_id || tenantId,
            userId: l.user_id || "system",
            action: l.action || "",
            details: l.metadata?.details || l.description || "",
            timestamp: l.created_at || l.timestamp || "",
          }));
        }
      } catch {
        // Fall back to client buffer
      }
    }
    return clientBuffer.filter(log => log.tenantId === tenantId);
  },

  /**
   * List logs by userId
   */
  listLogsByUser: (tenantId: string, userId: string): AuditLog[] => {
    return clientBuffer.filter(
      (log) => log.tenantId === tenantId && log.userId === userId,
    );
  },

  /**
   * Clear client buffer
   */
  clearLogs: (tenantId?: string) => {
    if (tenantId) {
      for (let i = clientBuffer.length - 1; i >= 0; i--) {
        if (clientBuffer[i].tenantId === tenantId) clientBuffer.splice(i, 1);
      }
    } else {
      clientBuffer.length = 0;
    }
  },
};
