import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import { PageHeader } from "@/core/ui/PageHeader";
import {
  Globe,
  Save,
  RefreshCw,
  Layout,
  Zap,
  PackageCheck,
  Monitor,
  ShieldCheck,
  Link,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/core/security/session";
import { retailService } from "@/core/services/retail/retailService";
import type { RetailStore } from "@/core/types/retail/retail";
import { isVirtualBranch, getStoreTypeLabel } from "@/core/types/retail/retail";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { GlobalFleetDashboard } from "./modules/GlobalFleetDashboard";
import { CreateStoreDialog } from "./CreateStoreDialog";
import { PlusCircle } from "lucide-react";

// --- Context Definitions ---

interface StoreContextType {
  selectedStore: RetailStore | null;
  stores: RetailStore[];
  setSelectedStoreId: (id: string) => void;
  isSaving: boolean;
  saveConfig: () => Promise<void>;
  updateLocalConfig: (updates: Partial<RetailStore>) => void;
  isDirty: boolean;
  selectedStoreId: string;
  canEditStore: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};

// --- Main Layout Component ---

export const StoreProfileLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const session = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [stores, setStores] = useState<RetailStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all_stores");
  const [isSaving, setIsSaving] = useState(false);
  const [localStore, setLocalStore] = useState<RetailStore | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // 1. RBAC Guards & Redirection
  useEffect(() => {
    if (!session) return;

    const role = session.role?.toLowerCase();

    if (role === "staff") {
      toast({
        title: "Access Restricted",
        description: "Staff nodes are redirected to Operations Hub.",
      });
      navigate("/retail/operations-hub");
      return;
    }

    if (role === "store_manager") {
      if (session.location_id) {
        setSelectedStoreId(session.location_id);
      } else {
        // If manager has no assigned store, maybe redirect or show error
        console.warn("Store Manager has no assigned locationId in session");
      }
    }
  }, [session, session.location_id, navigate, toast]);

  // 2. Data Fetching
  useEffect(() => {
    const fetchStores = async () => {
      if (!session.tenant_id) return;
      try {
        const data = await retailService.listStores(session.tenant_id, session);
        setStores(data);
        if (data.length > 0) {
          setSelectedStoreId((prev) =>
            prev === "all_stores" ? data[0].id : prev,
          );
        }
      } catch (error) {
        console.error("Failed to fetch stores", error);
      }
    };
    fetchStores();
  }, [session.tenant_id, session]);

  // 3. Sync local state when selected store changes
  useEffect(() => {
    if (selectedStoreId === "all_stores") {
      setLocalStore(null);
      setIsDirty(false);
    } else {
      const store = stores.find((s) => s.id === selectedStoreId) || null;
      setLocalStore(store);
      setIsDirty(false);
    }
  }, [selectedStoreId, stores]);

  const updateLocalConfig = (updates: Partial<RetailStore>) => {
    if (!localStore) return;
    setLocalStore({ ...localStore, ...updates });
    setIsDirty(true);
  };

  const saveConfig = async () => {
    if (!localStore || !session.tenant_id) return;
    setIsSaving(true);
    try {
      await retailService.updateStore(session.tenant_id, session, localStore);
      toast({
        title: "Node Synchronized",
        description: `Configuration parameters for ${localStore.name} updated globally.`,
      });
      setIsDirty(false);
      // Refresh stores list to get updated version
      const data = await retailService.listStores(session.tenant_id, session);
      setStores(data);
    } catch (e) {
      toast({
        title: "Handshake Failed",
        description: "Consistency check failed during persistence.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const roleStr = session.role?.toLowerCase() || "";
  const isStoreManager = roleStr === "store_manager";

  const canEditStore = [
    "dept_head",
    "finance_dept_head",
    "hr_dept_head",
    "company_admin",
    "hr_admin",
    "finance_admin",
    "owner",
    "superadmin",
  ].includes(roleStr);

  const contextValue = useMemo(
    () => ({
      selectedStore: localStore,
      stores,
      setSelectedStoreId,
      isSaving,
      saveConfig,
      updateLocalConfig,
      isDirty,
      selectedStoreId,
      canEditStore,
    }),
    [localStore, stores, isSaving, isDirty, selectedStoreId, canEditStore],
  );

  const activeTab = location.pathname.split("/").pop() || "overview";

  const tabs = [
    { id: "overview", label: "Metadata", icon: Layout, path: "overview" },
    { id: "operations", label: "Capabilities", icon: Zap, path: "operations" },
    {
      id: "logistics",
      label: "Logistics Hub",
      icon: PackageCheck,
      path: "logistics",
    },
    { id: "hardware", label: "Hardware Grid", icon: Monitor, path: "hardware" },
    { id: "channels", label: "Channel Bindings", icon: Link, path: "channels" },
    {
      id: "governance",
      label: "Risk & Governance",
      icon: ShieldCheck,
      path: "governance",
    },
  ];

  const handleTabChange = (value: string) => {
    navigate(`/m/retail/management/profile/${value}`);
  };

  return (
    <StoreContext.Provider value={contextValue}>
      <div className="flex flex-col">
        {/* Header Section */}
        <div className="px-6 py-3 border-b bg-background/40 backdrop-blur-md shrink-0 flex items-center justify-between gap-6">
          <PageHeader
            title={localStore ? localStore.name : "Fleet Registry"}
            subtitle={
              localStore
                ? `Node: ${localStore.code}`
                : `Global Hub • ${stores.length} Nodes`
            }
          />

          <div className="flex items-center gap-3">
            <Select
              value={selectedStoreId}
              onValueChange={setSelectedStoreId}
              disabled={isStoreManager}
            >
              <SelectTrigger className="w-[280px] h-10 rounded-xl border-border bg-secondary/5 font-black italic text-[11px] shadow-sm hover:bg-muted transition-all">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border shadow-2xl p-1.5">
                {(session.role?.toLowerCase() === "superadmin" ||
                  session.role?.toLowerCase() === "owner") && (
                  <>
                    <SelectItem
                      value="all_stores"
                      className="font-black italic py-2.5 cursor-pointer rounded-lg text-[11px]"
                    >
                      <div className="flex items-center gap-2 text-primary">
                        <Globe className="w-3.5 h-3.5" /> GLOBAL VIEW
                      </div>
                    </SelectItem>
                    <Separator className="my-1.5" />
                  </>
                )}
                {(Array.isArray(stores) ? stores : []).map((s) => (
                  <SelectItem
                    key={s.id}
                    value={s.id}
                    className="font-bold italic py-2.5 cursor-pointer rounded-lg text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full border-2 border-white shadow-sm",
                          s.status === "active"
                            ? "bg-success"
                            : "bg-muted/30",
                        )}
                      />
                      <span>{s.name}</span>
                      <span
                        className={cn(
                          "ml-auto text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                          isVirtualBranch(s)
                            ? "bg-success/10 text-success"
                            : "bg-secondary/10 text-muted-foreground",
                        )}
                      >
                        {isVirtualBranch(s)
                          ? "Virtual"
                          : getStoreTypeLabel(s.type)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {canEditStore && (
              <CreateStoreDialog
                onSuccess={async (newStore) => {
                  // Refresh list
                  const data = await retailService.listStores(
                    session.tenant_id!,
                    session,
                  );
                  setStores(data);
                  // Select the new store
                  setSelectedStoreId(newStore.id);
                }}
              />
            )}

            {localStore && canEditStore && (
              <Button
                onClick={saveConfig}
                disabled={isSaving || !isDirty}
                className={cn(
                  "h-10 px-6 rounded-xl font-black italic uppercase tracking-widest text-[9px] gap-2 shadow-xl transition-all active:scale-95",
                  isDirty ? "bg-primary hover:bg-primary" : "bg-secondary",
                )}
              >
                {isSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save
                    className={cn(
                      "w-3.5 h-3.5",
                      isDirty ? "text-foreground" : "text-primary",
                    )}
                  />
                )}
                {isDirty ? "Save Config" : "Synced"}
              </Button>
            )}
          </div>
        </div>

        {/* Tab Navigation - Hidden in Global View */}
        {selectedStoreId !== "all_stores" && (
          <div className="px-6 bg-background/20 backdrop-blur-sm border-b shrink-0 overflow-x-auto scrollbar-none">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="bg-transparent h-auto p-0 gap-6 rounded-none justify-start flex-nowrap min-w-max">
                {(Array.isArray(tabs) ? tabs : []).map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className={cn(
                      "data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-4 font-black italic uppercase tracking-[0.2em] text-[9px] py-3 px-0 flex items-center gap-2 transition-all whitespace-nowrap",
                      activeTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-muted-foreground",
                    )}
                  >
                    <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Content Area */}
        <div className="bg-secondary/5 p-8 lg:p-6">
          <div className="max-w-7xl mx-auto">
            {selectedStoreId === "all_stores" ? (
              <GlobalFleetDashboard />
            ) : (
              children
            )}
          </div>
        </div>
      </div>
    </StoreContext.Provider>
  );
};
