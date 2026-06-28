import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Video, 
  MapPin, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Check,
  Activity,
  CalendarDays,
  Target,
  ArrowUpRight,
  Search,
  RefreshCw,
  Zap,
  Layers,
  ArrowRight,
  ActivitySquare,
  Network,
  Cpu,
  Monitor,
  Box,
  Fingerprint,
  PieChart,
  BarChart4,
  Clock3,
  CalendarCheck2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/core/security/session";
import { marketingService } from "@/core/services/marketing/marketingService";
import { formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/shared/AsyncState";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreateAppointmentModal } from "./modals/CreateAppointmentModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AppointmentDesk() {
  const session = useSession();
  const [view, setView] = useState<"calendar" | "list">("list");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // New Appointment State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [newApt, setNewApt] = useState({
    contact_id: "",
    title: "",
    scheduled_at: "",
    notes: ""
  });

  const loadAppointments = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const data = await marketingService.listAppointments(session.tenant_id, session);
      setAppointments(data);
      if (isManual) toast.success("Scheduling cluster synchronized.");
    } catch (err) {
      console.error("Failed to load appointments:", err);
      toast.error("Telemetry failure in scheduling engine.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, session]);

  const loadContacts = async () => {
    try {
      setLoadingContacts(true);
      const data = await marketingService.listContacts(session.tenant_id, session);
      setContacts(data);
    } catch (err) {
      console.error("Failed to load contacts:", err);
      toast.error("Contact cluster offline.");
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const handleCreateAppointment = async () => {
    if (!newApt.contact_id || !newApt.scheduled_at) {
      toast.error("Engagement coordinates required.");
      return;
    }
    try {
      setRefreshing(true);
      await marketingService.createAppointment(session.tenant_id, session, newApt);
      setIsModalOpen(false);
      setNewApt({ contact_id: "", title: "", scheduled_at: "", notes: "" });
      toast.success("Strategic Appointment Authorized", {
        description: "Coordination protocol has been injected into the engagement grid."
      });
      loadAppointments(true);
    } catch (err) {
      toast.error("Booking protocol failure.");
      setRefreshing(false);
    }
  };

  const getInitials = (name: string) => {
    return (name || "??").split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const todayApts = useMemo(() => {
    const today = new Date().toDateString();
    return (Array.isArray(appointments) ? appointments : []).filter(a => new Date(a.scheduled_at).toDateString() === today);
  }, [appointments]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted dark:bg-muted">
        <div className="flex flex-col items-center gap-6">
          <div className="h-20 w-20 bg-primary rounded-[2.5rem] animate-pulse flex items-center justify-center shadow-2xl shadow-indigo-500/20">
            <CalendarDays className="h-10 w-10 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Synchronizing Scheduling Grid...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-1000 max-w-[1600px] mx-auto pb-24 text-left">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-end gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge className="bg-primary text-white border-none font-black px-3 py-1 rounded-full uppercase tracking-widest text-[10px]">Engagement Scheduling</Badge>
            <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-widest">
               <ActivitySquare className="h-4 w-4 animate-pulse" />
               Scheduling Matrix Active
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-foreground italic leading-none">Scheduler</h1>
          <p className="text-muted-foreground font-medium max-w-2xl text-lg leading-relaxed italic">"Time authorizes the total orchestration of relationship nodes; coordinate it with absolute tactical precision."</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-muted0 dark:bg-muted backdrop-blur-xl p-2 rounded-[2rem] border border-border dark:border-border/20 shadow-2xl">
            <div className="flex bg-muted dark:bg-muted p-1.5 rounded-2xl shadow-inner mr-2 h-auto">
               <Button 
                  variant="ghost" 
                  className={cn("h-11 rounded-xl px-8 font-black text-[10px] uppercase tracking-widest transition-all italic", view === "calendar" ? "bg-white dark:bg-muted shadow-xl text-primary" : "text-muted-foreground")}
                  onClick={() => setView("calendar")}
               >
                  CALENDAR
               </Button>
               <Button 
                  variant="ghost" 
                  className={cn("h-11 rounded-xl px-8 font-black text-[10px] uppercase tracking-widest transition-all italic", view === "list" ? "bg-white dark:bg-muted shadow-xl text-primary" : "text-muted-foreground")}
                  onClick={() => setView("list")}
               >
                  LIST VIEW
               </Button>
            </div>
            <Button
              variant="secondary"
              className="h-14 w-14 rounded-2xl bg-white dark:bg-muted border-none shadow-xl hover:scale-110 transition-all"
              onClick={() => loadAppointments(true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-6 w-6 text-primary", refreshing && "animate-spin")} />
            </Button>
          </div>
          <Dialog open={isModalOpen} onOpenChange={(open) => {
            setIsModalOpen(open);
            if (open) loadContacts();
          }}>
            <DialogTrigger asChild>
              <Button className="h-[4.5rem] px-10 rounded-[2rem] bg-primary hover:bg-primary shadow-2xl shadow-indigo-500/30 font-black text-sm gap-3 group transition-all hover:scale-105 active:scale-95 text-white">
                <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" /> 
                AUTHORIZE APPOINTMENT
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px] border-none bg-white dark:bg-muted p-0 overflow-hidden shadow-2xl rounded-[3rem]">
               <div className="h-2 bg-primary shadow-[0_0_15px_rgba(79,70,229,0.5)]" />
               <div className="p-12 space-y-10">
                  <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                       <Badge className="bg-primary text-white font-black text-[10px] uppercase tracking-widest">Protocol SIGMA</Badge>
                       <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Scheduling Authorization</p>
                    </div>
                    <DialogTitle className="text-4xl font-black tracking-tighter uppercase italic leading-none">Schedule Engagement</DialogTitle>
                    <DialogDescription className="text-base font-medium italic italic leading-relaxed italic">Coordinate a new strategic meeting with a validated relationship node.</DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-8 py-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Target Relationship Node</Label>
                      <Select onValueChange={(val) => setNewApt({...newApt, contact_id: val})}>
                        <SelectTrigger className="h-16 rounded-2xl bg-muted dark:bg-muted border-none shadow-inner font-bold text-lg italic">
                          <SelectValue placeholder={loadingContacts ? "Synchronizing contacts..." : "SELECT TARGET NODE"} />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                          {(Array.isArray(contacts) ? contacts : []).map(c => (
                            <SelectItem key={c.id} value={c.id} className="font-bold py-3 rounded-xl italic">
                              {c.first_name} {c.last_name} — {c.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Temporal Coordinates (Time)</Label>
                      <Input 
                        type="datetime-local" 
                        className="h-16 rounded-2xl bg-muted dark:bg-muted border-none shadow-inner font-black text-lg text-primary italic px-6"
                        onChange={(e) => setNewApt({...newApt, scheduled_at: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Operational Context</Label>
                      <Input 
                        className="h-16 rounded-2xl bg-muted dark:bg-muted border-none shadow-inner font-bold text-lg italic px-6"
                        placeholder="E.G. ENTERPRISE Q4 DISCOVERY SESSION"
                        onChange={(e) => setNewApt({...newApt, notes: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <DialogFooter className="pt-6">
                    <Button 
                       className="w-full h-20 rounded-[2.5rem] bg-primary hover:bg-primary font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-500/30 gap-4 transition-all hover:scale-105 active:scale-95 text-white" 
                       onClick={handleCreateAppointment} 
                       disabled={!newApt.contact_id || !newApt.scheduled_at || refreshing}
                    >
                      {refreshing ? <><RefreshCw className="h-6 w-6 animate-spin" /> AUTHORIZING...</> : <><CalendarCheck2 className="h-6 w-6" /> CONFIRM BOOKING</>}
                    </Button>
                  </DialogFooter>
               </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-10 flex-1 min-h-0">
        {/* Main Grid Area */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-10 overflow-hidden">
          {view === "calendar" ? (
            <Card className="flex-1 rounded-[4rem] border-none shadow-2xl glass-card overflow-hidden flex flex-col min-h-[700px] group/calendar">
              <CardHeader className="p-12 pb-6 border-b border-border dark:border-border/10 shrink-0">
                <div className="flex items-center justify-between">
                   <div className="space-y-2">
                      <h2 className="text-4xl font-black tracking-tighter uppercase italic leading-none">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground italic">Global Engagement Matrix</p>
                   </div>
                   <div className="flex gap-4">
                     <Button variant="outline" size="icon" className="h-14 w-14 rounded-2xl bg-white dark:bg-muted border-none shadow-xl hover:scale-110 transition-all"><ChevronLeft className="h-6 w-6" /></Button>
                     <Button variant="outline" size="icon" className="h-14 w-14 rounded-2xl bg-white dark:bg-muted border-none shadow-xl hover:scale-110 transition-all"><ChevronRight className="h-6 w-6" /></Button>
                     <Button className="h-14 rounded-2xl px-10 bg-muted text-white dark:bg-white dark:text-muted-foreground font-black text-[10px] uppercase tracking-widest border-none shadow-2xl hover:scale-105 transition-all">TODAY</Button>
                   </div>
                </div>
              </CardHeader>
              <div className="flex-1 flex flex-col items-center justify-center text-center p-32 grayscale opacity-20 space-y-8">
                 <div className="h-24 w-24 bg-white dark:bg-muted rounded-[3rem] flex items-center justify-center shadow-2xl border border-border dark:border-border group-hover/calendar:rotate-12 transition-all duration-700">
                    <CalendarDays className="h-12 w-12 text-muted-foreground" />
                 </div>
                 <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">Neural Mapping Active</p>
                    <p className="text-sm font-medium italic italic opacity-40">"Calendar synchronization protocol active; pending ingestion. Authorize LIST VIEW for immediate tactical action."</p>
                 </div>
              </div>
            </Card>
          ) : (
            <Card className="flex-1 rounded-[4rem] border-none shadow-2xl glass-card overflow-hidden flex flex-col group/registry">
              <CardHeader className="p-12 pb-6 border-b border-border dark:border-border/10 shrink-0">
                 <div className="flex items-center justify-between">
                    <div className="space-y-2">
                       <CardTitle className="text-3xl font-black tracking-tighter flex items-center gap-4 uppercase italic">
                          <Layers className="h-8 w-8 text-primary group-hover/registry:rotate-12 transition-transform duration-500" />
                          Engagement Stack
                       </CardTitle>
                       <CardDescription className="text-base font-medium italic italic opacity-60">Chronological list of tactical relationship synchronization events.</CardDescription>
                    </div>
                    <Badge className="rounded-full font-black text-[10px] px-4 py-1.5 bg-primary text-white shadow-lg shadow-indigo-600/20 uppercase tracking-widest">{appointments.length} EVENTS</Badge>
                 </div>
              </CardHeader>
              <ScrollArea className="flex-1 bg-black/5 dark:bg-muted">
                {appointments.length === 0 ? (
                  <EmptyState
                    title="Stack empty"
                    description="No strategic engagements currently authorized in the scheduling matrix."
                    icon={CalendarIcon}
                  />
                ) : (
                  <div className="p-0 divide-y divide-border dark:divide-slate-800/5">
                    {(Array.isArray(appointments) ? appointments : []).map((apt) => (
                      <div key={apt.id} className="flex items-center justify-between p-10 hover:bg-primary transition-all group cursor-default">
                          <div className="flex items-center gap-8">
                             <div className="relative">
                                <Avatar className="h-16 w-16 rounded-2xl ring-4 ring-white dark:ring-slate-900 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                                  <AvatarFallback className="bg-primary text-white text-sm font-black italic shadow-inner">
                                    {getInitials(apt.contact_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className={cn(
                                  "absolute -bottom-1 -right-1 h-5 w-5 rounded-lg border-4 border-white dark:border-border shadow-lg",
                                  apt.status === 'SCHEDULED' ? "bg-primary animate-pulse" : "bg-success"
                                )} />
                             </div>
                             <div className="space-y-2">
                               <p className="font-black text-2xl uppercase tracking-tighter group-hover:text-primary transition-colors italic leading-none">"{apt.notes || "Strategic Sync Protocol"}"</p>
                               <div className="flex flex-wrap items-center gap-6">
                                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">
                                     <User className="h-3.5 w-3.5 text-primary" />
                                     {apt.contact_name || "PRINCIPAL NODE"}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary italic">
                                     <Clock3 className="h-3.5 w-3.5" />
                                     {formatDateTime(apt.scheduled_at)}
                                  </div>
                               </div>
                             </div>
                          </div>
                          <div className="flex items-center gap-8">
                             <Badge className={cn(
                               "rounded-full font-black text-[9px] px-5 py-2 border-none shadow-xl uppercase tracking-widest italic transition-all",
                               apt.status === 'SCHEDULED' ? "bg-primary text-white shadow-indigo-600/20" : "bg-success text-white shadow-emerald-500/20"
                             )}>
                               {apt.status}
                             </Badge>
                             <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl hover:bg-white dark:hover:bg-muted shadow-sm transition-all text-muted-foreground"><MoreHorizontal className="h-6 w-6" /></Button>
                          </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </Card>
          )}
        </div>

        {/* Sidebar Intelligence */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-10">
           <Card className="rounded-[4rem] border-none shadow-2xl glass-card overflow-hidden flex flex-col group/horizon">
             <CardHeader className="p-10 pb-4 border-b border-border dark:border-border/10">
                <div className="flex items-center justify-between mb-2">
                   <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground italic">Temporal Grid</p>
                      <CardTitle className="text-2xl font-black uppercase tracking-tighter italic leading-none">Today's Horizon</CardTitle>
                   </div>
                   <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center group-hover/horizon:rotate-12 transition-transform">
                      <Target className="h-6 w-6 text-primary" />
                   </div>
                </div>
                <CardDescription className="text-base font-medium italic italic opacity-60">Strategic focus nodes for the current cycle.</CardDescription>
             </CardHeader>
             <CardContent className="p-10 pt-6 space-y-8">
                {todayApts.length === 0 ? (
                  <div className="text-center py-16 space-y-6 grayscale opacity-20 flex flex-col items-center">
                    <div className="h-20 w-20 bg-white dark:bg-muted rounded-[2rem] flex items-center justify-center shadow-2xl border border-border dark:border-border">
                       <ActivitySquare className="h-10 w-10 text-muted-foreground animate-pulse" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">Clear Horizon</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {todayApts.slice(0, 3).map(apt => (
                      <div key={apt.id} className="flex gap-6 p-6 rounded-[2.5rem] bg-muted0 dark:bg-muted hover:bg-primary transition-all group/item cursor-default relative overflow-hidden border border-border">
                         <div className="absolute top-0 right-0 h-24 w-24 bg-primary rounded-full -mr-12 -mt-12 group-hover/item:scale-150 transition-transform duration-[1500ms]" />
                         <div className="h-16 w-16 shrink-0 rounded-2xl bg-primary text-white flex flex-col items-center justify-center shadow-2xl relative z-10 group-hover/item:scale-110 transition-transform">
                            <span className="text-[10px] uppercase font-black leading-none opacity-60">
                              {new Date(apt.scheduled_at).toLocaleString('default', { month: 'short' })}
                            </span>
                            <span className="text-3xl font-black leading-none tracking-tighter">
                              {new Date(apt.scheduled_at).getDate()}
                            </span>
                         </div>
                         <div className="flex-1 min-w-0 relative z-10 space-y-2 py-1">
                            <p className="text-base font-black uppercase tracking-tighter truncate group-hover/item:text-primary transition-colors italic leading-none">"{apt.notes || "Sync Protocol"}"</p>
                            <div className="flex items-center gap-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest italic opacity-60">
                               <Clock3 className="h-4 w-4 text-primary" />
                               {new Date(apt.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button 
                   variant="outline" 
                   className="w-full h-16 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest border-border dark:border-border hover:bg-primary hover:text-white hover:border-primary transition-all gap-4 shadow-xl group/btn" 
                   onClick={() => setView("list")}
                >
                   VIEW FULL GRID <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-2 transition-transform" />
                </Button>
             </CardContent>
           </Card>

           <Card className="rounded-[4rem] border-none shadow-2xl bg-primary text-white p-12 relative overflow-hidden group">
              <div className="absolute top-0 right-0 h-48 w-48 bg-primary rounded-full blur-[80px] -mr-24 -mt-24 group-hover:scale-150 transition-transform duration-[2000ms]" />
              <div className="relative z-10 space-y-10">
                 <div className="flex items-center justify-between">
                    <p className="text-[12px] font-black uppercase tracking-[0.4em] opacity-40 italic">Operational Yield</p>
                    <ArrowUpRight className="h-6 w-6 text-primary" />
                 </div>
                 <div className="space-y-8">
                    <div className="flex justify-between items-end border-b border-border pb-6">
                       <p className="text-sm font-black uppercase tracking-widest opacity-40 italic">Active Bookings</p>
                       <p className="text-5xl font-black tracking-tighter italic">{(Array.isArray(appointments) ? appointments : []).filter(a => a.status === 'SCHEDULED').length}</p>
                    </div>
                    <div className="flex justify-between items-end">
                       <p className="text-sm font-black uppercase tracking-widest opacity-40 italic">Completed Protocols</p>
                       <p className="text-5xl font-black tracking-tighter text-success italic">{(Array.isArray(appointments) ? appointments : []).filter(a => a.status === 'COMPLETED').length}</p>
                    </div>
                 </div>
                 <div className="h-3 w-full bg-muted rounded-full overflow-hidden shadow-inner p-0.5">
                    <div className="h-full bg-white rounded-full transition-all duration-[2000ms] shadow-[0_0_20px_rgba(255,255,255,0.5)]" style={{ width: '75%' }} />
                 </div>
              </div>
           </Card>
        </div>
      </div>
    </div>
  );
}
