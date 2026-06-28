import { useState, useCallback, useEffect } from "react";
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { 
  Filter, 
  Plus, 
  MoreVertical, 
  Layout, 
  MousePointer2, 
  Target, 
  TrendingUp, 
  ArrowRight,
  Settings,
  Trash2,
  Copy,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  Zap,
  Layers,
  BarChart3,
  ChevronDown,
  Activity,
  History,
  Rocket,
  Search,
  RefreshCw,
  Box,
  Split,
  MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSession } from "@/core/security/session";
import { marketingService } from "@/core/services/marketing/marketingService";
import { EmptyState } from "@/components/shared/AsyncState";
import { cn } from "@/lib/utils";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import FunnelTemplates from "./components/FunnelTemplates";
import { toast } from "sonner";
import { CreateFunnelModal } from "./modals/CreateFunnelModal";
import { EditFunnelStepModal } from "./modals/EditFunnelStepModal";

interface FunnelStep {
  id: string;
  name: string;
  type: "landing" | "checkout" | "upsell" | "thankyou";
  conversionRate: number;
  isABTest?: boolean;
}

interface Funnel {
  id: string;
  name: string;
  steps: FunnelStep[];
  status: string;
}

function SortableStep({ step, index, onRemove, onEdit }: { step: FunnelStep; index: number; onRemove: (id: string) => void; onEdit: (step: FunnelStep) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("relative group pb-10", isDragging && "opacity-50")}>
        <div className="absolute -left-6 top-8 h-12 w-12 bg-white dark:bg-muted border-4 border-primary rounded-2xl flex items-center justify-center font-black text-xs shadow-2xl z-20 group-hover:scale-110 transition-transform italic">
           {index + 1}
        </div>
        <Card className={cn(
          "ml-6 rounded-[2rem] border-none shadow-2xl transition-all duration-500 cursor-default overflow-hidden glass-card relative",
          step.isABTest ? "ring-2 ring-indigo-500/40" : "hover:ring-2 hover:ring-indigo-500/20"
        )}>
           {step.isABTest && (
             <div className="absolute top-0 right-0 h-full w-2 bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500 animate-pulse" />
           )}
           <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                 <div className="flex items-center gap-6 flex-1" {...listeners} {...attributes}>
                    <div className={cn(
                      "h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-500",
                      step.type === 'landing' ? "bg-primary" :
                      step.type === 'checkout' ? "bg-success" :
                      step.type === 'upsell' ? "bg-warning" : "bg-primary"
                    )}>
                       {step.type === 'landing' && <Layout className="h-8 w-8 text-primary" />}
                       {step.type === 'checkout' && <MousePointer2 className="h-8 w-8 text-success" />}
                       {step.type === 'upsell' && <Zap className="h-8 w-8 text-warning" />}
                       {step.type === 'thankyou' && <Target className="h-8 w-8 text-primary" />}
                    </div>
                    <div className="space-y-1">
                       <div className="flex items-center gap-3">
                          <p className="font-black text-xl tracking-tighter uppercase italic">{step.name}</p>
                          {step.isABTest && <Badge className="bg-primary text-[9px] font-black h-5 px-3 rounded-full animate-pulse tracking-widest border-none">A/B TEST ACTIVE</Badge>}
                       </div>
                       <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.3em] leading-none">{step.type} NODE</p>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-12 w-full md:w-auto border-t md:border-t-0 md:border-l border-border dark:border-border pt-6 md:pt-0 md:pl-12">
                    <div className="text-right space-y-1">
                       <p className="text-[10px] uppercase font-black text-muted-foreground tracking-[0.2em] italic">Conversion Yield</p>
                       <div className="flex items-center justify-end gap-2">
                          <TrendingUp className="h-5 w-5 text-success" />
                          <span className="text-3xl font-black tracking-tighter text-muted-foreground dark:text-white">{step.conversionRate}%</span>
                       </div>
                    </div>
                    <div className="flex gap-3">
                       <Button variant="secondary" size="icon" className="h-12 w-12 rounded-2xl bg-white dark:bg-muted border-none shadow-md hover:scale-110 transition-all" onClick={() => onEdit(step)}><Settings className="h-5 w-5" /></Button>
                       <Button variant="secondary" size="icon" className="h-12 w-12 rounded-2xl bg-destructive dark:bg-destructive text-destructive border-none shadow-md hover:scale-110 transition-all" onClick={() => onRemove(step.id)}><Trash2 className="h-5 w-5" /></Button>
                    </div>
                 </div>
              </div>
           </CardContent>
        </Card>
        
        {/* Connector Line */}
        <div className="absolute left-[0.25rem] bottom-0 h-10 w-[2px] bg-primary group-last:hidden" />
    </div>
  );
}

export default function FunnelBuilderDesk() {
  const session = useSession();
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [selectedFunnel, setSelectedFunnel] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newFunnelOpen, setNewFunnelOpen] = useState(false);
  const [newFunnelName, setNewFunnelName] = useState("");
  
  // Step editing state
  const [editStepOpen, setEditStepOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<FunnelStep | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const refresh = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const f = await marketingService.listFunnels(session.tenant_id, session);
      setFunnels(f as any);
      if (f.length > 0 && !selectedFunnel) {
         setSelectedFunnel(f[0] as any);
      }
      if (isManual) toast.success("Orchestration registry synchronized.");
    } catch (err) {
      console.error("Failed to fetch funnels:", err);
      toast.error("Telemetry failure in funnel suite.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, selectedFunnel]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreateFunnel = async () => {
    if (!newFunnelName.trim()) {
      toast.error("Designation required for initialization.");
      return;
    }
    try {
      setRefreshing(true);
      const payload = {
        name: newFunnelName,
        status: "DRAFT",
        steps: [
          { id: `step-${Date.now()}`, name: "LANDING PROTOCOL", type: "landing", conversionRate: 100 }
        ]
      };
      const created = await marketingService.createFunnel(session.tenant_id, session, payload);
      setFunnels([...funnels, created]);
      setSelectedFunnel(created);
      setNewFunnelOpen(false);
      setNewFunnelName("");
      toast.success("Strategic Pathway Initialized", {
        description: "New conversion topology is ready for orchestration."
      });
      refresh(true);
    } catch (err) {
      console.error("Failed to create funnel:", err);
      toast.error("Orchestration initialization failure.");
      setRefreshing(false);
    }
  };

  const handleSave = async () => {
    if (!selectedFunnel) return;
    try {
      setRefreshing(true);
      await marketingService.updateFunnel(session.tenant_id, session, selectedFunnel.id, selectedFunnel);
      toast.success("Funnel Topology Synchronized", {
        description: "All tactical nodes and variations are now live in the global matrix."
      });
      refresh(true);
    } catch (err) {
      console.error("Failed to save funnel:", err);
      toast.error("Synchronization failure.");
      setRefreshing(false);
    }
  };

  const addStep = (type: FunnelStep["type"]) => {
    if (!selectedFunnel) return;
    const typeNames = { landing: "LANDING PROTOCOL", checkout: "TRANSACTION GATEWAY", upsell: "YIELD OPTIMIZER", thankyou: "CONVERSION SUCCESS" };
    const newStep: FunnelStep = {
      id: `step-${Date.now()}`,
      name: typeNames[type],
      type,
      conversionRate: 100
    };
    setSelectedFunnel({
      ...selectedFunnel,
      steps: [...selectedFunnel.steps, newStep]
    });
    toast.success(`${type.toUpperCase()} Node Integrated`, {
      description: "Added to tactical conversion topology."
    });
  };

  const removeStep = (id: string) => {
    if (!selectedFunnel) return;
    const newSteps = (Array.isArray(selectedFunnel.steps) ? selectedFunnel.steps : []).filter(s => s.id !== id);
    setSelectedFunnel({ ...selectedFunnel, steps: newSteps });
    toast.warning("Strategic Node Decommissioned.");
  };

  const updateStep = () => {
    if (!selectedFunnel || !editingStep) return;
    const newSteps = (Array.isArray(selectedFunnel.steps) ? selectedFunnel.steps : []).map(s => s.id === editingStep.id ? editingStep : s);
    setSelectedFunnel({ ...selectedFunnel, steps: newSteps });
    setEditStepOpen(false);
    setEditingStep(null);
    toast.success("Node Parameters Aligned.");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && selectedFunnel) {
      const oldIndex = selectedFunnel.steps.findIndex((s) => s.id === active.id);
      const newIndex = selectedFunnel.steps.findIndex((s) => s.id === over.id);
      const newSteps = arrayMove(selectedFunnel.steps, oldIndex, newIndex);
      setSelectedFunnel({ ...selectedFunnel, steps: newSteps });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted dark:bg-muted">
        <div className="flex flex-col items-center gap-6">
          <div className="h-20 w-20 bg-primary rounded-[2.5rem] animate-pulse flex items-center justify-center shadow-2xl shadow-indigo-500/20">
             <Layers className="h-10 w-10 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Booting Conversion Orchestrator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-1000 max-w-[1600px] mx-auto pb-24 h-screen overflow-hidden flex flex-col">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-end gap-6 shrink-0">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge className="bg-primary text-white border-none font-black px-3 py-1 rounded-full uppercase tracking-widest text-[10px]">Flow Automation</Badge>
            <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-widest">
               <Activity className="h-4 w-4 animate-pulse" />
               Orchestrator Online
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-foreground text-left">Funnel Builder</h1>
          <p className="text-muted-foreground font-medium max-w-2xl text-lg leading-relaxed italic text-left">"Architect multi-dimensional conversion pathways with elite precision."</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-muted0 dark:bg-muted backdrop-blur-xl p-2 rounded-[2rem] border border-border dark:border-border/20 shadow-2xl">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" className="h-14 px-8 rounded-2xl font-black text-[10px] uppercase tracking-widest gap-3 transition-all hover:bg-white dark:hover:bg-muted">
                  <Layers className="h-5 w-5 text-primary" /> ARCHIVE TEMPLATES
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white dark:bg-muted">
                 <div className="h-2 bg-primary" />
                 <div className="p-12 space-y-10">
                    <DialogHeader>
                       <DialogTitle className="text-4xl font-black tracking-tighter uppercase italic">Strategic Topology Archive</DialogTitle>
                       <DialogDescription className="text-base font-medium italic">Select a proven conversion architecture to initialize your strategic pathway.</DialogDescription>
                    </DialogHeader>
                    <FunnelTemplates onSelect={(id) => {
                       toast.success(`Protocol ${id} Applied`, { description: "Topology has been updated with template nodes." });
                    }} />
                 </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="secondary"
              className="h-14 w-14 rounded-2xl bg-primary text-white hover:bg-primary transition-all shadow-xl shadow-indigo-500/20"
              onClick={() => refresh(true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-6 w-6", refreshing && "animate-spin")} />
            </Button>
          </div>
          <Button 
            className="h-[4.5rem] px-10 rounded-[2rem] bg-primary hover:bg-primary shadow-2xl shadow-indigo-500/30 font-black text-sm gap-3 group transition-all hover:scale-105 active:scale-95"
            onClick={() => setNewFunnelOpen(true)}
          >
            <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" /> 
            INITIALIZE PATHWAY
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-10 flex-1 min-h-0">
        {/* Left: Registry */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-6 overflow-hidden">
          <Card className="flex-1 rounded-[3rem] border-none shadow-2xl glass-card overflow-hidden flex flex-col">
            <CardHeader className="p-8 pb-4 border-b border-border dark:border-border/10">
               <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">Path Registry</p>
                  <Badge variant="outline" className="rounded-full font-black text-[9px] px-2 py-0 h-5 border-border dark:border-border text-muted-foreground uppercase tracking-widest">{funnels.length} FLOWS</Badge>
               </div>
            </CardHeader>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {(Array.isArray(funnels) ? funnels : []).map(f => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFunnel(f)}
                    className={cn(
                      "w-full flex items-center gap-4 p-5 rounded-[1.5rem] text-left transition-all duration-300 group relative overflow-hidden",
                      selectedFunnel?.id === f.id 
                        ? "bg-white dark:bg-muted shadow-xl shadow-indigo-500/10 translate-x-2" 
                        : "hover:bg-muted0 dark:hover:bg-muted hover:translate-x-1"
                    )}
                  >
                    {selectedFunnel?.id === f.id && (
                      <div className="absolute left-0 top-0 h-full w-1.5 bg-primary" />
                    )}
                    <div className={cn(
                      "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-md group-hover:scale-110 transition-transform",
                      selectedFunnel?.id === f.id ? "bg-primary text-white shadow-indigo-500/20" : "bg-muted dark:bg-muted text-muted-foreground"
                    )}>
                       <Layers className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-black uppercase tracking-tight group-hover:text-primary transition-colors italic truncate">{f.name}</p>
                      <div className="flex items-center gap-3">
                         <Badge className="bg-muted dark:bg-muted text-[8px] font-black px-2 py-0 h-4 border-none text-muted-foreground uppercase tracking-widest">{f.status}</Badge>
                         <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{f.steps?.length || 0} NODES</span>
                      </div>
                    </div>
                    <ChevronRight className={cn("h-4 w-4 transition-transform", selectedFunnel?.id === f.id ? "text-primary translate-x-1" : "text-muted-foreground")} />
                  </button>
                ))}
                {(Array.isArray(funnels) ? funnels : []).length === 0 && (
                  <EmptyState
                    title="No funnels yet"
                    description="No conversion pathways exist in this tenant scope yet."
                    icon={Layers}
                  />
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Center: Builder Canvas */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-6 overflow-hidden">
           {selectedFunnel ? (
              <div className="h-full flex flex-col gap-6">
                 <Card className="shrink-0 rounded-[2.5rem] border-none bg-primary shadow-2xl p-1 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 h-64 w-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 group-hover:scale-150 transition-transform duration-1000" />
                    <CardContent className="p-8 flex items-center justify-between text-white relative z-10">
                        <div className="flex items-center gap-6">
                           <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shadow-xl border border-border">
                              <Activity className="h-8 w-8 text-white" />
                           </div>
                           <div className="space-y-1">
                              <h2 className="text-3xl font-black tracking-tighter uppercase italic">{selectedFunnel.name}</h2>
                              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest opacity-60">
                                 <span className="flex items-center gap-2"><ExternalLink className="h-4 w-4" /> NODE /f/{selectedFunnel.id}</span>
                                 <span className="flex items-center gap-2 text-success"><CheckCircle2 className="h-4 w-4" /> TOPOLOGY SECURE</span>
                              </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-4">
                           <Button 
                             className="bg-white text-primary hover:bg-muted font-black rounded-2xl h-14 px-8 shadow-2xl text-[10px] uppercase tracking-widest gap-3"
                             onClick={handleSave}
                             disabled={refreshing}
                           >
                             {refreshing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                             SYNC MATRIX
                           </Button>
                        </div>
                    </CardContent>
                 </Card>

                 <Card className="flex-1 rounded-[4rem] border-none shadow-2xl glass-card overflow-hidden relative">
                    <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07] pointer-events-none" 
                         style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                    <ScrollArea className="h-full">
                       <div className="p-16 relative z-10">
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={(Array.isArray(selectedFunnel.steps) ? selectedFunnel.steps : []).map(s => s.id)} strategy={verticalListSortingStrategy}>
                               <div className="max-w-2xl mx-auto">
                                  {(Array.isArray(selectedFunnel.steps) ? selectedFunnel.steps : []).map((step, idx) => (
                                    <SortableStep 
                                     key={step.id} 
                                     step={step} 
                                     index={idx} 
                                     onRemove={removeStep} 
                                     onEdit={(s) => {
                                       setEditingStep(s);
                                       setEditStepOpen(true);
                                     }}
                                    />
                                  ))}
                                  
                                  <div className="pt-4 flex justify-center">
                                    <DropdownMenu>
                                       <DropdownMenuTrigger asChild>
                                         <Button variant="outline" className="w-full h-40 rounded-[3rem] border-4 border-dashed border-border dark:border-border bg-transparent flex flex-col gap-4 hover:bg-white dark:hover:bg-muted hover:border-primary hover:text-primary transition-all group shadow-inner">
                                            <div className="h-16 w-16 rounded-full bg-muted dark:bg-muted flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-md">
                                              <Plus className="h-8 w-8 group-hover:rotate-90 transition-transform duration-500" />
                                            </div>
                                            <span className="font-black text-[10px] uppercase tracking-[0.3em]">Integrate Strategic Node</span>
                                         </Button>
                                       </DropdownMenuTrigger>
                                       <DropdownMenuContent className="w-72 rounded-[2rem] p-3 shadow-2xl border-none" align="center">
                                          <DropdownMenuLabel className="font-black text-[10px] uppercase tracking-widest opacity-50 px-3 py-2">Node Selection Protocol</DropdownMenuLabel>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem className="gap-4 py-4 rounded-2xl font-bold" onClick={() => addStep('landing')}><Layout className="h-5 w-5 text-primary" /> Landing Protocol</DropdownMenuItem>
                                          <DropdownMenuItem className="gap-4 py-4 rounded-2xl font-bold" onClick={() => addStep('checkout')}><MousePointer2 className="h-5 w-5 text-success" /> Transaction Gateway</DropdownMenuItem>
                                          <DropdownMenuItem className="gap-4 py-4 rounded-2xl font-bold" onClick={() => addStep('upsell')}><Zap className="h-5 w-5 text-warning" /> Yield Optimizer</DropdownMenuItem>
                                          <DropdownMenuItem className="gap-4 py-4 rounded-2xl font-bold" onClick={() => addStep('thankyou')}><Target className="h-5 w-5 text-primary" /> Conversion Success</DropdownMenuItem>
                                       </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                               </div>
                            </SortableContext>
                          </DndContext>
                       </div>
                    </ScrollArea>
                 </Card>
              </div>
           ) : (
              <div className="h-full flex flex-col items-center justify-center rounded-[4rem] border-2 border-dashed border-border dark:border-border/20 bg-white/10 dark:bg-muted grayscale opacity-30 space-y-10 animate-in zoom-in duration-1000">
                 <div className="relative">
                    <div className="absolute inset-0 bg-primary blur-3xl rounded-full scale-150 animate-pulse" />
                    <div className="relative h-40 w-40 bg-white dark:bg-muted rounded-[2.5rem] flex items-center justify-center shadow-2xl border border-border">
                       <Layers className="h-20 w-20 text-primary" />
                    </div>
                 </div>
                 <div className="text-center space-y-4">
                   <h3 className="text-4xl font-black uppercase tracking-tighter italic">Workspace Inactive</h3>
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground max-w-[350px] mx-auto leading-relaxed italic italic">Select a conversion pathway from the registry to authorize total intelligence synchronization.</p>
                 </div>
                 <Button 
                   className="h-16 px-10 rounded-2xl bg-primary hover:bg-primary shadow-2xl font-black text-xs gap-3 group transition-all hover:scale-105 active:scale-95 text-white"
                   onClick={() => setNewFunnelOpen(true)}
                 >
                   <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" /> INITIALIZE NEW PATHWAY
                 </Button>
              </div>
           )}
        </div>

        {/* Right: Insights & Analytics */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-10 overflow-hidden">
           <Card className="rounded-[3rem] border-none shadow-2xl glass-card overflow-hidden flex flex-col">
              <CardHeader className="p-8 pb-4 border-b border-border dark:border-border/10">
                 <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                       <BarChart3 className="h-6 w-6 text-primary" />
                       Intelligence
                    </CardTitle>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Live Yield</p>
                 </div>
              </CardHeader>
              <CardContent className="p-8 space-y-10">
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2 p-5 rounded-[1.5rem] bg-muted0 dark:bg-muted shadow-sm border border-border group hover:shadow-md transition-all">
                       <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest italic leading-none block mb-1">Global Traffic</span>
                       <p className="text-2xl font-black tracking-tighter group-hover:text-primary transition-colors">12.4k</p>
                    </div>
                    <div className="space-y-2 p-5 rounded-[1.5rem] bg-muted0 dark:bg-muted shadow-sm border border-border group hover:shadow-md transition-all">
                       <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest italic leading-none block mb-1">Conversions</span>
                       <p className="text-2xl font-black tracking-tighter text-primary">842</p>
                    </div>
                 </div>

                 <div className="p-8 rounded-[2rem] bg-primary text-white shadow-2xl shadow-indigo-600/30 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 h-32 w-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000" />
                    <div className="relative z-10 flex justify-between items-center mb-4">
                       <span className="text-[10px] font-black uppercase tracking-widest opacity-60 italic">Strategic ROI Yield</span>
                       <TrendingUp className="h-5 w-5 text-success" />
                    </div>
                    <div className="relative z-10 flex items-baseline gap-3">
                       <span className="text-5xl font-black tracking-tighter">6.74%</span>
                       <Badge className="bg-success text-success border-none text-[9px] font-black h-5 px-2">+1.2%</Badge>
                    </div>
                 </div>

                 <div className="space-y-8">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] flex items-center gap-3 italic">
                       <History className="h-4 w-4 text-primary" /> Depletion Analysis
                    </p>
                    <div className="space-y-8">
                       {selectedFunnel?.steps.slice(0, -1).map((step, i) => (
                          <div key={step.id} className="space-y-3 group/bar">
                             <div className="flex justify-between text-[10px] font-black uppercase tracking-tight">
                                <span className="text-muted-foreground italic">NODE {i+1} → {i+2}</span>
                                <span className="text-destructive">-{100 - step.conversionRate}% DEPLETION</span>
                             </div>
                             <div className="h-3 w-full bg-muted dark:bg-muted rounded-full overflow-hidden shadow-inner group-hover/bar:shadow-md transition-all">
                                <div className="h-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${step.conversionRate}%` }} />
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
              </CardContent>
           </Card>

           <Card className="rounded-[2.5rem] border-none shadow-2xl bg-primary text-white p-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 h-32 w-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000" />
              <div className="relative z-10 space-y-6">
                 <div className="flex items-center gap-3">
                    <Rocket className="h-5 w-5 text-warning animate-bounce" />
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Neural Advisory</p>
                 </div>
                 <p className="text-xs font-medium italic italic leading-relaxed opacity-80">
                    "Variation B of the <strong>Transaction Gateway</strong> is outperforming Variation A by <strong>+14.7%</strong> in mobile sessions. Action: Scale B traffic."
                 </p>
                 <Button variant="link" className="text-[9px] font-black uppercase tracking-widest h-auto p-0 text-warning hover:text-white transition-colors">EXPAND ARCHIVE DATA</Button>
              </div>
           </Card>
        </div>
      </div>

      {/* Create Funnel Modal */}
      <CreateFunnelModal
        isOpen={newFunnelOpen}
        onClose={() => setNewFunnelOpen(false)}
        onSuccess={() => refresh(true)}
      />

      {/* Edit Funnel Step Modal */}
      <EditFunnelStepModal
        isOpen={editStepOpen}
        onClose={() => { setEditStepOpen(false); setEditingStep(null); }}
        step={editingStep}
        onSave={(data) => {
          if (!selectedFunnel || !editingStep) return;
          const newSteps = (Array.isArray(selectedFunnel.steps) ? selectedFunnel.steps : []).map(s =>
            s.id === editingStep.id ? { ...s, ...data } : s
          );
          setSelectedFunnel({ ...selectedFunnel, steps: newSteps });
        }}
      />
    </div>
  );
}
