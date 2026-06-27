import { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  ChevronRight, 
  Zap, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  ArrowUpRight,
  BrainCircuit,
  Target,
  DollarSign
} from "lucide-react";
import { PageShell } from "@/core/ui/PageShell";
import { PageHeader } from "@/core/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StrategyRecommendation {
  id: string;
  type: "REALLOCATION" | "OPTIMIZATION" | "SCALING";
  title: string;
  description: string;
  impact: string;
  confidence: number;
  status: "PENDING" | "AUTHORIZED" | "REJECTED";
}

export default function StrategyControlDesk() {
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<StrategyRecommendation[]>([]);

  useEffect(() => {
    // Simulated ingestion of AI recommendations
    setTimeout(() => {
      setRecommendations([
        {
          id: "STR-001",
          type: "REALLOCATION",
          title: "High-Intent Meta Reallocation",
          description: "Shift 15% of budget from low-performing LinkedIn nodes to High-Intent Meta Ads for Q4 retail push.",
          impact: "+Rp 675jt Est. Revenue",
          confidence: 94,
          status: "PENDING"
        },
        {
          id: "STR-002",
          type: "OPTIMIZATION",
          title: "Neural Copy Adjustment",
          description: "Authorize AI to auto-tune email subject lines based on real-time open rate telemetry.",
          impact: "+12% Open Rate",
          confidence: 88,
          status: "PENDING"
        },
        {
          id: "STR-003",
          type: "SCALING",
          title: "Scale Enterprise Lead Gen",
          description: "Increase daily spend by 20% on 'Cloud Solutions' cluster following 4.2x ROI confirmation.",
          impact: "+25 MQLs / Week",
          confidence: 91,
          status: "PENDING"
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const handleAction = (id: string, action: "AUTHORIZED" | "REJECTED") => {
    setRecommendations(prev => prev.map(rec => 
      rec.id === id ? { ...rec, status: action } : rec
    ));
    
    if (action === "AUTHORIZED") {
      toast.success("Strategy Protocol Authorized", {
        description: "Executing tactical reallocation across marketing nodes."
      });
    } else {
      toast.info("Strategy Protocol Rejected", {
        description: "Recommendation archived for further analysis."
      });
    }
  };

  return (
    <PageShell
      header={
        <PageHeader
          title="Strategy Control Desk"
          subtitle="AI-driven tactical orchestration and budget governance."
          primaryAction={
            <div className="flex items-center gap-2 bg-success border border-success/20 px-4 py-2 rounded-xl">
              <ShieldCheck className="h-4 w-4 text-success" />
              <span className="text-[10px] font-black uppercase tracking-widest text-success italic">Governance Active</span>
            </div>
          }
        />
      }
    >
      <div className="space-y-12 pb-24">
        {/* KPI Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="glass-card p-8 rounded-[2.5rem] card-premium">
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <Badge className="bg-primary/10 text-primary border-none">AI ENGINE</Badge>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Neural Confidence</p>
            <h3 className="text-4xl font-black italic tracking-tighter">91.4%</h3>
          </Card>
          
          <Card className="glass-card p-8 rounded-[2.5rem] card-premium">
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 rounded-2xl bg-success flex items-center justify-center text-success">
                <DollarSign className="h-6 w-6" />
              </div>
              <Badge className="bg-success text-success border-none">TIGHTER ROI</Badge>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Potential Yield</p>
            <h3 className="text-4xl font-black italic tracking-tighter">+Rp 1.87M</h3>
          </Card>

          <Card className="glass-card p-8 rounded-[2.5rem] card-premium">
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 rounded-2xl bg-warning flex items-center justify-center text-warning">
                <Target className="h-6 w-6" />
              </div>
              <Badge className="bg-warning text-warning border-none">SLA COMPLIANT</Badge>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Strategic Goal</p>
            <h3 className="text-4xl font-black italic tracking-tighter">MAX GROWTH</h3>
          </Card>
        </div>

        {/* Recommendations Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
          <Card className="glass-card p-10 rounded-[4rem] border-none shadow-2xl xl:col-span-2">
            <div className="flex items-center justify-between mb-12">
              <div className="space-y-2">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-4">
                  <Zap className="h-8 w-8 text-warning" />
                  Tactical Recommendations
                </h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
                  Review and authorize real-time strategy adjustments
                </p>
              </div>
              <Button variant="outline" className="rounded-2xl h-12 px-6 font-black text-[10px] uppercase tracking-widest border-border hover:bg-secondary">
                ARCHIVE LOGS
              </Button>
            </div>

            <div className="space-y-6">
              {recommendations.map((rec) => (
                <div 
                  key={rec.id} 
                  className={cn(
                    "group p-8 rounded-[3rem] border transition-all duration-500",
                    rec.status === "PENDING" 
                      ? "bg-secondary/30 border-border hover:border-primary/50" 
                      : rec.status === "AUTHORIZED"
                      ? "bg-success border-success/20"
                      : "bg-destructive border-destructive/20 opacity-60"
                  )}
                >
                  <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex items-start gap-6">
                      <div className={cn(
                        "h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-transform duration-500 group-hover:rotate-12",
                        rec.type === "REALLOCATION" ? "bg-primary text-white" : "bg-primary/20 text-primary"
                      )}>
                        <TrendingUp className="h-7 w-7" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h4 className="text-xl font-black uppercase italic tracking-tight">{rec.title}</h4>
                          <Badge variant="outline" className="rounded-full text-[9px] font-black uppercase tracking-widest border-border text-muted-foreground">{rec.type}</Badge>
                        </div>
                        <p className="text-[13px] font-medium text-muted-foreground leading-relaxed italic italic">"{rec.description}"</p>
                        <div className="flex items-center gap-6 pt-2">
                          <div className="flex items-center gap-2 text-[10px] font-black text-success uppercase tracking-widest">
                            <ArrowUpRight className="h-3 w-3" /> {rec.impact}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest">
                            <ShieldCheck className="h-3 w-3" /> {rec.confidence}% Confidence
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {rec.status === "PENDING" ? (
                        <>
                          <Button 
                            onClick={() => handleAction(rec.id, "REJECTED")}
                            variant="ghost" 
                            className="h-14 w-14 rounded-2xl hover:bg-destructive hover:text-white transition-all shadow-sm"
                          >
                            <XCircle className="h-6 w-6" />
                          </Button>
                          <Button 
                            onClick={() => handleAction(rec.id, "AUTHORIZED")}
                            className="h-14 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-[0.2em] text-[10px] shadow-xl transition-all hover:scale-105 active:scale-95"
                          >
                            AUTHORIZE PROTOCOL
                          </Button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-card border border-border">
                          {rec.status === "AUTHORIZED" ? (
                            <CheckCircle2 className="h-5 w-5 text-success" />
                          ) : (
                            <XCircle className="h-5 w-5 text-destructive" />
                          )}
                          <span className="text-[10px] font-black uppercase tracking-widest italic">{rec.status}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Information Callout */}
        <div className="p-10 rounded-[3rem] bg-primary text-white flex flex-col md:flex-row items-center gap-10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-48 w-48 bg-primary rounded-full blur-[80px] -mr-24 -mt-24" />
          <div className="h-20 w-20 rounded-[1.5rem] bg-white/10 flex items-center justify-center border border-white/10 backdrop-blur-xl group-hover:rotate-12 transition-transform duration-700">
             <AlertCircle className="h-10 w-10 text-primary" />
          </div>
          <div className="flex-1 space-y-2">
             <h4 className="text-2xl font-black italic uppercase tracking-tight">Governance Intelligence Protocol</h4>
             <p className="text-sm font-medium opacity-60 italic italic">All strategic authorizations are logged in the secure vault. Executive override is active for 24h post-authorization.</p>
          </div>
          <Button variant="ghost" className="h-14 px-8 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[10px] gap-3">
             VIEW AUDIT LOG <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
