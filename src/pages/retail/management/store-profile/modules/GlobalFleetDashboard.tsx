import React from "react";
import { useStore } from "../StoreProfileLayout";
import {
  Building2,
  Activity,
  MonitorSmartphone,
  Globe,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  isVirtualBranch,
  getStoreTypeLabel,
} from "@/core/types/retail/retail";
import { RegisterEcommerceBranchDialog } from "../../components/channels/RegisterEcommerceBranchDialog";

export const GlobalFleetDashboard: React.FC = () => {
  const { stores, setSelectedStoreId } = useStore();

  const storeList = Array.isArray(stores) ? stores : [];
  const activeStores = storeList.filter((s) => s.status === "active").length;
  const flagships = storeList.filter((s) => s.type === "flagship").length;
  const virtualBranches = storeList.filter((s) => isVirtualBranch(s)).length;

  // Aggregate operational insights
  const totalPosTerminals = stores.reduce((acc, store) => {
    const limit = store.operationalConfig?.pos_device_limit || 0;
    return acc + limit;
  }, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-xl text-primary">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black italic uppercase tracking-wider text-muted-foreground">
              Global Fleet Overview
            </h2>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {storeList.length} nodes • {virtualBranches} virtual (e-commerce)
            </p>
          </div>
        </div>
        {/* Unified entry point: register e-commerce as a virtual branch in the hierarchy */}
        <RegisterEcommerceBranchDialog
          onSuccess={(branch) => branch?.id && setSelectedStoreId(branch.id)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-border shadow-sm rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-black italic text-muted-foreground">
              Active Nodes
            </CardTitle>
            <Activity className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{activeStores}</div>
            <p className="text-xs text-muted-foreground font-bold mt-1 tracking-widest uppercase">
              Operational Fleet
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-black italic text-muted-foreground">
              Flagship Hubs
            </CardTitle>
            <Building2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{flagships}</div>
            <p className="text-xs text-muted-foreground font-bold mt-1 tracking-widest uppercase">
              Strategic Locations
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-black italic text-muted-foreground">
              Virtual Branches
            </CardTitle>
            <Globe className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{virtualBranches}</div>
            <p className="text-xs text-muted-foreground font-bold mt-1 tracking-widest uppercase">
              E-Commerce Presence
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-black italic text-muted-foreground">
              Max POS Capacity
            </CardTitle>
            <MonitorSmartphone className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{totalPosTerminals}</div>
            <p className="text-xs text-muted-foreground font-bold mt-1 tracking-widest uppercase">
              Global Terminals
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Node Registration Table / List */}
      <Card className="border-border shadow-sm rounded-2xl mt-8">
        <CardHeader>
          <CardTitle className="text-sm font-black italic text-muted-foreground">
            Fleet Index
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {storeList.map((store) => {
              const virtual = isVirtualBranch(store);
              const TypeIcon = virtual ? Globe : Building2;
              return (
                <div
                  key={store.id}
                  onClick={() => setSelectedStoreId(store.id)}
                  data-testid="fleet-index-row"
                  data-branch-kind={virtual ? "virtual" : "physical"}
                  className="flex items-center justify-between p-4 rounded-xl border border-border bg-secondary/5 cursor-pointer hover:border-primary hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg border flex items-center justify-center shadow-sm transition-colors ${
                        virtual
                          ? "bg-success/10 border-success/20 group-hover:border-success/60"
                          : "bg-card border-border group-hover:border-primary"
                      }`}
                    >
                      <TypeIcon
                        className={`w-5 h-5 transition-colors ${
                          virtual
                            ? "text-success"
                            : "text-muted-foreground group-hover:text-primary"
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-muted-foreground">
                          {store.name}
                        </p>
                        {/* Clear physical-vs-virtual type indicator */}
                        <span
                          className={`text-[9px] font-black italic uppercase tracking-widest px-2 py-0.5 rounded-md ${
                            virtual
                              ? "bg-success/10 text-success"
                              : "bg-secondary/10 text-muted-foreground"
                          }`}
                        >
                          {virtual ? "Virtual" : "Physical"}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5 font-bold uppercase tracking-widest">
                        {store.code}
                        {/* Parent-child relationship: virtual branch anchored to a location */}
                        {virtual && store.locationId
                          ? ` • ↳ anchored to ${store.locationId}`
                          : store.timezone
                            ? ` • ${store.timezone}`
                            : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span
                        className={`text-[10px] font-black italic uppercase tracking-widest px-2 py-1 rounded-md ${store.status === "active" ? "bg-success/10 text-success" : "bg-muted/20 text-muted-foreground"}`}
                      >
                        {store.status}
                      </span>
                      <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mt-1">
                        {getStoreTypeLabel(store.type)}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
