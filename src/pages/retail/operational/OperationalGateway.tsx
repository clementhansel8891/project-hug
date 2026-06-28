import React from 'react';
import { 
  ShoppingCart, RotateCcw, ScanLine, Truck, Monitor, Lock, Layout,
  Minimize2, Maximize2, Power, Home, Store, UserCircle, Banknote, Building2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRetail } from '../context/RetailContext';
import { GlassCard } from '@/components/shared/GlassCard';
import { CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { RetailModeSwitchControl } from '../components/RetailModeSwitchControl';

interface AppItem {
  id: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  route: string;
  color: string;
  bg: string;
  requireShift?: boolean;
}

const APPS: AppItem[] = [
  { id: "ops-pos", title: "POS Terminal", desc: "Sales Execution", icon: ShoppingCart, route: "/m/retail/operational/pos", color: "text-primary", bg: "bg-primary/10", requireShift: true },
  { id: "ops-refund", title: "Refund Desk", desc: "Post-Sale Disputes", icon: RotateCcw, route: "/m/retail/operational/refund", color: "text-destructive", bg: "bg-destructive/10", requireShift: true },
  { id: "ops-cash-movement", title: "Cash Movement", desc: "Petty Cash & Out", icon: Banknote, route: "/m/retail/operational/cash-movement", color: "text-warning", bg: "bg-warning/10", requireShift: true },
  { id: "ops-opname", title: "Stock Opname", desc: "Inventory Audit", icon: ScanLine, route: "/m/retail/operational/opname", color: "text-primary", bg: "bg-primary/10", requireShift: true },
  { id: "ops-receiving", title: "Stock Intake", desc: "Good Receiving", icon: Truck, route: "/m/retail/operational/receiving", color: "text-warning", bg: "bg-warning/10", requireShift: true },
  { id: "ops-kiosk", title: "Self-Service", desc: "Guest Checkout", icon: Monitor, route: "/m/retail/operational/kiosk", color: "text-accent", bg: "bg-accent/10", requireShift: true },
  { id: "ops-shift-open", title: "Shift Open", desc: "Start Session", icon: Power, route: "/m/retail/operational/shift-open", color: "text-success", bg: "bg-success/10" },
  { id: "ops-shift-close", title: "Shift Close", desc: "End Reconciliation", icon: Lock, route: "/m/retail/operational/shift-close", color: "text-muted-foreground", bg: "bg-muted/20" },
];

const RetailOperationalGateway = () => {
  const navigate = useNavigate();
  const { activeStore, stores, setStore, activeShift, setMode } = useRetail();
  const { user, session, logout } = useAuth();
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const companyName = user?.user_companies?.find(c => c.tenant_id === session?.tenant_id)?.company.name || "Zenvix Corp";

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const handleExit = () => {
    setMode('management');
    navigate('/m/retail/workspace');
  };

  // Filter apps based on shift status
  const visibleApps = (Array.isArray(APPS) ? APPS : []).filter(app => {
    if (app.id === "ops-shift-open") return !activeShift;
    if (app.id === "ops-shift-close") return !!activeShift;
    if (app.requireShift) return !!activeShift;
    return true;
  });

  if (!activeStore && (Array.isArray(stores) ? stores : []).length > 0) {
     return (
        <div className="flex-1 flex flex-col items-center justify-center surface-tactical p-6 md:p-12 relative overflow-hidden selection:bg-primary/30">
           {/* Atmospheric effect */}
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.15)_0%,transparent_70%)]" />
           <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none" />
           
           <div className="relative z-10 max-w-4xl w-full animate-in fade-in zoom-in duration-700">
              <div className="text-center mb-16">
                 <div className="w-28 h-28 bg-primary rounded-[3rem] mx-auto flex items-center justify-center shadow-[0_0_80px_hsl(var(--primary)/0.5)] mb-10 transform -rotate-6 hover:rotate-0 transition-transform duration-500">
                    <Store className="w-14 h-14 text-primary-foreground" />
                 </div>
                 <h1 className="text-6xl font-black text-foreground italic tracking-tighter uppercase mb-4 leading-none">
                    Establishing Uplink
                 </h1>
                 <p className="text-primary font-black uppercase tracking-[0.5em] text-[12px] italic opacity-70">
                    Select Operational Node for Physical Execution
                 </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {stores.map(store => (
                    <GlassCard 
                       key={store.id}
                       className="bg-card/50 border-border hover:border-primary/50 hover:bg-muted/80 transition-all duration-500 cursor-pointer rounded-[3rem] group overflow-hidden shadow-2xl hover:-translate-y-2 active:scale-95"
                       onClick={() => setStore(store.id)}
                    >
                       <CardContent className="p-12 flex items-center gap-10">
                          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center group-hover:bg-primary/20 transition-all border border-border">
                             <Building2 className="w-10 h-10 text-primary group-hover:scale-110 transition-transform" />
                          </div>
                          <div className="flex-1">
                             <div className="text-3xl font-black text-foreground uppercase italic tracking-tighter mb-1.5 group-hover:text-primary transition-colors">
                                {store.name}
                             </div>
                             <div className="flex items-center gap-3">
                                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest text-muted-foreground border-border bg-muted/20">
                                   {store.type}
                                </Badge>
                                <span className="w-1 h-1 rounded-full bg-border" />
                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                                   {store.timezone}
                                </span>
                             </div>
                          </div>
                       </CardContent>
                    </GlassCard>
                 ))}
              </div>

              <div className="mt-20 text-center">
                 <Button 
                    variant="ghost" 
                    className="text-muted-foreground hover:text-foreground uppercase font-black italic text-[11px] tracking-[0.4em] gap-4 transition-all"
                    onClick={() => { setMode('management'); navigate('/m/retail/workspace'); }}
                 >
                    <Home className="w-4 h-4" />
                    Return to Global Management
                 </Button>
              </div>
           </div>
        </div>
     );
  }

  return (
    <div className="flex-1 flex flex-col p-6 md:p-12 relative selection:bg-primary/30">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 p-32 opacity-[0.03] pointer-events-none">
        <Layout className="w-[45rem] h-[45rem]" />
      </div>

      <div className="max-w-[1600px] mx-auto w-full flex-1 flex flex-col relative z-10">
        {/* Top System Bar - Utilities & Mode Switch */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-8 px-8">
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 bg-muted/20 border border-border px-4 py-2 rounded-xl backdrop-blur-md">
                 <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                 <span className="text-[10px] font-black uppercase text-primary tracking-[0.2em] italic">System Status: Active</span>
              </div>
              <Badge variant="outline" className="border-border text-muted-foreground font-black italic uppercase tracking-widest text-[9px] px-3 py-1 bg-muted/20">
                OPERATIONAL_CORE_v2.5
              </Badge>
           </div>

           <div className="flex items-center gap-6">
              <RetailModeSwitchControl variant="tactical" />
              
              <div className="h-8 w-[1px] bg-border" />

              <div className="flex items-center gap-3">
                  <Button 
                    variant="outline" 
                    className="bg-card border-border text-foreground hover:bg-primary hover:text-primary-foreground h-10 w-10 rounded-xl transition-all hover:scale-110 active:scale-95 shadow-xl group"
                    onClick={() => window.location.href = "/"}
                    title="Go to Core"
                  >
                    <Home className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  </Button>

                  <Button 
                    variant="outline" 
                    className="bg-card border-border text-foreground hover:bg-muted h-10 w-10 rounded-xl transition-all hover:scale-110 active:scale-95 shadow-xl"
                    onClick={toggleFullscreen}
                    title="Toggle Fullscreen"
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4 text-primary" /> : <Maximize2 className="w-4 h-4 text-primary" />}
                  </Button>
              </div>
           </div>
        </div>

        {/* Header Area - Ultra Tactical */}
        <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-8 mb-12 bg-card/40 p-10 rounded-[3.5rem] border border-border backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          
          
          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center shadow-[0_0_50px_hsl(var(--primary)/0.4)] transform hover:rotate-12 transition-transform duration-500">
              <Store className="w-10 h-10 text-primary-foreground" />
            </div>
            <div className="text-center md:text-left">
              <div className="flex items-center gap-4 justify-center md:justify-start mb-2">
                <h1 className="text-5xl font-black text-foreground italic tracking-tighter uppercase leading-none">
                  {companyName}
                </h1>
                <Badge variant="outline" className="border-primary/30 text-primary font-black italic uppercase tracking-widest text-[9px] px-3 py-1 bg-primary/5">
                  OP_PLANE_v2.5
                </Badge>
              </div>
              <p className="text-primary font-black uppercase tracking-[0.4em] text-[11px] italic">
                {activeStore?.name || "Global Operations Hub"} • SECURITY_LEVEL: ALPHA
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
             <div className="flex flex-col items-end gap-1 px-8 border-r border-border/40 hidden xl:flex">
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.3em]">Operator Identity</span>
                <span className="text-sm font-black uppercase text-foreground italic tracking-widest">{user?.first_name} {user?.last_name}</span>
             </div>

             <div className="flex items-center gap-10">
               {activeShift ? (
                 <div className="flex items-center gap-6 px-8 py-4 bg-success/10 rounded-3xl border border-success/20 shadow-[0_0_40px_hsl(var(--success)/0.15)]">
                   <div className="w-3 h-3 rounded-full bg-success animate-pulse shadow-[0_0_15px_hsl(var(--success)/0.8)]" />
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-success tracking-widest leading-none mb-1.5">Shift Active</span>
                      <span className="text-xs font-black uppercase text-success/80 tracking-tighter italic">{activeShift.id.slice(-16).toUpperCase()}</span>
                   </div>
                 </div>
               ) : (
                 <div className="flex items-center gap-6 px-8 py-4 bg-destructive/10 rounded-3xl border border-destructive/20">
                   <div className="w-3 h-3 rounded-full bg-destructive shadow-[0_0_15px_hsl(var(--destructive)/0.8)]" />
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-destructive tracking-widest leading-none mb-1.5">Lockdown</span>
                      <span className="text-xs font-black uppercase text-destructive/80 tracking-tighter italic">RE-AUTH_REQUIRED</span>
                   </div>
                 </div>
               )}

               <Button 
                 variant="outline"
                 className="bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground h-20 px-12 rounded-[2rem] font-black italic gap-5 tracking-[0.3em] uppercase text-xs transition-all shadow-2xl hover:scale-105 active:scale-95"
                 onClick={logout}
               >
                 <Power className="w-6 h-6" />
                 Deactivate
               </Button>
             </div>
          </div>
        </div>

        {/* App Grid - Premium Tactical Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-10 pb-12">
          {(Array.isArray(visibleApps) ? visibleApps : []).map((app) => (
            <div 
              key={app.id} 
              className="group relative cursor-pointer"
              onClick={() => navigate(app.route)}
            >
              {/* Outer Glow Effect */}
              <div className={`absolute inset-0 ${app.bg} blur-[60px] opacity-0 group-hover:opacity-40 transition-opacity duration-700 rounded-full`} />
                             <GlassCard className="relative h-56 bg-card/40 border-border hover:border-primary/30 transition-all duration-500 overflow-hidden backdrop-blur-3xl rounded-[3rem] shadow-2xl flex flex-col group-hover:-translate-y-3 group-active:scale-95">
                <div className={`absolute top-0 right-0 w-32 h-32 ${app.bg} blur-3xl -mr-16 -mt-16 opacity-20 group-hover:scale-150 transition-transform duration-1000`} />
                
                <CardContent className="p-10 flex flex-col justify-between h-full relative z-10">
                  <div className="flex justify-between items-start">
                    <div className={`w-20 h-20 ${app.bg} rounded-[2rem] flex items-center justify-center ${app.color} group-hover:rotate-[15deg] transition-all duration-500 border border-border shadow-inner`}>
                      <app.icon className="w-10 h-10" />
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
                       <Maximize2 className="w-6 h-6 text-muted-foreground/20" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="font-black text-foreground text-3xl uppercase tracking-tighter italic group-hover:text-primary transition-colors">
                      {app.title}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.3em]">
                        {app.desc}
                      </span>
                      <div className="h-[1px] flex-1 bg-border/30" />
                    </div>
                  </div>
                </CardContent>
              </GlassCard>

            </div>
          ))}
        </div>

        {/* Footer Audit Trail */}
        <div className="mt-12 py-10 border-t border-border/10 flex flex-col md:flex-row justify-between items-center gap-6 opacity-30 group/footer transition-opacity hover:opacity-100">
          <p className="text-muted-foreground font-black italic tracking-[0.4em] text-[9px] uppercase flex items-center gap-4">
             <span className="w-10 h-[1px] bg-border/20" />
             Zenvix_Retail_Authority • GLOBAL_SYNC_V2
          </p>
          <div className="flex items-center gap-8">
             <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 italic">Integrity: VERIFIED</span>
             <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 italic">Latency: 14ms</span>
             <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 italic">Session: ACTIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RetailOperationalGateway;
