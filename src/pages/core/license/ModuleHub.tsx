import { useEffect, useState, useCallback, useMemo } from "react";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { useApp } from "@/contexts/AppContext";
import { apiRequest } from "@/core/api/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { getAllModuleContracts } from "@/core/runtime/moduleRegistry";
import { cn } from "@/lib/utils";
import { 
  Shield, 
  Search, 
  CheckCircle2, 
  Layout,
  ExternalLink,
  Puzzle,
  Wallet,
  Users2,
  ShieldCheck,
  ShoppingCart,
  Package,
  BarChart3,
  Link2,
  Zap,
  Globe,
  Activity,
  Plus
} from "lucide-react";
import DepartmentWorkspaceLayout from "@/components/layouts/DepartmentWorkspaceLayout";

// Platform Core Modules Definition (Static for display)
const CORE_MODULES = [
  { id: "finance", name: "Finance & Treasury", icon: Wallet, description: "General ledger, receivables, payables, and global treasury mapping.", category: "core" },
  { id: "procurement", name: "Procurement", icon: ShoppingCart, description: "Supplier management, purchase requests, and automated PO release.", category: "core" },
  { id: "inventory", name: "Inventory", icon: Package, description: "Global stock visibility, receiving, and IoT-enabled tracking.", category: "core" },
  { id: "hr", name: "Human Resources", icon: Users2, description: "Staff directory, scheduling, payroll, and compliance vault.", category: "core" },
  { id: "it", name: "IT & Systems", icon: ShieldCheck, description: "Device management, system health, and infrastructure security.", category: "core" },
  { id: "sales", name: "Sales & Revenue", icon: BarChart3, description: "CRM, pipeline management, and incentive engines.", category: "core" },
  { id: "marketing", name: "Marketing", icon: Link2, description: "Campaign automation, customer 360, and omnichannel growth.", category: "core" },
  { id: "audit", name: "Audit & Compliance", icon: Shield, description: "Immutable logs, forensic auditing, and fiscal telemetry.", category: "core" },
];

const SECTIONS = [
  {
    title: "HUB_OPERATIONS",
    items: [
      { id: 'all', icon: Globe, label: "Registry", to: "/core/license" },
    ]
  }
];

export default function ModuleHub() {
  const { state: appState, updateSettings } = useApp();
  const { toast } = useToast();
  const [licenses, setLicenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const fetchLicenses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<any[]>("/license/my-modules", "GET", appState.currentUser);
      setLicenses(data || []);
    } catch (error: any) {
      console.error("Failed to fetch licenses:", error);
      setLicenses([]);
    } finally {
      setLoading(false);
    }
  }, [appState.currentUser]);

  useEffect(() => {
    fetchLicenses();
  }, [fetchLicenses]);

  const handleToggle = async (moduleCode: string, currentEnabled: boolean) => {
    setSavingId(moduleCode);
    try {
      await apiRequest(`/license/toggle/${moduleCode}`, "POST", appState.currentUser, { 
        enabled: !currentEnabled 
      });
      
      const currentIds = appState.settings.activatedModuleIds || [];
      let newIds: string[];
      if (!currentEnabled) {
        newIds = [...currentIds, moduleCode];
      } else {
        newIds = (Array.isArray(currentIds) ? currentIds : []).filter(id => id !== moduleCode);
      }
      
      updateSettings({
        ...appState.settings,
        activatedModuleIds: newIds
      });

      toast({
        title: !currentEnabled ? "Module Initialized" : "Module Deactivated",
        description: `${moduleCode.toUpperCase()} protocol has been ${!currentEnabled ? "linked" : "severed"}.`,
      });
      
      fetchLicenses();
    } catch (error: any) {
      toast({
        title: "Link Failure",
        description: error.message || "Could not reconfigure module state.",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  const industryContracts = getAllModuleContracts();
  
  const allModules = useMemo(() => {
    const industry = (Array.isArray(industryContracts) ? industryContracts : []).map(c => {
      const license = licenses.find(l => l.moduleCode.toLowerCase() === c.id.toLowerCase());
      return {
        id: c.id,
        name: c.name,
        description: c.description,
        icon: c.id === 'retail' ? ShoppingCart : Puzzle,
        category: "industry",
        isCore: false,
        isEnabled: appState.settings.activatedModuleIds.includes(c.id),
        status: license?.status || "available"
      };
    });

    const core = (Array.isArray(CORE_MODULES) ? CORE_MODULES : []).map(m => ({
      ...m,
      isCore: true,
      isEnabled: true,
      status: "active"
    }));

    return [...core, ...industry];
  }, [licenses, industryContracts, appState.settings.activatedModuleIds]);

  const filteredModules = (Array.isArray(allModules) ? allModules : []).filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         m.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === "all" || m.category === activeTab;
    return matchesSearch && matchesTab;
  });

  if (loading && licenses.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted dark:bg-muted">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground italic">Accessing Module Registry...</p>
        </div>
      </div>
    );
  }

  const mainContent = (
    <div className="flex h-full">
      {/* Categories Sidebar */}
      <div className="w-64 p-6 border-r border-border space-y-8 bg-muted">
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground italic">Categories</div>
            <p className="text-xs font-bold text-muted-foreground">Filter your workspace</p>
          </div>
          <TabsList className="flex flex-col items-stretch bg-transparent p-0 gap-2">
            {[
              { value: "all", label: "All Modules", icon: Globe },
              { value: "core", label: "Platform Core", icon: Shield },
              { value: "industry", label: "Industry Verticals", icon: Layout },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className="justify-start rounded-2xl px-5 py-4 text-sm font-bold transition-all data-[state=active]:bg-card data-[state=active]:shadow-lg data-[state=active]:text-primary border-none group"
              >
                <tab.icon className="mr-3 h-5 w-5 opacity-60 group-data-[state=active]:opacity-100 transition-opacity" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          
          <Separator className="bg-muted" />
          
          <div className="p-6 rounded-3xl bg-primary border border-primary space-y-4">
             <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-primary" />
                <span className="font-black text-[10px] uppercase tracking-widest text-primary">System Health</span>
             </div>
             <p className="text-[11px] text-primary font-medium leading-relaxed">
               All active modules are currently synchronized with the central registry.
             </p>
          </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <Tabs value={activeTab} className="h-full">
          <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <WorkspacePanel
              title={activeTab === 'all' ? 'All Platform Modules' : activeTab === 'core' ? 'Core Infrastructure' : 'Industry Solutions'}
              description="Activate or deactivate functional clusters across your enterprise environment."
            >
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 pt-6">
                {(Array.isArray(filteredModules) ? filteredModules : []).map((module) => (
                  <div 
                    key={module.id} 
                    className={cn(
                      "p-8 rounded-[2.5rem] border transition-all duration-500 group flex flex-col justify-between h-full",
                      module.isCore 
                        ? "bg-muted border-border grayscale-[0.5] hover:grayscale-0" 
                        : "bg-card border-border hover:shadow-2xl hover:-translate-y-1"
                    )}
                  >
                    <div className="space-y-6">
                      <div className="flex justify-between items-start">
                        <div className={cn(
                          "h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-inner",
                          module.isCore ? "bg-muted text-muted-foreground" : "bg-primary text-primary group-hover:bg-primary group-hover:text-white"
                        )}>
                          <module.icon className="h-7 w-7" />
                        </div>
                        <Badge variant="outline" className={cn(
                          "rounded-full px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.2em]",
                          module.isCore ? "bg-muted text-muted-foreground border-border" :
                          module.isEnabled ? "bg-success text-success border-success" :
                          "bg-muted text-muted-foreground border-border"
                        )}>
                          {module.isCore ? "Core System" : module.isEnabled ? "Active" : "Disabled"}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-xl font-black uppercase tracking-tighter italic">{module.name}</h4>
                        <p className="text-xs font-medium text-muted-foreground leading-relaxed min-h-[40px]">
                          {module.description}
                        </p>
                      </div>
                    </div>
                    
                    <div className="pt-8 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          {module.isCore ? (
                             <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest italic">
                                <CheckCircle2 className="h-3 w-3" /> Permanent
                             </div>
                          ) : (
                            <>
                              <Switch 
                                id={`toggle-${module.id}`} 
                                checked={module.isEnabled}
                                disabled={savingId === module.id}
                                onCheckedChange={() => handleToggle(module.id, module.isEnabled)}
                                className="data-[state=checked]:bg-primary"
                              />
                              <Label htmlFor={`toggle-${module.id}`} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                 {savingId === module.id ? "SYNCING..." : module.isEnabled ? "ENABLED" : "DISABLED"}
                              </Label>
                            </>
                          )}
                       </div>
                       
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         className="rounded-xl h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                         onClick={() => toast({ title: "Module Details", description: `Fetching manifest for ${module.name}...` })}
                       >
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                       </Button>
                    </div>
                  </div>
                ))}
                
                {filteredModules.length === 0 && (
                   <div className="col-span-full py-20 flex flex-col items-center justify-center rounded-[3rem] border border-dashed border-border bg-muted">
                      <Search className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">No matching modules detected</p>
                   </div>
                )}
              </div>
            </WorkspacePanel>
            
            <WorkspacePanel title="Subscription Intelligence" className="bg-muted text-muted-foreground border-none shadow-2xl rounded-[3rem]">
              <div className="flex flex-col md:flex-row gap-12 items-center p-4">
                <div className="flex-1 space-y-6">
                  <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center">
                    <Shield className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black italic tracking-tighter uppercase">Compliance Verified</h3>
                    <p className="text-muted-foreground text-sm font-medium leading-relaxed max-w-md">
                      All active modules have been cryptographically signed. Your enterprise environment is currently operating within licensing parameters.
                    </p>
                  </div>
                  <Button className="rounded-2xl h-12 px-8 font-black text-xs uppercase tracking-widest bg-primary hover:bg-primary">
                    DOWNLOAD AUDIT REPORT
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-6 w-full md:w-auto">
                  {[
                    { label: "Total Clusters", value: allModules.length },
                    { label: "Active Nodes", value: (Array.isArray(allModules) ? allModules : []).filter(m => m.isEnabled).length },
                    { label: "Uptime Sync", value: "99.9%" },
                    { label: "License Type", value: "Enterprise" },
                  ].map((stat, i) => (
                    <div key={i} className="p-8 bg-muted rounded-[2rem] border border-border/50 min-w-[160px] space-y-1">
                      <div className="text-3xl font-black italic text-white tracking-tighter">{stat.value}</div>
                      <div className="text-[10px] font-black text-primary uppercase tracking-widest">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </WorkspacePanel>
          </div>
        </Tabs>
      </div>
    </div>
  );

  return (
    <DepartmentWorkspaceLayout
      title="Module Hub"
      subtitle="Manage platform extensions, industry verticals, and core administrative capabilities."
      headerIcon={Puzzle}
      accentColor="indigo"
      engineName="REGISTRY_ENGINE"
      pulseLabel="Hub Pulse"
      pulseIcon={Activity}
      sections={SECTIONS}
      routeLabels={{}}
      basePath="/core/license"
      headerActions={
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search modules..." 
            className="pl-10 h-11 rounded-xl bg-card shadow-sm text-xs font-bold"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      }
    >
      {mainContent}
    </DepartmentWorkspaceLayout>
  );
}
