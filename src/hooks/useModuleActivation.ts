import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/core/api/apiClient";

export type ModuleStatus = {
  moduleCode: string;
  isEnabled: boolean;
  status: string;
};

export function useModuleActivation() {
  const { session } = useAuth();
  const [activeModules, setActiveModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchActivationStatus = useCallback(async () => {
    if (!session?.tenantId || !session?.token) {
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<any[]>("/license/my-modules", "GET", session);
      
      if (data) {
        const enabledCodes = (Array.isArray(data) ? data : []).filter((m) => m.isEnabled && m.status === "active")
          .map((m) => m.moduleCode.toLowerCase());
        
        setActiveModules(new Set(enabledCodes));
      }
    } catch (error) {
      console.error("Failed to fetch module activation status:", error);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchActivationStatus();
  }, [fetchActivationStatus]);

  const isModuleActive = (moduleCode: string) => {
    // Core modules are always active
    const coreModules = ["finance", "hr", "it", "procurement", "inventory", "sales", "marketing", "audit", "staff", "settings", "security"];
    if (coreModules.includes(moduleCode.toLowerCase())) return true;
    
    // Retail is always active for this deployment (no activation toggle required)
    if (moduleCode.toLowerCase() === "retail") return true;
    
    return activeModules.has(moduleCode.toLowerCase());
  };

  return { isModuleActive, loading, refresh: fetchActivationStatus };
}
