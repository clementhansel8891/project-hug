import React from "react";
import { 
  Layout, 
  MousePointer2, 
  Zap, 
  Target, 
  Flame, 
  Users, 
  ShoppingCart,
  ChevronRight,
  Rocket,
  ShieldCheck,
  Globe,
  PieChart,
  BarChart4,
  Activity,
  Layers,
  Box
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TEMPLATES = [
  {
    id: "lead-magnet",
    name: "Classic Lead Magnet",
    description: "Authorize free report or guide in exchange for contact info.",
    steps: ["Landing Page", "Thank You Page"],
    icon: Users,
    color: "text-primary",
    bg: "bg-primary",
    difficulty: "STRATEGIC",
    intensity: 45
  },
  {
    id: "vsl",
    name: "Video Sales Letter",
    description: "High-conversion sales path driven by tactical video content.",
    steps: ["VSL Page", "Checkout", "Upsell", "Thank You"],
    icon: Flame,
    color: "text-warning",
    bg: "bg-warning",
    difficulty: "TACTICAL",
    intensity: 72
  },
  {
    id: "webinar",
    name: "Automated Webinar",
    description: "Multi-touch registration and replay funnel orchestration.",
    steps: ["Reg Page", "Waiting Room", "Webinar", "Sales Page", "Success"],
    icon: Zap,
    color: "text-primary",
    bg: "bg-primary",
    difficulty: "ELITE",
    intensity: 89
  },
  {
    id: "ecommerce",
    name: "E-commerce Flash",
    description: "Optimized for high-velocity physical product conversion.",
    steps: ["Product", "Checkout", "Upsell", "Receipt"],
    icon: ShoppingCart,
    color: "text-success",
    bg: "bg-success",
    difficulty: "CORE",
    intensity: 64
  }
];

export default function FunnelTemplates({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
      {(Array.isArray(TEMPLATES) ? TEMPLATES : []).map((template) => (
        <Card 
          key={template.id} 
          className="group relative overflow-hidden rounded-[2.5rem] border-none bg-muted dark:bg-muted backdrop-blur-xl shadow-xl hover:shadow-[0_40px_80px_-20px_rgba(79,70,229,0.2)] transition-all duration-500 cursor-pointer"
          onClick={() => onSelect(template.id)}
        >
          {/* Status Glow */}
          <div className={cn(
            "absolute top-0 right-0 h-32 w-32 rounded-full blur-[60px] -mr-16 -mt-16 opacity-0 group-hover:opacity-40 transition-opacity duration-1000",
            template.bg.replace('/10', '')
          )} />
          
          <CardHeader className="p-8 pb-4 flex flex-row items-start gap-6 relative z-10">
            <div className={cn(
              "h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 shadow-2xl transition-transform group-hover:scale-110 duration-700",
              template.bg,
              template.color
            )}>
              <template.icon className="h-8 w-8" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-black uppercase tracking-tighter italic leading-none">{template.name}</CardTitle>
                <Badge className="bg-primary text-primary border-none font-black text-[9px] px-3 py-1 rounded-full uppercase tracking-widest leading-none h-6">
                   {template.difficulty}
                </Badge>
              </div>
              <CardDescription className="text-xs font-medium italic italic leading-relaxed opacity-60">"{template.description}"</CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="p-8 pt-4 space-y-6 relative z-10">
             <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">Pathway Logic</p>
                <div className="flex items-center gap-3 overflow-hidden">
                   {(Array.isArray(template.steps) ? template.steps : []).map((step, i) => (
                      <React.Fragment key={step}>
                         <div className="bg-card dark:bg-muted px-4 py-2 rounded-xl border border-border shadow-sm text-[10px] font-black uppercase tracking-tight text-muted-foreground dark:text-white italic">
                            {step}
                         </div>
                         {i < template.steps.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-primary opacity-40" />}
                      </React.Fragment>
                   ))}
                </div>
             </div>
             
             <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-3">
                   <Activity className="h-4 w-4 text-primary animate-pulse" />
                   <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest italic">Simulation IQ: {template.intensity}%</span>
                </div>
                <Button 
                   variant="ghost" 
                   className="h-10 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest bg-primary text-white shadow-lg shadow-indigo-600/20 group-hover:scale-105 active:scale-95 transition-all"
                >
                   DEPLOY TOPOLOGY
                </Button>
             </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
