import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";

import { CartItem } from "@/lib/mock-data";
import * as storage from "@/lib/local-storage";
import type { ModuleId } from "@/modules/shared/contract";

/* ============================================================================ */
/* DOMAIN TYPES (LOCAL, EXPLICIT)                                                */
/* ============================================================================ */

/**
 * Minimal authenticated user snapshot.
 * NOT a full User domain model.
 */
export interface AuthUser {
  id: string;
  name: string;
  role: string;
}

/**
 * Platform-recognized application identifiers.
 * Must align with module contracts.
 */
export type ActiveAppId = ModuleId;

/* ============================================================================ */
/* STATE                                                                        */
/* ============================================================================ */

interface AppState {
  // Auth
  currentUser: AuthUser | null;
  currentShift: storage.ShiftData | null;
  isAuthenticated: boolean;

  // POS
  cart: CartItem[];
  activeTableId: string | null;

  // System
  isOnline: boolean;
  pendingSyncCount: number;
  theme: "light" | "dark";

  // Settings
  settings: storage.AppSettings;

  // Active module
  activeApp: ActiveAppId;
}

/* ============================================================================ */
/* ACTIONS                                                                      */
/* ============================================================================ */

type AppAction =
  | { type: "SET_USER"; payload: AuthUser | null }
  | { type: "SET_SHIFT"; payload: storage.ShiftData | null }
  | { type: "SET_CART"; payload: CartItem[] }
  | { type: "ADD_TO_CART"; payload: CartItem }
  | { type: "UPDATE_CART_ITEM"; payload: { index: number; item: CartItem } }
  | { type: "REMOVE_FROM_CART"; payload: number }
  | { type: "CLEAR_CART" }
  | { type: "SET_ACTIVE_TABLE"; payload: string | null }
  | { type: "SET_ONLINE_STATUS"; payload: boolean }
  | { type: "SET_PENDING_SYNC"; payload: number }
  | { type: "SET_THEME"; payload: "light" | "dark" }
  | { type: "SET_SETTINGS"; payload: storage.AppSettings }
  | { type: "SET_ACTIVE_APP"; payload: ActiveAppId }
  | { type: "LOGOUT" };

/* ============================================================================ */
/* INITIAL STATE                                                                */
/* ============================================================================ */

const initialState: AppState = {
  currentUser: null,
  currentShift: null,
  isAuthenticated: false,

  cart: [],
  activeTableId: null,

  isOnline: true,
  pendingSyncCount: 0,
  theme: "dark",

  settings: storage.getSettings(),
  activeApp: "core",
};

/* ============================================================================ */
/* REDUCER                                                                      */
/* ============================================================================ */

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_USER":
      return {
        ...state,
        currentUser: action.payload,
        isAuthenticated: action.payload !== null,
      };

    case "SET_SHIFT":
      return { ...state, currentShift: action.payload };

    case "SET_CART":
      return { ...state, cart: action.payload };

    case "ADD_TO_CART": {
      const index = state.cart.findIndex(
        (i) => i.product.id === action.payload.product.id,
      );

      if (index >= 0) {
        const cart = [...state.cart];
        cart[index] = {
          ...cart[index],
          quantity: cart[index].quantity + action.payload.quantity,
        };
        return { ...state, cart };
      }

      return { ...state, cart: [...state.cart, action.payload] };
    }

    case "UPDATE_CART_ITEM": {
      const cart = [...state.cart];
      cart[action.payload.index] = action.payload.item;
      return { ...state, cart };
    }

    case "REMOVE_FROM_CART":
      return {
        ...state,
        cart: (Array.isArray(state.cart) ? state.cart : []).filter((_, i) => i !== action.payload),
      };

    case "CLEAR_CART":
      return { ...state, cart: [] };

    case "SET_ACTIVE_TABLE":
      return { ...state, activeTableId: action.payload };

    case "SET_ONLINE_STATUS":
      return { ...state, isOnline: action.payload };

    case "SET_PENDING_SYNC":
      return { ...state, pendingSyncCount: action.payload };

    case "SET_THEME":
      return { ...state, theme: action.payload };

    case "SET_SETTINGS":
      return { ...state, settings: action.payload };

    case "SET_ACTIVE_APP":
      return { ...state, activeApp: action.payload };

    case "LOGOUT":
      return {
        ...initialState,
        settings: state.settings,
        theme: state.theme,
      };

    default:
      return state;
  }
}

/* ============================================================================ */
/* CONTEXT                                                                      */
/* ============================================================================ */

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;

  login(user: AuthUser): void;
  logout(): void;

  startShift(openingCash: number): void;
  endShift(closingCash: number): void;

  addToCart(item: CartItem): void;
  updateCartItem(index: number, item: CartItem): void;
  removeFromCart(index: number): void;
  clearCart(): void;

  setActiveTable(tableId: string | null): void;
  toggleTheme(): void;
  updateSettings(settings: storage.AppSettings): void;
  switchApp(app: ActiveAppId): void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

/* ============================================================================ */
/* PROVIDER                                                                     */
/* ============================================================================ */

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  /* -------------------------------------------------------------------------- */
  /* INITIAL LOAD                                                               */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    const user = storage.getCurrentUser();
    const shift = storage.getCurrentShift();
    const cart = storage.getCart();
    const theme = storage.getTheme();
    const settings = storage.getSettings();
    const pendingSync = storage.getPendingSyncCount();

    if (user) dispatch({ type: "SET_USER", payload: user });
    if (shift) dispatch({ type: "SET_SHIFT", payload: shift });
    if (cart.length) dispatch({ type: "SET_CART", payload: cart });

    dispatch({ type: "SET_THEME", payload: theme });
    dispatch({ type: "SET_SETTINGS", payload: settings });
    dispatch({ type: "SET_PENDING_SYNC", payload: pendingSync });

    document.documentElement.classList.toggle("dark", theme === "dark");
  }, []);

  /* -------------------------------------------------------------------------- */
  /* ONLINE STATUS                                                              */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    const online = () => dispatch({ type: "SET_ONLINE_STATUS", payload: true });
    const offline = () =>
      dispatch({ type: "SET_ONLINE_STATUS", payload: false });

    window.addEventListener("online", online);
    window.addEventListener("offline", offline);

    dispatch({ type: "SET_ONLINE_STATUS", payload: navigator.onLine });

    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  /* -------------------------------------------------------------------------- */
  /* PERSIST CART                                                               */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    storage.setCart(state.cart);
  }, [state.cart]);

  /* -------------------------------------------------------------------------- */
  /* ACTION HELPERS                                                             */
  /* -------------------------------------------------------------------------- */

  const login = useCallback((user: AuthUser) => {
    storage.setCurrentUser(user);
    dispatch({ type: "SET_USER", payload: user });
  }, []);

  const logout = useCallback(() => {
    storage.setCurrentUser(null);
    storage.clearCart();
    dispatch({ type: "LOGOUT" });
  }, []);

  const startShift = useCallback(
    (openingCash: number) => {
      if (!state.currentUser) return;

      const shift: storage.ShiftData = {
        id: Date.now().toString(),
        staffId: state.currentUser.id,
        staffName: state.currentUser.name,
        startTime: new Date().toISOString(),
        openingCash,
        totalSales: 0,
        transactions: 0,
        status: "open",
      };

      storage.setCurrentShift(shift);
      dispatch({ type: "SET_SHIFT", payload: shift });
    },
    [state.currentUser, dispatch],
  );

  const endShift = useCallback(
    (closingCash: number) => {
      if (!state.currentShift) return;

      storage.setCurrentShift(null);
      dispatch({ type: "SET_SHIFT", payload: null });
    },
    [state.currentShift, dispatch],
  );

  const addToCart = useCallback(
    (item: CartItem) => dispatch({ type: "ADD_TO_CART", payload: item }),
    [dispatch],
  );

  const updateCartItem = useCallback(
    (index: number, item: CartItem) =>
      dispatch({ type: "UPDATE_CART_ITEM", payload: { index, item } }),
    [dispatch],
  );

  const removeFromCart = useCallback(
    (index: number) => dispatch({ type: "REMOVE_FROM_CART", payload: index }),
    [dispatch],
  );

  const clearCart = useCallback(() => {
    storage.clearCart();
    dispatch({ type: "CLEAR_CART" });
  }, [dispatch]);

  const setActiveTable = useCallback(
    (tableId: string | null) =>
      dispatch({ type: "SET_ACTIVE_TABLE", payload: tableId }),
    [dispatch],
  );

  const toggleTheme = useCallback(() => {
    const currentTheme = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    const newTheme = currentTheme === "light" ? "dark" : "light";
    storage.setTheme(newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    dispatch({ type: "SET_THEME", payload: newTheme });
  }, [dispatch]);

  const updateSettings = useCallback(
    (settings: storage.AppSettings) => {
      storage.setSettings(settings);
      dispatch({ type: "SET_SETTINGS", payload: settings });
    },
    [dispatch],
  );

  const switchApp = useCallback(
    (app: ActiveAppId) => dispatch({ type: "SET_ACTIVE_APP", payload: app }),
    [dispatch],
  );

  const contextValue = useMemo(
    () => ({
      state,
      dispatch,
      login,
      logout,
      startShift,
      endShift,
      addToCart,
      updateCartItem,
      removeFromCart,
      clearCart,
      setActiveTable,
      toggleTheme,
      updateSettings,
      switchApp,
    }),
    [
      state,
      dispatch,
      login,
      logout,
      startShift,
      endShift,
      addToCart,
      updateCartItem,
      removeFromCart,
      clearCart,
      setActiveTable,
      toggleTheme,
      updateSettings,
      switchApp,
    ],
  );

  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
}

/* ============================================================================ */
/* HOOK                                                                         */
/* ============================================================================ */

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used within AppProvider");
  }
  return ctx;
}
