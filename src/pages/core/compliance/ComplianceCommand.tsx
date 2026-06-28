import React from "react";
import { ShieldCheck, Lock, Fingerprint, History, Zap, Search, Download, FileText, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

export default function ComplianceCommand() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 bg-muted p-10 space-y-10 relative overflow-hidden selection:bg-primary selection:text-white">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] bg-primary blur-[130px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[35%] h-[35%] bg-primary blur-[120px] rounded-full animate-pulse" />
      </div>

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-indigo-600/20">
            <ShieldCheck className="w-9 h-9" />
          </div>
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">
              Compliance Command Center
            </h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em] mt-1">
              Global Governance Node • v4.2.0 • SHA-256 Verified
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="outline" className="h-12 px-6 rounded-2xl bg-muted border-border text-white hover:bg-muted/10 font-black italic uppercase text-[11px] tracking-widest gap-3 transition-all">
            <Download className="w-4 h-4 text-success" /> Export Report
          </Button>
          <Button className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary text-white font-black italic uppercase text-[11px] tracking-widest gap-3 shadow-xl shadow-indigo-600/20 transition-all">
            <Lock className="w-4 h-4" /> Lock Session
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 relative z-10">
        <Card className="lg:col-span-3 bg-card backdrop-blur-3xl border border-border rounded-[3rem] overflow-hidden shadow-2xl">
          <CardContent className="p-12 flex flex-col md:flex-row justify-between items-center gap-12 text-white">
            <div className="space-y-8 flex-1">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center border border-primary">
                  <Fingerprint className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2 italic">
                    System Integrity State
                  </div>
                  <div className="text-5xl font-black italic tracking-tighter">
                    IMMUTABLE
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest italic">
                  Current Block Signature
                </div>
                <code className="bg-black/60 px-8 py-4 rounded-2xl text-primary font-mono text-sm border border-border block w-fit shadow-inner">
                  ZVX-AUTH-0xBD42-7719-AE99-FF01
                </code>
              </div>
            </div>
            <div className="w-72 bg-secondary border border-border p-10 rounded-[3rem] space-y-8 text-center shrink-0 backdrop-blur-md shadow-2xl relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary blur-3xl" />
              <div className="text-7xl font-black italic tracking-tighter text-primary">
                100%
              </div>
              <div className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">
                Integrity Score
              </div>
              <Progress value={100} className="h-3 bg-muted shadow-inner" />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card className="bg-success border-success/20 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl overflow-hidden border transition-all hover:bg-success">
            <CardContent className="p-10 space-y-6 text-center">
              <div className="w-16 h-16 bg-success rounded-2xl flex items-center justify-center text-white shadow-xl mx-auto">
                <Zap className="w-8 h-8" />
              </div>
              <div className="text-xl font-black italic text-success uppercase tracking-widest">
                Zero Flags
              </div>
              <p className="text-[10px] text-muted-foreground font-bold leading-relaxed italic uppercase tracking-widest">
                Real-time scanning detected 0 anomalies in 1.4M events.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border backdrop-blur-3xl rounded-[2.5rem] shadow-2xl overflow-hidden border group cursor-pointer hover:bg-muted transition-all">
            <CardContent className="p-10 text-center space-y-6">
              <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl mx-auto group-hover:scale-110 transition-transform">
                <History className="w-8 h-8" />
              </div>
              <div className="text-xl font-black italic text-white uppercase tracking-widest">
                Archive Vault
              </div>
              <Button variant="ghost" className="text-[10px] text-primary font-black italic uppercase tracking-widest hover:bg-transparent">
                Access T+90 Days Data <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="bg-card backdrop-blur-3xl border border-border rounded-[3rem] shadow-2xl overflow-hidden relative z-10">
        <CardHeader className="p-12 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 bg-muted border border-border rounded-2xl flex items-center justify-center text-primary shadow-xl">
                <Search className="w-7 h-7" />
              </div>
              <div>
                <CardTitle className="text-3xl font-black italic uppercase tracking-tighter text-white">
                  Immutable Audit Stream
                </CardTitle>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] mt-1">
                  Non-Repudiable Logs • Cryptographically Sealed
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Input 
                className="w-80 h-12 bg-secondary border-border rounded-xl text-white placeholder:text-muted-foreground italic font-bold"
                placeholder="Search logs..."
              />
              <Button className="h-12 bg-muted border border-border text-white rounded-xl px-6 font-black italic uppercase text-[10px] tracking-widest hover:bg-muted/10">
                Filter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[500px] flex flex-col items-center justify-center text-muted-foreground gap-6 opacity-30">
            <ShieldCheck className="w-24 h-24" />
            <p className="text-[11px] font-black italic uppercase tracking-[0.5em]">
              Initializing Compliance Ledger Feed...
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
