// ============================================================
// IDENTITY CONTEXT - User, Organization, and Session Management
// ============================================================

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import type {
  Organization,
  User,
  Role,
  Site,
  Device,
  DeviceType,
  Permission,
} from "../types";
import * as storage from "./storage";
import * as mockData from "../../lib/mock-data"; // Your mock data
import { PermissionAction } from "@/modules/shared/contract";

// ============================================================
// CONFIGURATION
// ============================================================

// Toggle to use demo mocks or real backend
// PRODUCTION: Always disabled. Only enabled when explicitly opted in via localStorage.
const USE_DEMO_MOCKS = localStorage.getItem("zenvix_demo_mode") === "true";

// ============================================================
// STATE TYPES
// ============================================================

interface IdentityState {
  isAuthenticated: boolean;
  isLoading: boolean;
  organization: Organization | null;
  user: User | null;
  roles: Role[];
  currentSite: Site | null;
  device: Device | null;
  deviceType: DeviceType;
  theme: "light" | "dark";
}

type IdentityAction =
  | { type: "SET_LOADING"; payload: boolean }
  | {
      type: "LOGIN_SUCCESS";
      payload: {
        organization: Organization;
        user: User;
        roles: Role[];
        site: Site;
      };
    }
  | { type: "LOGOUT" }
  | { type: "SET_SITE"; payload: Site }
  | { type: "SET_DEVICE"; payload: Device }
  | { type: "SET_DEVICE_TYPE"; payload: DeviceType }
  | { type: "SET_THEME"; payload: "light" | "dark" }
  | { type: "RESTORE_SESSION"; payload: Partial<IdentityState> };

// ============================================================
// INITIAL STATE
// ============================================================

const detectDeviceType = (): DeviceType => {
  if (typeof window === "undefined") return "desktop";
  const width = window.innerWidth;
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (width <= 768 && isTouch) return "mobile";
  if (width <= 1024 && isTouch) return "tablet";
  return "desktop";
};

const initialState: IdentityState = {
  isAuthenticated: false,
  isLoading: true,
  organization: null,
  user: null,
  roles: [],
  currentSite: null,
  device: null,
  deviceType: detectDeviceType(),
  theme: "light",
};

// ============================================================
// REDUCER
// ============================================================

function identityReducer(
  state: IdentityState,
  action: IdentityAction,
): IdentityState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "LOGIN_SUCCESS":
      return {
        ...state,
        isAuthenticated: true,
        isLoading: false,
        organization: action.payload.organization,
        user: action.payload.user,
        roles: action.payload.roles,
        currentSite: action.payload.site,
      };

    case "LOGOUT":
      return {
        ...initialState,
        isLoading: false,
        deviceType: state.deviceType,
        theme: state.theme,
      };

    case "SET_SITE":
      return { ...state, currentSite: action.payload };

    case "SET_DEVICE":
      return { ...state, device: action.payload };

    case "SET_DEVICE_TYPE":
      return { ...state, deviceType: action.payload };

    case "SET_THEME":
      return { ...state, theme: action.payload };

    case "RESTORE_SESSION":
      return { ...state, ...action.payload, isLoading: false };

    default:
      return state;
  }
}

// ============================================================
// CONTEXT TYPE
// ============================================================

interface IdentityContextType {
  state: IdentityState;

  // Auth methods
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string; targetPath?: string }>;
  logout: () => void;

  // Site management
  switchSite: (site: Site) => void;

  // Theme
  toggleTheme: () => void;

  // Permissions
  hasPermission: (resource: string, action: string) => boolean;
  hasModuleAccess: (moduleId: string) => boolean;
  getAccessiblePages: (moduleId: string) => string[];
}

const IdentityContext = createContext<IdentityContextType | undefined>(
  undefined,
);

// ============================================================
// PROVIDER
// ============================================================

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(identityReducer, initialState);

  // Restore session on mount
  useEffect(() => {
    const session = storage.getSession() as Partial<IdentityState> | null;
    const theme = storage.getTheme() ?? "light";

    if (session) {
      dispatch({
        type: "RESTORE_SESSION",
        payload: {
          isAuthenticated: true,
          organization: session.organization ?? null,
          user: session.user ?? null,
          roles: session.roles ?? [],
          currentSite: session.currentSite ?? null,
          theme,
        },
      });
    } else {
      dispatch({ type: "SET_LOADING", payload: false });
    }

    document.documentElement.classList.toggle("dark", theme === "dark");

    const handleResize = () =>
      dispatch({ type: "SET_DEVICE_TYPE", payload: detectDeviceType() });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ==========================================================
  // ACTIONS
  // ==========================================================

  const login = useCallback(async (email: string, password: string) => {
    // Use mocks only in demo mode
    if (USE_DEMO_MOCKS) {
      const normalizedEmail = email.toLowerCase();
      const mockUser = mockData.mockUsers[normalizedEmail];

      await new Promise((resolve) => setTimeout(resolve, 500));

      if (!mockUser || mockUser.password !== password) {
        return { success: false, error: "Invalid email or password" };
      }

      const roles: Role[] = (Array.isArray(mockUser.user.roles) ? mockUser.user.roles : []).map(
        (r) => mockData.mockRoles[r],
      );

      const session = {
        organization: mockData.mockOrganizations[0], // pick first or map based on user
        user: mockUser.user,
        roles,
        site: mockData.mockSites[0],
        activeModules: [], // optional for demo
        licenses: [], // optional for demo
        device: null,
      };

      storage.saveSession(session);
      dispatch({ type: "LOGIN_SUCCESS", payload: session });

      let targetPath = "/core";
      if (mockUser.targetModule === "retail") targetPath = "/retail";
      else if (mockUser.targetModule === "cafe") targetPath = "/cafe";

      return { success: true, targetPath };
    }

    // In production, call your real API
    return { success: false, error: "Production login not implemented" };
  }, []);

  const logout = useCallback(() => {
    storage.clearSession();
    dispatch({ type: "LOGOUT" });
  }, []);

  const switchSite = useCallback((site: Site) => {
    dispatch({ type: "SET_SITE", payload: site });
    storage.updateSite(site);
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = state.theme === "light" ? "dark" : "light";
    storage.setTheme(newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    dispatch({ type: "SET_THEME", payload: newTheme });
  }, [state.theme]);

  const hasPermission = useCallback(
    (resource: string, action: PermissionAction) => {
      return state.roles.some((role) =>
        role.permissions.some(
          (perm) =>
            (perm.resource === "*" || perm.resource === resource) &&
            (perm.actions.includes("manage") || perm.actions.includes(action)),
        ),
      );
    },
    [state.roles],
  );

  const hasModuleAccess = useCallback(
    (moduleId: string) => {
      return state.roles.some((role) =>
        role.moduleAccess.some((access) => access.moduleId === moduleId),
      );
    },
    [state.roles],
  );

  const getAccessiblePages = useCallback(
    (moduleId: string) => {
      const pages = new Set<string>();
      state.roles.forEach((role) => {
        (Array.isArray(role.moduleAccess) ? role.moduleAccess : []).filter((access) => access.moduleId === moduleId)
          .forEach((access) => access.pages.forEach((p) => pages.add(p)));
      });
      return Array.from(pages);
    },
    [state.roles],
  );

  return (
    <IdentityContext.Provider
      value={{
        state,
        login,
        logout,
        switchSite,
        toggleTheme,
        hasPermission,
        hasModuleAccess,
        getAccessiblePages,
      }}
    >
      {children}
    </IdentityContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function useIdentity(): IdentityContextType {
  const context = useContext(IdentityContext);
  if (!context)
    throw new Error("useIdentity must be used within an IdentityProvider");
  return context;
}
