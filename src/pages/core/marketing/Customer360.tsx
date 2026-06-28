import React from "react";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  TrendingUp, 
  ShoppingCart, 
  MousePointer2, 
  MessageSquare,
  Clock,
  Calendar,
  Zap,
  Tag,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Globe,
  Briefcase,
  Target,
  Activity,
  Layers,
  Box,
  Rocket,
  MoreHorizontal,
  RefreshCw,
  Search
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const TIMELINE_EVENTS = [
  { id: 1, type: 'email', title: 'Opened Summer Promo Email', date: '2 hours ago', icon: Mail, color: 'text-primary', bg: 'bg-primary' },
  { id: 2, type: 'web', title: 'Visited Pricing Page (3 mins)', date: '5 hours ago', icon: MousePointer2, color: 'text-primary', bg: 'bg-primary' },
  { id: 3, type: 'retail', title: 'Purchased Classic Jacket (Offline)', date: 'Yesterday', icon: ShoppingCart, color: 'text-success', bg: 'bg-success' },
  { id: 4, type: 'chat', title: 'WhatsApp Inquiry: Size Guide', date: '2 days ago', icon: MessageSquare, color: 'text-success', bg: 'bg-success' },
  { id: 5, type: 'system', title: 'Scored High Intent (AI)', date: '3 days ago', icon: Zap, color: 'text-warning', bg: 'bg-warning' },
];

export default function Customer360() {
  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-1000 max-w-[1600px] mx-auto pb-24">
      {/* Premium Header: Strategic Identity */}
      <div className="flex flex-col lg:flex-row gap-10">
        <Card className="flex-1 rounded-[3rem] border-none shadow-2xl bg-primary text-white p-10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-64 w-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 group-hover:scale-150 transition-transform duration-1000" />
          <CardContent className="p-0 relative z-10">
            <div className="flex flex-col md:flex-row gap-10 items-start md:items-center justify-between">
              <div className="flex items-center gap-8">
                <Avatar className="h-32 w-32 rounded-[2.5rem] ring-4 ring-white/20 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                  <AvatarFallback className="text-4xl font-black bg-white/10 backdrop-blur-md text-white italic">SJ</AvatarFallback>
                </Avatar>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <h1 className="text-5xl font-black tracking-tighter uppercase italic">Sarah Jenkins</h1>
                    <Badge className="bg-white/20 border-none text-[10px] font-black px-4 py-1 rounded-full text-white uppercase tracking-[0.2em] backdrop-blur-md">
                       VIP GOLD NODE
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-8 text-[11px] font-black uppercase tracking-widest opacity-60">
                    <span className="flex items-center gap-2"><Mail className="h-4 w-4" /> sarah@enterprise.com</span>
                    <span className="flex items-center gap-2"><Phone className="h-4 w-4" /> +1 (555) 012-3456</span>
                    <span className="flex items-center gap-2"><MapPin className="h-4 w-4" /> San Francisco, USA</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <Button variant="outline" className="h-14 px-8 rounded-2xl bg-white/10 border-none shadow-xl hover:scale-110 transition-all text-white font-black text-[10px] uppercase tracking-widest">EDIT IDENTITY</Button>
                <Button className="h-14 px-8 rounded-2xl bg-white text-primary shadow-xl hover:scale-110 transition-all font-black text-[10px] uppercase tracking-widest">DEPLOY TASK</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full lg:w-96 rounded-[3rem] border-none shadow-2xl bg-white dark:bg-muted overflow-hidden group">
          <CardHeader className="p-8 pb-4">
            <div className="flex items-center justify-between">
               <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">Behavioral Intelligence</CardTitle>
               <Activity className="h-4 w-4 text-primary animate-pulse" />
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-4 space-y-8">
            <div className="text-center space-y-2">
              <div className="text-7xl font-black tracking-tighter text-primary italic">87</div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Strategic Growth Score</p>
            </div>
            <div className="space-y-4">
              <div className="h-2 w-full bg-muted dark:bg-muted rounded-full overflow-hidden shadow-inner">
                 <div className="h-full bg-primary shadow-[0_0_10px_rgba(79,70,229,0.5)] transition-all duration-1000" style={{ width: '87%' }} />
              </div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-success flex items-center gap-1.5"><TrendingUp className="h-3 w-3" /> +12% MoM YIELD</span>
                <span className="text-muted-foreground italic">HIGH INTENT CLUSTER</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-12 gap-10">
        {/* Left: Financials & Attribution */}
        <div className="col-span-12 lg:col-span-8 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {[
               { label: 'Estimated LTV', val: 'Rp 64.2jt', color: 'text-primary', sub: 'Last 12 month cycle' },
               { label: 'Strategic Purchases', val: '14', color: 'text-muted-foreground dark:text-white', sub: 'Unified Offline + Online' },
               { label: 'Engagement CTR', val: '24.2%', color: 'text-success', sub: 'High-velocity interaction' },
             ].map((stat, i) => (
               <Card key={i} className="rounded-[2.5rem] border-none shadow-xl glass-card group hover:shadow-2xl transition-all">
                  <CardContent className="p-8 space-y-2">
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground italic mb-2">{stat.label}</p>
                     <p className={cn("text-4xl font-black tracking-tighter uppercase italic leading-none", stat.color)}>{stat.val}</p>
                     <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-3 opacity-60">{stat.sub}</p>
                  </CardContent>
               </Card>
             ))}
          </div>

          <Card className="rounded-[3rem] border-none shadow-2xl glass-card overflow-hidden">
            <CardHeader className="p-10 pb-6 border-b border-border dark:border-border/10">
               <div className="flex items-center justify-between">
                  <div className="space-y-1">
                     <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-3 uppercase italic">
                        <Clock className="h-6 w-6 text-primary" />
                        Unified Timeline
                     </CardTitle>
                     <CardDescription className="text-xs font-medium italic italic">Omnichannel interactions across Marketing, Sales, and Retail clusters.</CardDescription>
                  </div>
                  <Badge variant="outline" className="rounded-full font-black text-[9px] px-3 py-1 border-border dark:border-border uppercase tracking-widest text-muted-foreground">LIVE FEED</Badge>
               </div>
            </CardHeader>
            <CardContent className="p-10">
              <div className="relative space-y-12 pl-12">
                 <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-primary" />
                 {(Array.isArray(TIMELINE_EVENTS) ? TIMELINE_EVENTS : []).map((event) => (
                  <div key={event.id} className="relative group">
                    <div className={cn("absolute -left-12 top-0 h-9 w-9 rounded-xl flex items-center justify-center border-4 border-white dark:border-border shadow-xl z-10 group-hover:scale-125 transition-all", event.bg)}>
                      <event.icon className={cn("h-4 w-4", event.color)} />
                    </div>
                    <div className="space-y-1 group-hover:translate-x-1 transition-transform">
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-black uppercase tracking-tight italic text-muted-foreground dark:text-white group-hover:text-primary transition-colors">{event.title}</h4>
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{event.date}</span>
                      </div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter opacity-60 italic">Interaction via {event.type.toUpperCase()} Channel</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="ghost" className="w-full mt-10 h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-muted dark:hover:bg-muted gap-2">
                 VIEW ALL 142 STRATEGIC EVENTS <ArrowUpRight className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Segmentation & CRM Intelligence */}
        <div className="col-span-12 lg:col-span-4 space-y-10">
          <Card className="rounded-[3rem] border-none shadow-2xl bg-white dark:bg-muted overflow-hidden group">
            <CardHeader className="p-8 pb-4">
               <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">Segmentation Matrix</CardTitle>
                  <Tag className="h-4 w-4 text-primary" />
               </div>
            </CardHeader>
            <CardContent className="p-8 pt-4 flex flex-wrap gap-3">
              <Badge className="bg-primary text-primary border-none font-black text-[9px] px-4 py-1.5 rounded-full uppercase tracking-widest">POWER BUYER</Badge>
              <Badge className="bg-success text-success border-none font-black text-[9px] px-4 py-1.5 rounded-full uppercase tracking-widest">ECO-CONSCIOUS</Badge>
              <Badge className="bg-primary text-primary border-none font-black text-[9px] px-4 py-1.5 rounded-full uppercase tracking-widest">WEBINAR ATTENDEE</Badge>
              <Badge className="bg-warning text-warning border-none font-black text-[9px] px-4 py-1.5 rounded-full uppercase tracking-widest">EARLY ADOPTER</Badge>
              <Badge className="bg-muted dark:bg-muted text-muted-foreground border-none font-black text-[9px] px-4 py-1.5 rounded-full uppercase tracking-widest">TECH ENTHUSIAST</Badge>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-muted dark:bg-muted text-primary hover:scale-110 transition-all shadow-sm"><Zap className="h-4 w-4" /></Button>
            </CardContent>
          </Card>

          <Card className="rounded-[3rem] border-none shadow-2xl bg-white dark:bg-muted overflow-hidden group">
            <CardHeader className="p-8 pb-4">
               <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">Entity Meta-Data</CardTitle>
                  <ShieldCheck className="h-4 w-4 text-success" />
               </div>
            </CardHeader>
            <CardContent className="p-8 pt-4 space-y-8">
               <div className="space-y-6">
                  <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest">
                     <span className="text-muted-foreground italic flex items-center gap-2 leading-none"><Globe className="h-3.5 w-3.5" /> Industry</span>
                     <span className="text-muted-foreground dark:text-white leading-none">RETAIL & APPAREL</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest">
                     <span className="text-muted-foreground italic flex items-center gap-2 leading-none"><Layers className="h-3.5 w-3.5" /> Scale Band</span>
                     <span className="text-muted-foreground dark:text-white leading-none">500-1,000 NODES</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest">
                     <span className="text-muted-foreground italic flex items-center gap-2 leading-none"><User className="h-3.5 w-3.5" /> Identity Owner</span>
                     <div className="flex items-center gap-3">
                        <Avatar className="h-6 w-6 rounded-lg ring-2 ring-indigo-500/10 shadow-sm">
                           <AvatarFallback className="bg-primary text-white text-[9px] font-black">MT</AvatarFallback>
                        </Avatar>
                        <span className="text-muted-foreground dark:text-white leading-none italic">MARK THOMPSON</span>
                     </div>
                  </div>
               </div>
               <Separator className="bg-muted dark:bg-muted" />
               <div className="space-y-4">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest italic">Operational Note</p>
                  <div className="p-6 bg-muted dark:bg-muted rounded-2xl text-xs font-medium leading-relaxed text-muted-foreground dark:text-muted-foreground italic relative overflow-hidden">
                     <div className="absolute left-0 top-0 h-full w-1 bg-primary" />
                     "Sarah mentioned interest in our Q4 enterprise tier. High potential for yield upsell."
                  </div>
               </div>
            </CardContent>
          </Card>

          <Card className="rounded-[3rem] border-none shadow-2xl bg-muted text-white p-10 relative overflow-hidden group">
             <div className="absolute top-0 right-0 h-40 w-40 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-1000" />
             <div className="relative z-10 space-y-8">
                <div className="flex items-center gap-4">
                   <div className="h-14 w-14 bg-primary rounded-2xl flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform">
                      <Zap className="h-7 w-7 text-white fill-white" />
                   </div>
                   <div>
                      <h4 className="font-black text-lg uppercase tracking-tighter italic">Strategic AI Action</h4>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Zenvix Intelligence Engine</p>
                   </div>
                </div>
                <p className="text-sm font-medium italic italic opacity-70 leading-relaxed italic">
                   "High probability of churn if no contact in 7 days. Recommend authorizing <strong>Loyalty Reward</strong> protocol via SMS."
                </p>
                <Button className="w-full h-14 bg-primary hover:bg-primary text-white border-none rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-indigo-500/30 gap-3 group/btn">
                   DEPLOY RECOMMENDATION <Rocket className="h-4 w-4 group-hover/btn:-translate-y-1 group-hover/btn:translate-x-1 transition-transform" />
                </Button>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
