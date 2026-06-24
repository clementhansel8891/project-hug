import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import {
  RetailStore,
  RetailShift,
  RetailChannel,
} from "@/core/types/retail/retail";
import { retailService } from "@/core/services/retail/retailService";
import { useSession } from "@/core/security/session";
import { useAuth } from "@/contexts/AuthContext";

export type RetailMode = "management" | "operational";

interface RetailContextType {
  activeStore: RetailStore | null;
  activeChannel: RetailChannel | null;
  stores: RetailStore[];
  channels: RetailChannel[];
  activeShift: RetailShift | null;
  mode: RetailMode;
  isLoading: boolean;
  isConfigured: boolean;
  setMode: (mode: RetailMode) => void;
  setStore: (storeId: string | null) => void;
  setChannel: (channelId: string | null) => void;
  refreshState: () => Promise<void>;
}

const RetailContext = createContext<RetailContextType | undefined>(undefined);

/**
 * Shape consumed by {@link shouldShowOnboarding}. Intentionally a loose, read-only view of
 * the retail configuration state so the helper stays a pure function decoupled from the
 * provider internals (and, critically, from the ref-based anti-loop logic).
 */
export interface RetailOnboardingState {
  stores?: ReadonlyArray<unknown> | null;
  channels?: ReadonlyArray<unknown> | null;
  isConfigured?: boolean;
}

/**
 * Pure decision helper for guided onboarding of the empty retail state.
 *
 * Returns `true` when no retail locations are configured yet (no physical/virtual stores and
 * no channels), signalling consumers to route the user into a guided wizard / call-to-action
 * to create their first physical or e-commerce location.
 *
 * This is a standalone pure function: it does NOT read context, refs, or component state and
 * MUST NOT be coupled to the provider's ref-based anti-loop logic (preservation 3.5).
 */
export function shouldShowOnboarding(state: RetailOnboardingState | null | undefined): boolean {
  if (!state) return true;
  const hasStores = Array.isArray(state.stores) && state.stores.length > 0;
  const hasChannels = Array.isArray(state.channels) && state.channels.length > 0;
  const configured =
    typeof state.isConfigured === "boolean"
      ? state.isConfigured
      : hasStores || hasChannels;
  return !configured && !hasStores && !hasChannels;
}

export const RetailProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const session = useSession();
  const { updateLocation } = useAuth();
  const [activeStore, setActiveStore] = useState<RetailStore | null>(null);
  const [activeChannel, setActiveChannel] = useState<RetailChannel | null>(
    null,
  );
  const [stores, setStores] = useState<RetailStore[]>([]);
  const [channels, setChannels] = useState<RetailChannel[]>([]);
  const [activeShift, setActiveShift] = useState<RetailShift | null>(null);
  const [mode, setMode] = useState<RetailMode>("management");
  const [isLoading, setIsLoading] = useState(true);

  // Use refs to read current values inside callbacks WITHOUT adding them as deps.
  // This is the key fix for the infinite re-render loop: previously activeStore
  // was a dep of refreshState, and refreshState called setActiveStore, which
  // recreated the callback, triggering context to re-render all consumers endlessly.
  const activeStoreRef = useRef(activeStore);
  const activeChannelRef = useRef(activeChannel);
  const updateLocationRef = useRef(updateLocation);

  useEffect(() => {
    activeStoreRef.current = activeStore;
  }, [activeStore]);
  useEffect(() => {
    activeChannelRef.current = activeChannel;
  }, [activeChannel]);
  useEffect(() => {
    updateLocationRef.current = updateLocation;
  }, [updateLocation]);

  // Track if we've done the initial auto-selection to avoid repeated updateLocation calls
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!session.tenant_id) {
      localStorage.removeItem("retail_active_store_id");
      localStorage.removeItem("retail_active_channel_id");
    }
  }, [session.tenant_id]);

  const refreshState = useCallback(async () => {
    if (!session.tenant_id) return;

    try {
      const [fetchedStores, fetchedChannels] = await Promise.all([
        retailService.listStores(session.tenant_id, session),
        retailService.listChannels(session.tenant_id, session),
      ]);

      setStores(fetchedStores);
      setChannels(fetchedChannels);

      // Read current values from refs to avoid dep array issues
      const currentActiveStore = activeStoreRef.current;
      const currentActiveChannel = activeChannelRef.current;

      // Try to restore from local storage first
      const savedStoreId = localStorage.getItem("retail_active_store_id");
      const savedChannelId = localStorage.getItem("retail_active_channel_id");

      // Auto-select logic
      if (!initializedRef.current) {
        initializedRef.current = true;
        
        // PRIORITY 1: Check if session has store_id from routing (shift context)
        let targetStore = (session as any).store_id 
          ? fetchedStores.find(s => s.id === (session as any).store_id)
          : null;
        
        // PRIORITY 2: Use saved store from localStorage
        if (!targetStore && savedStoreId) {
          targetStore = fetchedStores.find(s => s.id === savedStoreId);
        }
        
        let targetChannel = fetchedChannels.find(c => c.id === savedChannelId);

        if (targetStore) {
          setActiveStore(targetStore);
          if (session.location_id !== targetStore.locationId) {
            updateLocationRef.current(targetStore.locationId);
          }
        } else if (targetChannel) {
          setActiveChannel(targetChannel);
          if (session.location_id !== targetChannel.id) {
            updateLocationRef.current(targetChannel.id);
          }
        } else if (fetchedStores.length > 0) {
          // Default to first store if nothing saved
          const defaultStore = fetchedStores[0];
          setActiveStore(defaultStore);
          if (session.location_id !== defaultStore.locationId) {
            updateLocationRef.current(defaultStore.locationId);
          }
        }
      } else if (currentActiveStore) {
        // Refresh active store data only if something actually changed (compare IDs)
        const refreshed = fetchedStores.find(
          (s) => s.id === currentActiveStore.id,
        );
        if (
          refreshed &&
          JSON.stringify(refreshed) !== JSON.stringify(currentActiveStore)
        ) {
          setActiveStore(refreshed);
        }
      }

      if (currentActiveChannel) {
        const refreshed = fetchedChannels.find(
          (c) => c.id === currentActiveChannel.id,
        );
        if (
          refreshed &&
          JSON.stringify(refreshed) !== JSON.stringify(currentActiveChannel)
        ) {
          setActiveChannel(refreshed);
        }
      }

      const shifts = await retailService.listShifts(session.tenant_id, session, { 
        store_id: activeStoreRef.current?.id,
        employee_id: session.user_id 
      });
      // Isolate to the current user's open shift
      const openShift = Array.isArray(shifts) ? shifts.find(
        (s: any) => s.status === "open"
      ) : null;
      setActiveShift(openShift || null);
    } catch (e) {
      console.error("[RetailContext] Refresh failed", e);
    } finally {
      setIsLoading(false);
    }
    // CRITICAL: Only depend on stable primitive session values.
    // DO NOT add activeStore/activeChannel here - that causes an infinite loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.tenant_id, session.user_id]);

  useEffect(() => {
    refreshState();
    // Only re-run when the authenticated user/tenant changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.tenant_id, session.user_id]);

  const setStore = useCallback(
    async (storeId: string | null) => {
      if (!storeId) {
        setActiveStore(null);
        return;
      }
      if (!session.tenant_id) return;
      const store = await retailService.getStore(
        session.tenant_id,
        storeId,
        session,
      );
      if (store) {
        setActiveStore(store);
        setActiveChannel(null);
        localStorage.setItem("retail_active_store_id", store.id);
        localStorage.removeItem("retail_active_channel_id");
        if (session.location_id !== store.locationId) {
          updateLocation(store.locationId);
        }
      }
    },
    [session, updateLocation],
  );

  const setChannel = useCallback(
    async (channelId: string | null) => {
      if (!channelId) {
        setActiveChannel(null);
        return;
      }
      const channel = channels.find((c) => c.id === channelId);
      if (channel) {
        setActiveChannel(channel);
        setActiveStore(null);
        localStorage.setItem("retail_active_channel_id", channel.id);
        localStorage.removeItem("retail_active_store_id");
        if (session.location_id !== channel.id) {
          updateLocation(channel.id);
        }
      }
    },
    [channels, session.location_id, updateLocation],
  );

  const value = useMemo(
    () => ({
      activeStore,
      activeChannel,
      stores,
      channels,
      activeShift,
      mode,
      isLoading,
      isConfigured: stores.length > 0 || channels.length > 0,
      setMode,
      setStore,
      setChannel,
      refreshState,
    }),
    [
      activeStore,
      activeChannel,
      stores,
      channels,
      activeShift,
      mode,
      isLoading,
      setMode,
      setStore,
      setChannel,
      refreshState,
    ],
  );

  return (
    <RetailContext.Provider value={value}>{children}</RetailContext.Provider>
  );
};

export const useRetail = () => {
  const context = useContext(RetailContext);
  if (!context)
    throw new Error("useRetail must be used within a RetailProvider");
  return context;
};
