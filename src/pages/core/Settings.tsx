import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { EmptyState } from "@/components/shared/AsyncState";
import { formatDate, safeText } from "@/lib/format";
import { useSession } from "@/core/security/session";
import { orgSettingsService, OrgProfile, TenantPreferences } from "@/core/services/orgSettingsService";
import { adminService } from "@/core/services/adminService";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Plus, 
  Building2, 
  CreditCard, 
  Monitor, 
  Calculator, 
  Settings2, 
  Globe, 
  Users, 
  ShieldCheck, 
  RefreshCw,
  ChevronRight,
  Loader2,
  Wallet,
  Settings,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import DepartmentWorkspaceLayout from "@/components/layouts/DepartmentWorkspaceLayout";

const SETTINGS_TABS = [
  { value: "general", label: "Profile", icon: Building2 },
  { value: "child-companies", label: "Hierarchy", icon: Globe },
  { value: "taxes", label: "Compliance", icon: ShieldCheck },
  { value: "roles", label: "Roles", icon: Users },
  { value: "integrations", label: "Connect", icon: Settings2 },
] as const;

const SECTIONS = [
  {
    title: "CONFIGURATION",
    items: [
      { id: 'general', icon: Building2, label: "Profile", to: "/core/settings/general" },
      { id: 'child-companies', icon: Globe, label: "Hierarchy", to: "/core/settings/child-companies" },
      { id: 'taxes', icon: ShieldCheck, label: "Compliance", to: "/core/settings/taxes" },
      { id: 'roles', icon: Users, label: "Roles", to: "/core/settings/roles" },
      { id: 'integrations', icon: Settings2, label: "Connect", to: "/core/settings/integrations" },
    ]
  }
];

type SettingsTab = (typeof SETTINGS_TABS)[number]["value"];
const DEFAULT_TAB: SettingsTab = "general";

function isSettingsTab(value?: string): value is SettingsTab {
  return SETTINGS_TABS.some((tab) => tab.value === value);
}

export default function CoreSettings() {
  const navigate = useNavigate();
  const session = useSession();
  const { toast } = useToast();
  const { tab } = useParams<{ tab?: string }>();
  
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    isSettingsTab(tab) ? tab : DEFAULT_TAB,
  );
  
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [preferences, setPreferences] = useState<TenantPreferences | null>(null);
  const [childCompanies, setChildCompanies] = useState<OrgProfile[]>([]);
  // Real_Data: roles bound to the tenant security registry (no Placeholder_Data).
  const [securityRoles, setSecurityRoles] = useState<Array<{ role: string; description: string; users: number; lastUpdated: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [selectedChild, setSelectedChild] = useState<OrgProfile | null>(null);
  const [isChildDetailOpen, setIsChildDetailOpen] = useState(false);
  const [newChild, setNewChild] = useState<{
    name: string;
    industry: string;
    country: string;
    currency: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    geofence_radius?: number;
  }>({
    name: "",
    industry: "retail",
    country: "US",
    currency: "USD",
    address: "",
    geofence_radius: 200,
  });

  const init = async () => {
    setLoading(true);
    try {
      const [p, pref, children, rolesRes] = await Promise.all([
        orgSettingsService.getProfile(session),
        orgSettingsService.getPreferences(session),
        orgSettingsService.getChildCompanies(session),
        adminService.getSecurityRoles(session),
      ]);
      setProfile(p);
      setPreferences(pref);
      setChildCompanies(children);
      setSecurityRoles(Array.isArray(rolesRes?.roles) ? rolesRes.roles : []);
    } catch (err) {
      console.error("Failed to load settings:", err);
      toast({ title: "Sync Failure", description: "Telemetry link to registry timed out.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    init();
  }, [session]);

  const handleCreateChildCompany = async () => {
    if (!newChild.name) return;
    setSaving(true);
    try {
      const created = await orgSettingsService.createChildCompany(session, newChild);
      setChildCompanies([created, ...childCompanies]);
      setIsAddingChild(false);
      setNewChild({ name: "", industry: "retail", country: "US", currency: "USD", address: "", geofence_radius: 200 });
      toast({ title: "Expansion Successful", description: `${created.name} registered in hierarchy.` });
    } catch (err: any) {
      toast({ title: "Expansion Failed", description: err.message || "Registry error.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await orgSettingsService.updateProfile(session, profile);
      toast({ title: "Profile Synchronized", description: "Global identity parameters updated." });
    } catch (err: any) {
      toast({ title: "Sync Failed", description: "Mainframe rejected profile update.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!preferences) return;
    setSaving(true);
    try {
      await orgSettingsService.updatePreferences(session, preferences);
      toast({ title: "Policy Updated", description: "Governance protocols have been re-indexed." });
    } catch (err: any) {
      toast({ title: "Policy Error", description: "Unable to commit governance changes.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (isSettingsTab(tab)) {
      setActiveTab(tab);
      return;
    }
    setActiveTab(DEFAULT_TAB);
  }, [tab]);

  const openChildDetail = (child: OrgProfile) => {
    setSelectedChild(child);
    setIsChildDetailOpen(true);
  };

  const integrationGroups = [
    {
      title: "Payment Protocols",
      description: "Neural links to global clearing houses and regional wallets.",
      items: [
        { id: "stripe", name: "Stripe", status: "Connected", icon: CreditCard, detail: "Standardized card processing and KYC telemetry." },
        { id: "adyen", name: "Adyen", status: "Disconnected", icon: Globe, detail: "Enterprise-grade global payment routing." },
        { id: "regional", name: "Local Pay", status: "Error", icon: Wallet, detail: "Regional wallet synchronization (Synchronization Failure)." },
      ]
    },
    {
      title: "Hard-Link Hardware",
      description: "Direct interfaces with on-site devices and sensors.",
      items: [
        { id: "terminals", name: "POS Terminals", status: "Connected", icon: Monitor, detail: "Encrypted device handshake and health monitoring." },
        { id: "printers", name: "ESC/POS Printers", status: "Disconnected", icon: Settings2, detail: "Managed thermal fleet configuration." },
      ]
    },
    {
      title: "Fiscal Consolidation",
      description: "ERP bridges for automated general ledger synchronization.",
      items: [
        { id: "netsuite", name: "NetSuite", status: "Disconnected", icon: Calculator, detail: "Oracle ERP deep-link and consolidation." },
        { id: "xero", name: "Xero", status: "Disconnected", icon: RefreshCw, detail: "Cloud-native accounting synchronization." },
      ]
    }
  ];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted dark:bg-muted">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground italic">Syncing Central Registry...</p>
        </div>
      </div>
    );
  }

  const mainContent = (
    <div className="p-6">
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {activeTab === "general" && (
          <div className="grid gap-8 lg:grid-cols-2">
            <WorkspacePanel
              title="Organizational Identity"
              description="Core parameters used for document generation and global identification."
            >
              <div className="space-y-6 pt-4">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Business Name</Label>
                  <Input 
                    className="h-12 rounded-xl border-border bg-muted focus:bg-card transition-all font-bold"
                    value={profile?.name || ''} 
                    onChange={(e) => setProfile(p => p ? { ...p, name: e.target.value } : null)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Industry Sector</Label>
                    <Select value={profile?.industry || 'retail'}>
                      <SelectTrigger className="h-12 rounded-xl border-border bg-muted font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="retail">Retail Operations</SelectItem>
                        <SelectItem value="fintech">Financial Services</SelectItem>
                        <SelectItem value="logistics">Global Logistics</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Base Currency</Label>
                    <Select 
                      value={profile?.currency?.toLowerCase() || 'usd'}
                      onValueChange={(val) => setProfile(p => p ? { ...p, currency: val?.toUpperCase() } : null)}
                    >
                      <SelectTrigger className="h-12 rounded-xl border-border bg-muted font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="usd">USD ($)</SelectItem>
                        <SelectItem value="eur">EUR (€)</SelectItem>
                        <SelectItem value="idr">IDR (Rp)</SelectItem>
                        <SelectItem value="sgd">SGD (S$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </WorkspacePanel>

            <WorkspacePanel
              title="Operational Metadata"
              description="Encrypted contact and registration data."
            >
              <div className="space-y-6 pt-4">
                 <div className="p-6 rounded-[2rem] bg-primary dark:bg-primary border border-primary dark:border-primary">
                    <div className="flex items-center gap-4 mb-4">
                       <div className="h-12 w-12 rounded-2xl bg-card dark:bg-muted flex items-center justify-center shadow-lg">
                          <Building2 className="h-6 w-6 text-primary" />
                       </div>
                       <div>
                          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Legal Entity</p>
                          <p className="font-black italic text-foreground">#{profile?.code || 'ROOT_TENANT'}</p>
                       </div>
                    </div>
                    <p className="text-sm text-primary font-medium italic">
                      "Identity verified. All subsidiary nodes inherit this primary cryptographic key."
                    </p>
                 </div>
                 <div className="space-y-3 opacity-60 grayscale cursor-not-allowed">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Registered Address (Immutable)</Label>
                   <Textarea 
                      className="rounded-2xl border-border bg-muted font-medium text-sm min-h-[100px]"
                      value="88 Enterprise Plaza, Cyber Sector 7, Neo-Jakarta, 12110"
                      readOnly
                    />
                 </div>
              </div>
            </WorkspacePanel>
          </div>
        )}

        {activeTab === "child-companies" && (
          <WorkspacePanel
            title="Global Hierarchy"
            description="Sub-nodes and subsidiary clusters registered under this master organization."
            action={
              <Button onClick={() => setIsAddingChild(true)} className="rounded-xl h-10 gap-2">
                <Plus className="h-4 w-4" /> REGISTER NODE
              </Button>
            }
          >
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 pt-4">
              {childCompanies.length === 0 ? (
                <div className="col-span-full py-20 flex flex-col items-center justify-center rounded-[3rem] border border-dashed border-border bg-muted">
                   <Globe className="h-12 w-12 text-muted-foreground mb-4" />
                   <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">No Satellite Nodes Detected</p>
                </div>
              ) : (
                (Array.isArray(childCompanies) ? childCompanies : []).map((child: any) => (
                  <Card 
                    key={child.id} 
                    className="rounded-[2.5rem] border-none shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer group bg-card dark:bg-muted"
                    onClick={() => openChildDetail(child)}
                  >
                    <CardContent className="p-8 space-y-6">
                      <div className="flex justify-between items-start">
                         <div className="h-14 w-14 rounded-2xl bg-muted dark:bg-muted flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-500">
                            <Building2 className="h-7 w-7" />
                         </div>
                         <Badge variant={child.status === 'active' ? 'outline' : 'secondary'} className={cn(
                           "rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest",
                           child.status === 'active' ? "border-success text-success bg-success" : ""
                         )}>
                           {child.status}
                         </Badge>
                      </div>
                      <div className="space-y-1">
                         <h4 className="text-xl font-black italic tracking-tighter uppercase">{child.name}</h4>
                         <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                           <Globe className="h-3 w-3" /> {child.country} • {child.industry}
                         </div>
                      </div>
                      <Separator className="bg-muted dark:bg-muted" />
                      <div className="flex items-center justify-between">
                         <p className="text-[10px] font-mono text-primary font-bold">{child.code}</p>
                         <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </WorkspacePanel>
        )}

        {activeTab === "integrations" && (
          <div className="grid gap-10">
            {(Array.isArray(integrationGroups) ? integrationGroups : []).map((group, i) => (
              <WorkspacePanel
                key={i}
                title={group.title}
                description={group.description}
              >
                <div className="grid gap-6 md:grid-cols-2 pt-4">
                   {(Array.isArray(group.items) ? group.items : []).map((item) => (
                     <div key={item.id} className="p-8 rounded-[2.5rem] border border-border dark:border-border bg-card dark:bg-muted hover:shadow-2xl transition-all duration-500 group flex flex-col justify-between h-full">
                        <div className="space-y-6">
                          <div className="flex justify-between items-start">
                            <div className="h-14 w-14 rounded-2xl bg-muted dark:bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-inner">
                              <item.icon className="h-7 w-7" />
                            </div>
                            <Badge variant="outline" className={cn(
                              "rounded-full px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.2em]",
                              item.status === 'Connected' ? "bg-success text-success border-success" :
                              item.status === 'Error' ? "bg-destructive text-destructive border-destructive animate-pulse" :
                              "bg-muted text-muted-foreground border-border"
                            )}>
                              {item.status}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-xl font-black uppercase tracking-tighter italic">{item.name}</h4>
                            <p className="text-xs font-medium text-muted-foreground leading-relaxed">{item.detail}</p>
                          </div>
                        </div>
                        <div className="pt-8 flex items-center gap-3">
                           <Button 
                             variant="outline" 
                             className="flex-1 rounded-xl h-11 font-black text-[10px] uppercase tracking-widest"
                             onClick={() => toast({ title: "Protocol Logs", description: `Fetching live telemetry for ${item.name}...` })}
                           >
                              PROTOCOL LOGS
                            </Button>
                           <Button 
                             className="flex-1 rounded-xl h-11 font-black text-[10px] uppercase tracking-widest bg-primary hover:bg-primary text-white border-none"
                             onClick={() => toast({ title: "Handshake Initiated", description: `Establishing secure link with ${item.name} gateway...` })}
                           >
                              {item.status === 'Connected' ? 'CONFIGURE' : 'ESTABLISH LINK'}
                            </Button>
                        </div>
                     </div>
                   ))}
                </div>
              </WorkspacePanel>
            ))}
          </div>
        )}

        {activeTab === "roles" && (
          <WorkspacePanel
            title="Organizational Roles"
            description="Define permission clusters and access levels across the organization."
            action={
              <Button variant="outline" className="rounded-xl h-10 gap-2 font-black text-[10px] uppercase tracking-widest border-border">
                <Plus className="h-3.5 w-3.5" /> ADD ROLE
              </Button>
            }
          >
            <div className="pt-4 overflow-hidden">
               <div className="rounded-[2rem] border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted border-none hover:bg-muted">
                        <TableHead className="py-6 px-8 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Identity</TableHead>
                        <TableHead className="py-6 px-8 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description</TableHead>
                        <TableHead className="py-6 px-8 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Users</TableHead>
                        <TableHead className="py-6 px-8 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Last Sync</TableHead>
                        <TableHead className="py-6 px-8 text-right"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {securityRoles.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="p-0">
                            <EmptyState
                              title="No roles defined"
                              description="Permission clusters for this organization will appear here once roles are provisioned."
                            />
                          </TableCell>
                        </TableRow>
                      ) : (
                      (Array.isArray(securityRoles) ? securityRoles : []).map((role) => (
                        <TableRow key={role.role} className="group border-border hover:bg-muted transition-colors">
                          <TableCell className="py-6 px-8">
                            <div className="flex items-center gap-4">
                               <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary transition-all">
                                  <Users className="h-5 w-5" />
                               </div>
                               <span className="font-black text-xs uppercase tracking-tighter italic">{safeText(role.role)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-6 px-8">
                            <span className="text-[11px] font-medium text-muted-foreground leading-relaxed max-w-xs block">{safeText(role.description)}</span>
                          </TableCell>
                          <TableCell className="py-6 px-8">
                            <Badge variant="secondary" className="rounded-full px-3 py-0.5 text-[10px] font-black">{role.users ?? 0}</Badge>
                          </TableCell>
                          <TableCell className="py-6 px-8 text-[10px] font-bold text-muted-foreground uppercase">{formatDate(role.lastUpdated)}</TableCell>
                          <TableCell className="py-6 px-8 text-right">
                             <Button variant="ghost" size="sm" className="rounded-lg h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRight className="h-4 w-4" />
                             </Button>
                          </TableCell>
                        </TableRow>
                      ))
                      )}
                    </TableBody>
                  </Table>
               </div>
            </div>
          </WorkspacePanel>
        )}

        {activeTab === "taxes" && (
          <WorkspacePanel
            title="Global Compliance"
            description="Fiscal protocols, tax logic, and financial reporting parameters."
          >
            <div className="grid gap-8 md:grid-cols-2 pt-4">
               <div className="space-y-4 p-8 rounded-[2.5rem] border border-border bg-muted">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Default Consumption Tax (%)</Label>
                  <Input type="number" defaultValue={10} className="h-14 rounded-2xl font-black text-2xl border-none shadow-inner" />
                  <p className="text-[10px] font-bold text-muted-foreground italic">"Global fallback rate for non-geocoded transactions."</p>
               </div>
               <div className="space-y-4 p-8 rounded-[2.5rem] border border-border bg-muted">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rounding Protocol</Label>
                  <Select defaultValue="nearest">
                     <SelectTrigger className="h-14 rounded-2xl font-black text-lg border-none shadow-inner">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="rounded-2xl border-none shadow-2xl">
                        <SelectItem value="nearest">Nearest Cent (Standard)</SelectItem>
                        <SelectItem value="floor">Floor (Strict Reconciliation)</SelectItem>
                        <SelectItem value="ceil">Ceiling (Tax Aggressive)</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
            </div>
          </WorkspacePanel>
        )}
      </div>

      <Dialog open={isAddingChild} onOpenChange={setIsAddingChild}>
        <DialogContent className="sm:max-w-2xl rounded-[3rem] border-none shadow-2xl p-10 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-4">
            <DialogTitle className="text-4xl font-black tracking-tighter italic uppercase">Register Satellite Node</DialogTitle>
            <DialogDescription className="font-medium text-muted-foreground uppercase tracking-widest text-[10px]">
              Initialize a new subsidiary entity within the organizational hierarchy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Node Identity (Name)</Label>
              <Input
                placeholder="Enterprise Satellite Name"
                className="h-12 rounded-xl border-border bg-muted focus:bg-card transition-all font-bold"
                value={newChild.name}
                onChange={(e) => setNewChild({ ...newChild, name: e.target.value })}
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">HQ Physical Address</Label>
              <Textarea
                placeholder="Enter full physical address for this node"
                className="rounded-xl border-border bg-muted focus:bg-card transition-all font-bold min-h-[80px]"
                value={newChild.address || ""}
                onChange={(e) => setNewChild({ ...newChild, address: e.target.value })}
              />
            </div>
            <div className="p-6 bg-primary rounded-[2rem] border border-primary space-y-6">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5" /> Geospatial Anchoring
                </label>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.0000"
                    className="h-10 rounded-xl border-none bg-card shadow-inner font-bold"
                    value={newChild.latitude ?? ""}
                    onChange={(e) =>
                      setNewChild({ ...newChild, latitude: parseFloat(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Longitude</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.0000"
                    className="h-10 rounded-xl border-none bg-card shadow-inner font-bold"
                    value={newChild.longitude ?? ""}
                    onChange={(e) =>
                      setNewChild({ ...newChild, longitude: parseFloat(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Geofence Radius</Label>
                  <span className="text-[10px] font-black text-primary">{newChild.geofence_radius ?? 200}m</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="50"
                  className="w-full h-1.5 bg-primary rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  value={newChild.geofence_radius ?? 200}
                  onChange={(e) =>
                    setNewChild({ ...newChild, geofence_radius: parseInt(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Industry Vector</Label>
                <Select value={newChild.industry} onValueChange={(val) => setNewChild({ ...newChild, industry: val })}>
                  <SelectTrigger className="h-12 rounded-xl border-border bg-muted font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="retail">Retail Operations</SelectItem>
                    <SelectItem value="logistics">Logistics</SelectItem>
                    <SelectItem value="services">Service Suite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Jurisdiction</Label>
                <Select value={newChild.country} onValueChange={(val) => setNewChild({ ...newChild, country: val })}>
                  <SelectTrigger className="h-12 rounded-xl border-border bg-muted font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="US">USA (USD)</SelectItem>
                    <SelectItem value="ID">IDN (IDR)</SelectItem>
                    <SelectItem value="SG">SGP (SGD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-4 pt-4">
            <Button variant="ghost" onClick={() => setIsAddingChild(false)} className="rounded-xl h-14 px-8 font-black text-xs uppercase tracking-widest">
              ABORT
            </Button>
            <Button
              disabled={saving || !newChild.name}
              onClick={handleCreateChildCompany}
              className="rounded-2xl h-14 px-10 font-black text-xs uppercase tracking-widest bg-primary hover:bg-primary text-white shadow-xl shadow-indigo-500/20"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              INITIALIZE NODE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isChildDetailOpen} onOpenChange={setIsChildDetailOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[4rem] border-none shadow-2xl p-14 bg-card dark:bg-muted">
          {selectedChild && (
            <div className="space-y-10">
               <div className="flex justify-between items-start">
                  <div className="space-y-2">
                     <Badge className="bg-success text-white border-none font-black text-[9px] px-3 py-1 rounded-full uppercase tracking-widest">Active Satellite</Badge>
                     <h2 className="text-5xl font-black tracking-tighter italic uppercase">{selectedChild.name}</h2>
                     <p className="text-sm font-bold text-muted-foreground">NODE ID: {selectedChild.code}</p>
                  </div>
                  <div className="h-20 w-20 rounded-[2rem] bg-muted dark:bg-muted flex items-center justify-center shadow-inner">
                     <Building2 className="h-10 w-10 text-primary" />
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-2">
                     <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sector</p>
                     <p className="text-lg font-black italic">{selectedChild.industry?.toUpperCase() || "RETAIL"}</p>
                  </div>
                  <div className="space-y-2 text-right">
                     <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Jurisdiction</p>
                     <p className="text-lg font-black italic">{selectedChild.country?.toUpperCase() || "US"}</p>
                  </div>
               </div>
               <Separator className="bg-muted" />
               <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Satellite Telemetry</p>
                  <div className="grid grid-cols-3 gap-6">
                     {[
                       { label: "Active Staff", value: "14" },
                       { label: "Daily Trans", value: "892" },
                       { label: "Sync Status", value: "100%" },
                     ].map((stat, i) => (
                       <div key={i} className="p-6 rounded-3xl bg-muted dark:bg-muted border border-border dark:border-border text-center space-y-1">
                          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                          <p className="text-xl font-black italic">{stat.value}</p>
                       </div>
                     ))}
                  </div>
               </div>
               <div className="flex gap-4">
                  <Button variant="outline" className="flex-1 rounded-2xl h-14 font-black text-xs uppercase tracking-widest border-border">
                    SATELLITE LOGS
                  </Button>
                  <Button className="flex-1 rounded-2xl h-14 font-black text-xs uppercase tracking-widest bg-primary hover:bg-primary text-white shadow-xl shadow-indigo-500/20">
                    REMOTE ACCESS
                  </Button>
               </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <DepartmentWorkspaceLayout
      title="Registry & Settings"
      subtitle="Centralized management for organizational identity, hierarchy, and global governance."
      headerIcon={Settings}
      accentColor="indigo"
      engineName="REGISTRY_ENGINE"
      pulseLabel="System Pulse"
      pulseIcon={Activity}
      sections={SECTIONS}
      routeLabels={{}}
      basePath="/core/settings"
      headerActions={
        <Button
          disabled={saving}
          className="rounded-[1.5rem] px-8 h-12 font-black text-xs uppercase tracking-widest bg-primary hover:bg-primary shadow-xl shadow-indigo-500/20"
          onClick={activeTab === 'general' ? handleSaveProfile : handleSavePreferences}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          COMMIT CHANGES
        </Button>
      }
    >
      {mainContent}
    </DepartmentWorkspaceLayout>
  );
}
