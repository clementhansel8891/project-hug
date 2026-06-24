import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import * as storage from "@/lib/local-storage";
import { type SessionContext } from "@/core/security/session";
import { type Role, Roles } from "@/core/security/roles";
import { apiRequest } from "@/core/api/apiClient";
import { orgSettingsService } from "@/core/services";

interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  user_companies?: {
    tenant_id: string;
    role: string;
    is_default: boolean;
    company: {
      id: string;
      name: string;
    };
  }[];
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  session: SessionContext | null;
  login: (credentials: any) => Promise<{ success: boolean; error?: string }>;
  registerUser: (data: any) => Promise<{ success: boolean; error?: string }>;
  provisionCompany: (
    data: any,
  ) => Promise<{ success: boolean; error?: string; session?: SessionContext }>;
  logout: () => void;
  setSession: (session: SessionContext) => void;
  updateLocation: (locationId: string) => void;
  updateBranch: (branchId: string | undefined) => void;
  updateEcommerce: (ecommerceId: string | undefined) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSessionState] = useState<SessionContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Attempt to restore session from storage
    const storedToken = localStorage.getItem("ZENVIX_TOKEN");
    const storedSession = localStorage.getItem("ZENVIX_SESSION");
    console.log("[AuthContext] Init:", {
      hasToken: !!storedToken,
      hasSession: !!storedSession,
    });

    if (storedToken) {
      // Validate token and fetch user
      apiRequest<any>("/v1/auth/me", "GET", { token: storedToken } as any)
        .then((data) => {
          if (data) {
            setUser(data);
            if (storedSession) {
              const parsedSession = JSON.parse(storedSession) as SessionContext;
              setSessionState({
                ...parsedSession,
                permissions: parsedSession.permissions || [],
              });
            } else if (
              data.user_companies &&
              Array.isArray(data.user_companies) &&
              data.user_companies.length > 0
            ) {
              // Auto-select default company
              const defaultCompany =
                data.user_companies.find((c: any) => c.is_default) ||
                data.user_companies[0];
              const newSession = {
                user_id: data.id,
                tenant_id: defaultCompany.tenant_id,
                company_id: defaultCompany.company.id,
                location_id: "", 
                role: defaultCompany.role as Role,
                department_id: "dept-default",
                token: storedToken,
                permissions: [
                  "VIEW_FINANCIALS",
                  "VIEW_INVENTORY",
                  "VIEW_DEVICES",
                  "VIEW_HR",
                  "VIEW_AUDIT",
                  "MANAGE_STORE",
                ],
              };
              setSession(newSession);
            }
          } else {
            logout();
          }
        })
        .catch(() => logout())
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const setSession = useCallback((newSession: SessionContext) => {
    setSessionState(newSession);
    localStorage.setItem("ZENVIX_SESSION", JSON.stringify(newSession));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("ZENVIX_TOKEN");
    localStorage.removeItem("ZENVIX_SESSION");
    storage.clearAllData(); // Clear App/POS specific data
    setUser(null);
    setSessionState(null);
  }, []);

  const login = useCallback(
    async (credentials: any) => {
      try {
        console.log("[AuthContext] Attempting login for:", credentials.email);
        const data = await apiRequest<any>("/v1/auth/login", "POST", null, credentials);

        if (data.token) {
          console.log("[AuthContext] Login successful, token received");
          localStorage.setItem("ZENVIX_TOKEN", data.token);
          setUser(data.user);

          // If they have companies, setup session
          const companies = data.user?.user_companies || [];
          console.log("[AuthContext] User companies:", companies.length);
          
          if (companies.length > 0) {
            const defaultCompany =
              companies.find((c: any) => c.is_default) ||
              companies[0];
            
            console.log("[AuthContext] Setting session for tenant:", defaultCompany.tenant_id);
            const newSession = {
              user_id: data.user.id,
              tenant_id: defaultCompany.tenant_id,
              company_id: defaultCompany.company.id,
              location_id: "",
              role: defaultCompany.role as Role,
              department_id: "dept-ret",
              token: data.token,
              permissions: [
                "VIEW_FINANCIALS",
                "VIEW_INVENTORY",
                "VIEW_DEVICES",
                "VIEW_HR",
                "VIEW_AUDIT",
                "MANAGE_STORE",
              ],
            };
            setSession(newSession);

            // Get routing info based on user role and schedule
            try {
              const routingData = await apiRequest<any>("/v1/auth/routing-info", "GET", { token: data.token } as any);
              console.log("[AuthContext] Routing info received:", routingData);
              
              // Handle both wrapped and unwrapped response formats
              const routingInfo = routingData.data || routingData;
              
              if (routingInfo.context) {
                // Update session with store/location context from shift
                const updatedSession = {
                  ...newSession,
                  location_id: routingInfo.context.location_id || "",
                  store_id: routingInfo.context.store_id,
                  store_name: routingInfo.context.store_name,
                  shift_id: routingInfo.context.shift_id,
                };
                setSession(updatedSession);
                console.log("[AuthContext] Session updated with shift context:", updatedSession);
              }
              
              return { 
                success: true, 
                redirect_to: routingInfo.redirect_to || "/core/dashboard",
                message: routingInfo.message,
                shift_status: routingInfo.shift_status,
                context: routingInfo.context
              };
            } catch (routingError) {
              console.warn("[AuthContext] Routing info failed, using default:", routingError);
              return { success: true, redirect_to: "/core/dashboard" };
            }
          } else {
            console.warn("[AuthContext] User has no companies associated.");
            return { success: true, redirect_to: "/core/dashboard" };
          }
        }
        console.error("[AuthContext] Login failed: No token in response");
        return { success: false, error: "Login failed" };
      } catch (e: any) {
        console.error("[AuthContext] Login error:", e.message);
        return { success: false, error: e.message };
      }
    },
    [setSession],
  );

  const registerUser = useCallback(async (formData: any) => {
    try {
      await apiRequest("/v1/auth/register", "POST", null, formData);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }, []);

  const provisionCompany = useCallback(
    async (formData: any) => {
      try {
        const token = localStorage.getItem("ZENVIX_TOKEN");
        const json = await apiRequest<any>("/v1/auth/company/provision", "POST", { token } as any, formData);

        if (json) {
          // Create active session based on provisioned data
          const newSession = {
            user_id: user?.id || "unknown",
            tenant_id: json.tenant_id || json.data?.tenant_id,
            company_id: json.company_id || json.data?.company_id,
            location_id: json.location_id || json.data?.location_id,
            role: Roles.SUPERADMIN, 
            department_id: json.department_id || json.data?.department_id,
            token: token as string,
            permissions: [
              "VIEW_FINANCIALS",
              "VIEW_INVENTORY",
              "VIEW_DEVICES",
              "VIEW_HR",
              "VIEW_AUDIT",
              "MANAGE_STORE",
            ],
          };
          setSession(newSession);

          // Reload user to get updated userCompanies
          const meData = await apiRequest<any>("/v1/auth/me", "GET", { token } as any);
          if (meData) setUser(meData);

          return { success: true, session: newSession };
        }
        return { success: false, error: "Provisioning failed" };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
    [user, setSession],
  );

  const updateLocation = useCallback(
    (location_id: string) => {
      setSessionState((prev) => {
        if (!prev || prev.location_id === location_id) return prev;
        const next = { ...prev, location_id };
        localStorage.setItem("ZENVIX_SESSION", JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const updateBranch = useCallback(
    (branch_id: string | undefined) => {
      setSessionState((prev) => {
        if (!prev || prev.branch_id === branch_id) return prev;
        const next = { ...prev, branch_id };
        localStorage.setItem("ZENVIX_SESSION", JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const updateEcommerce = useCallback(
    (ecommerce_id: string | undefined) => {
      setSessionState((prev) => {
        if (!prev || prev.ecommerce_id === ecommerce_id) return prev;
        const next = { ...prev, ecommerce_id };
        localStorage.setItem("ZENVIX_SESSION", JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  // Auto-resolve locationId if missing but tenantId is present
  useEffect(() => {
    if (session && session.tenant_id && !session.location_id) {
      console.log("[AuthContext] Missing location_id, attempting auto-resolution via Core...");
      orgSettingsService.getLocations(session)
        .then(locations => {
          // Guard against non-array responses (e.g. HTML from a 404/500)
          if (locations && Array.isArray(locations) && locations.length > 0) {
            console.log("[AuthContext] Auto-resolved location_id:", locations[0].id);
            updateLocation(locations[0].id);
          } else {
            console.warn("[AuthContext] No valid locations found or invalid response format during auto-resolution.");
          }
        })
        .catch(err => {
          // Defensively catch parsing errors and log them without crashing
          if (err instanceof SyntaxError || err.message?.includes("Unexpected token")) {
            console.warn("[AuthContext] Backend returned invalid JSON during location resolution. Likely a 404/500 HTML page.");
          } else {
            console.error("[AuthContext] Location resolution failed:", err);
          }
        });
    }
  }, [session, updateLocation]);

  const value = useMemo(
    () => ({
      isAuthenticated: !!user,
      isLoading,
      user,
      session,
      login,
      registerUser,
      provisionCompany,
      logout,
      setSession,
      updateLocation,
      updateBranch,
      updateEcommerce,
    }),
    [
      user,
      isLoading,
      session,
      login,
      registerUser,
      provisionCompany,
      logout,
      setSession,
      updateLocation,
      updateBranch,
      updateEcommerce,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
