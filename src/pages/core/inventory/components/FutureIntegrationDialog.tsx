import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Truck, Globe, Zap, Shield, AlertCircle } from "lucide-react";

interface FutureIntegrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
}

export function FutureIntegrationDialog({
  open,
  onOpenChange,
  title = "Courier Integration",
}: FutureIntegrationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl bg-muted text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 via-transparent to-emerald-500/10 pointer-events-none" />
        
        <DialogHeader className="p-10 text-center relative z-10">
          <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-primary mx-auto mb-6 shadow-2xl shadow-indigo-600/40 border border-border">
            <Truck className="h-10 w-10 text-white" />
          </div>
          <DialogTitle className="text-3xl font-black tracking-tighter uppercase italic">
            {title}
          </DialogTitle>
          <div className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mt-2">
            Protocol Expansion Pending
          </div>
        </DialogHeader>

        <div className="px-10 pb-10 space-y-6 relative z-10">
          <p className="text-muted-foreground text-sm font-medium leading-relaxed text-center italic">
            "Automated courier dispatching and real-time fleet synchronization is currently under development in the Zenvix Labs."
          </p>

          <div className="space-y-3">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-border hover:border-border transition-colors">
              <Globe className="h-5 w-5 text-primary" />
              <div className="text-xs font-bold text-muted-foreground">Global API Webhooks</div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-border hover:border-border transition-colors">
              <Zap className="h-5 w-5 text-warning" />
              <div className="text-xs font-bold text-muted-foreground">Instant Rate Calculation</div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-border hover:border-border transition-colors">
              <Shield className="h-5 w-5 text-success" />
              <div className="text-xs font-bold text-muted-foreground">Secure Transit Insurance</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl bg-warning border border-warning/20 text-warning text-[10px] font-black uppercase tracking-widest">
            <AlertCircle className="h-3 w-3" /> Targeted Release: Q3 2026
          </div>
        </div>

        <DialogFooter className="p-8 bg-white/5 border-t border-border flex flex-col gap-3 relative z-10">
          <Button 
            className="w-full rounded-2xl h-14 bg-white text-muted-foreground font-black uppercase tracking-widest text-xs hover:bg-muted transition-all hover:scale-[1.02] active:scale-[0.98]"
            onClick={() => onOpenChange(false)}
          >
            Acknowledge Protocol
          </Button>
          <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest text-center">
            Zenvix Advanced Logistics Research Division
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
