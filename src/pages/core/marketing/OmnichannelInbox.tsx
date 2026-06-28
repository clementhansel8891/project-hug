import { useState, useCallback, useEffect, useMemo } from "react";
import { 
  Search, 
  Filter, 
  Plus, 
  Send, 
  Phone, 
  Mail, 
  MessageSquare, 
  MoreVertical, 
  Paperclip, 
  Smile, 
  Zap, 
  User, 
  ShieldCheck, 
  Clock,
  CheckCheck,
  Globe,
  Star,
  ChevronRight,
  ExternalLink,
  Loader2,
  Settings,
  Trash2,
  UserPlus,
  Activity,
  MoreHorizontal,
  RefreshCw,
  Hash,
  ArrowUpRight,
  Target,
  BrainCircuit,
  Box,
  Layout,
  Rocket,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/core/security/session";
import { marketingService } from "@/core/services/marketing/marketingService";
import { EmptyState } from "@/components/shared/AsyncState";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { OmnichannelConfigModal } from "./modals/OmnichannelConfigModal";

interface Message {
  id: string;
  sender: "contact" | "system" | "OUTBOUND" | "INBOUND";
  direction: "OUTBOUND" | "INBOUND";
  content: string;
  sent_at: string;
  channel: "SMS" | "WHATSAPP" | "EMAIL";
  status: string;
}

interface Conversation {
  id: string;
  contactId: string;
  contactName: string;
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
  channel: "SMS" | "WHATSAPP" | "EMAIL";
  score: number;
}

export default function OmnichannelInbox() {
  const session = useSession();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "whatsapp" | "email" | "sms">("all");
  
  // New conversation state
  const [contacts, setContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const loadConversations = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const data = await marketingService.listConversations(session.tenant_id, session);
      setConversations(data);
      if (data.length > 0 && !selectedConv) {
        setSelectedConv(data[0]);
      }
      if (isManual) toast.success("Communications registry synchronized.");
    } catch (err) {
      console.error("Failed to load conversations:", err);
      toast.error("Telemetry failure in communications suite.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, session, selectedConv]);

  const loadMessages = useCallback(async (contactId: string) => {
    try {
      setLoadingMsgs(true);
      const data = await marketingService.listMessages(session.tenant_id, session, contactId);
      setMessages([...data].reverse());
    } catch (err) {
      console.error("Failed to load messages:", err);
      toast.error("Message retrieval failure.");
    } finally {
      setLoadingMsgs(false);
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

  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    let interval: any;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadConversations(true);
        if (selectedConv) {
          loadMessages(selectedConv.contactId);
        }
      }, 10000); // 10s sync
    }
    return () => clearInterval(interval);
  }, [autoRefresh, loadConversations, loadMessages, selectedConv]);

  useEffect(() => {
    if (selectedConv) {
      loadMessages(selectedConv.contactId);
    }
  }, [selectedConv, loadMessages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedConv) return;
    
    const text = inputText;
    setInputText("");
    
    // Optimistic UI
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      sender: "OUTBOUND",
      direction: "OUTBOUND",
      content: text,
      sent_at: new Date().toISOString(),
      channel: selectedConv.channel,
      status: "SENDING"
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      await marketingService.sendMessage(session.tenant_id, session, {
        contactId: selectedConv.contactId,
        channel: selectedConv.channel,
        content: text
      });
      loadMessages(selectedConv.contactId);
      loadConversations(true);
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error("Transmission failure.");
      setMessages(prev => (Array.isArray(prev) ? prev : []).filter(m => m.id !== optimisticMsg.id));
    }
  };

  const filteredConversations = useMemo(() => {
    return (Array.isArray(conversations) ? conversations : []).filter(conv => {
      const matchesSearch = conv.contactName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = filter === "all" || 
                           (filter === "unread" && conv.unreadCount > 0) ||
                           (filter.toUpperCase() === conv.channel);
      
      return matchesSearch && matchesFilter;
    });
  }, [conversations, searchQuery, filter]);

  if (loading && conversations.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted dark:bg-muted">
        <div className="flex flex-col items-center gap-6">
          <div className="h-20 w-20 bg-primary rounded-[2.5rem] animate-pulse flex items-center justify-center shadow-2xl shadow-indigo-500/20">
            <MessageSquare className="h-10 w-10 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Synchronizing Communication Grid...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 h-[calc(100vh-120px)] animate-in fade-in duration-700">
      <div className="h-full flex gap-0 overflow-hidden bg-white/40 dark:bg-muted backdrop-blur-3xl border border-white/20 dark:border-border/20 rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.25)] relative">
        {/* Sidebar: Strategic Registry */}
        <div className="w-96 border-r border-white/10 dark:border-border/10 flex flex-col bg-white/40 dark:bg-muted backdrop-blur-xl shrink-0">
          <div className="p-8 border-b border-white/10 dark:border-border/10 space-y-8">
            <div className="flex items-center justify-between">
               <div className="space-y-1">
                  <h2 className="text-3xl font-black tracking-tighter uppercase italic leading-none">Inbox</h2>
                  <div className="flex items-center gap-1.5 text-primary font-black text-[9px] uppercase tracking-widest">
                     <Activity className="h-3 w-3 animate-pulse" /> Unified Stream
                  </div>
               </div>
               
               <Dialog open={newConvOpen} onOpenChange={(open) => {
                 setNewConvOpen(open);
                 if (open) loadContacts();
               }}>
                 <DialogTrigger asChild>
                   <Button className="h-12 w-12 rounded-2xl bg-primary text-white shadow-xl shadow-indigo-500/20 hover:scale-110 active:scale-95 transition-all group">
                     <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" />
                   </Button>
                 </DialogTrigger>
                 <DialogContent className="sm:max-w-md rounded-[3rem] border-none bg-white dark:bg-muted p-0 overflow-hidden shadow-2xl">
                    <div className="h-2 bg-primary" />
                    <div className="p-10 space-y-8">
                       <DialogHeader>
                          <div className="flex items-center gap-3 mb-2">
                             <Badge className="bg-primary text-white font-black text-[10px] uppercase tracking-widest">Connection</Badge>
                             <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Initiation Protocol</p>
                          </div>
                          <DialogTitle className="text-3xl font-black tracking-tighter uppercase italic">Start Conversation</DialogTitle>
                          <DialogDescription className="text-sm font-medium italic">Authorize a new strategic link with a validated contact node.</DialogDescription>
                       </DialogHeader>
                       <div className="space-y-6">
                         <div className="relative group">
                           <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                           <Input placeholder="Search contact matrix..." className="pl-12 h-14 rounded-2xl bg-muted dark:bg-muted border-none shadow-inner font-bold text-sm" />
                         </div>
                         <ScrollArea className="h-80 rounded-[1.5rem] border-none bg-muted dark:bg-muted p-2 shadow-inner">
                           {loadingContacts ? (
                             <div className="p-12 flex flex-col items-center gap-4 grayscale opacity-30"><Loader2 className="h-8 w-8 animate-spin" /><p className="text-[10px] font-black uppercase tracking-widest">Scanning...</p></div>
                           ) : (
                             <div className="space-y-1">
                               {(Array.isArray(contacts) ? contacts : []).map(contact => (
                                 <button 
                                   key={contact.id}
                                   className="w-full p-4 flex items-center gap-4 hover:bg-white dark:hover:bg-muted rounded-2xl text-left transition-all group"
                                   onClick={() => {
                                     const fakeConv: Conversation = {
                                       id: `temp-${contact.id}`,
                                       contactId: contact.id,
                                       contactName: contact.name,
                                       lastMessage: "SYNCHRONIZATION PENDING",
                                       lastTimestamp: new Date().toISOString(),
                                       unreadCount: 0,
                                       channel: "WHATSAPP",
                                       score: 50
                                     };
                                     setSelectedConv(fakeConv);
                                     setNewConvOpen(false);
                                   }}
                                 >
                                   <Avatar className="h-10 w-10 rounded-xl shadow-md ring-2 ring-white/10">
                                     <AvatarFallback className="bg-primary text-white font-black text-xs">{contact.name[0]}</AvatarFallback>
                                   </Avatar>
                                   <div className="flex-1 min-w-0">
                                     <p className="text-sm font-black uppercase tracking-tight group-hover:text-primary transition-colors italic">{contact.name}</p>
                                     <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter truncate">{contact.email || contact.phone || "OFFLINE NODE"}</p>
                                   </div>
                                   <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                 </button>
                               ))}
                             </div>
                           )}
                         </ScrollArea>
                       </div>
                    </div>
                 </DialogContent>
               </Dialog>
            </div>
            
            <div className="relative group">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
               <Input 
                placeholder="Search encrypted history..." 
                className="pl-12 h-14 bg-white/50 dark:bg-muted border-none shadow-inner rounded-2xl text-sm font-medium" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
               />
            </div>
            
            <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
               {[
                 { id: "all", label: "ALL" },
                 { id: "unread", label: "UNREAD" },
                 { id: "whatsapp", label: "WHATSAPP" },
                 { id: "email", label: "EMAIL" },
                 { id: "sms", label: "SMS" }
               ].map(cat => (
                 <Badge 
                  key={cat.id}
                  variant={filter === cat.id ? "default" : "secondary"} 
                  className={cn(
                    "cursor-pointer text-[9px] font-black px-4 py-1.5 rounded-full transition-all whitespace-nowrap uppercase tracking-widest border-none shadow-sm",
                    filter === cat.id ? "bg-primary text-white shadow-indigo-500/20 scale-105" : "bg-white/50 dark:bg-muted text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => setFilter(cat.id as any)}
                 >
                   {cat.label}
                 </Badge>
               ))}
            </div>
          </div>
          
          <ScrollArea className="flex-1">
             <div className="p-3 space-y-2">
                {filteredConversations.length === 0 ? (
                  <EmptyState
                    title="Zero links detected"
                    description="No conversations match the current filter in this tenant scope."
                    icon={MessageSquare}
                  />
                ) : (
                  (Array.isArray(filteredConversations) ? filteredConversations : []).map(conv => (
                     <button
                       key={conv.id}
                       onClick={() => setSelectedConv(conv)}
                       className={cn(
                         "w-full p-5 flex items-start gap-5 text-left transition-all duration-300 rounded-[2rem] group relative overflow-hidden",
                         selectedConv?.id === conv.id 
                           ? "bg-white dark:bg-muted shadow-2xl shadow-indigo-500/10 translate-x-2 border-l-4 border-l-indigo-600" 
                           : "hover:bg-white/50 dark:hover:bg-muted hover:translate-x-1"
                       )}
                     >
                        <Avatar className={cn(
                          "h-14 w-14 shrink-0 rounded-2xl shadow-lg ring-2 ring-white/10 transition-transform duration-500 group-hover:scale-110",
                          selectedConv?.id === conv.id ? "ring-indigo-500/20" : ""
                        )}>
                           <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-sm italic">
                              {(conv.contactName || "??").split(' ').map(n => n[0]).join('')}
                           </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 py-0.5 space-y-1">
                           <div className="flex justify-between items-center">
                              <p className="text-sm font-black uppercase tracking-tight text-muted-foreground dark:text-white group-hover:text-primary transition-colors italic leading-none">{conv.contactName}</p>
                              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter">
                                {conv.lastTimestamp ? new Date(conv.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                              </span>
                           </div>
                           <p className="text-[11px] font-medium text-muted-foreground dark:text-muted-foreground line-clamp-1 italic italic leading-relaxed italic truncate">"{conv.lastMessage}"</p>
                           <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/10 dark:border-border/10">
                              <div className="flex items-center gap-3">
                                 <div className={cn(
                                   "p-1.5 rounded-lg shadow-sm",
                                   conv.channel === 'WHATSAPP' ? "bg-success text-white" :
                                   conv.channel === 'EMAIL' ? "bg-primary text-white" : "bg-warning text-white"
                                 )}>
                                   {conv.channel === 'WHATSAPP' && <MessageSquare className="h-3 w-3" />}
                                   {conv.channel === 'EMAIL' && <Mail className="h-3 w-3" />}
                                   {conv.channel === 'SMS' && <Phone className="h-3 w-3" />}
                                 </div>
                                 <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">{conv.channel} CHANNEL</span>
                              </div>
                              {conv.unreadCount > 0 && (
                                 <Badge className="h-5 min-w-[20px] px-1.5 flex items-center justify-center text-[9px] font-black bg-primary animate-pulse border-none shadow-lg shadow-indigo-500/30">
                                    {conv.unreadCount}
                                 </Badge>
                              )}
                           </div>
                        </div>
                     </button>
                  ))
                )}
             </div>
          </ScrollArea>
        </div>

        {/* Main Area: Encrypted Chat Stream */}
        <div className="flex-1 flex flex-col min-w-0 bg-white/40 dark:bg-muted backdrop-blur-3xl relative">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 h-96 w-96 bg-primary rounded-full blur-3xl -mr-48 -mt-48 pointer-events-none" />
          <div className="absolute bottom-0 left-0 h-96 w-96 bg-success rounded-full blur-3xl -ml-48 -mb-48 pointer-events-none" />

          {selectedConv ? (
            <>
              {/* Chat Header */}
              <div className="p-8 border-b border-white/10 dark:border-border/10 flex items-center justify-between shrink-0 bg-white/60 dark:bg-muted backdrop-blur-2xl z-10">
                <div className="flex items-center gap-6">
                  <Avatar className="h-16 w-16 rounded-2xl ring-4 ring-indigo-500/10 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                    <AvatarFallback className="bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-primary font-black text-xl italic">
                       {(selectedConv.contactName || "??").split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black tracking-tighter uppercase italic">{selectedConv.contactName}</h3>
                    <div className="flex items-center gap-3">
                       <span className="relative flex h-2 w-2">
                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                         <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                       </span>
                       <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Active Link Verified • {selectedConv.channel}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <Button 
                    variant={autoRefresh ? "default" : "outline"}
                    className={cn(
                      "h-12 px-6 rounded-2xl transition-all shadow-sm font-black text-[10px] uppercase tracking-widest gap-2",
                      autoRefresh ? "bg-success hover:bg-success" : "bg-white/50 dark:bg-muted"
                    )}
                    onClick={() => setAutoRefresh(!autoRefresh)}
                  >
                    <RefreshCw className={cn("h-4 w-4", autoRefresh && "animate-spin")} /> {autoRefresh ? "SYNC ACTIVE" : "AUTO-SYNC"}
                  </Button>
                  
                  <Button 
                    className="h-12 px-8 rounded-2xl bg-primary text-primary hover:bg-primary hover:text-white transition-all shadow-sm font-black text-[10px] uppercase tracking-widest gap-2 group"
                    onClick={() => toast.info("Triggering intelligent n8n workflow for this lead context...", {
                      icon: <Zap className="h-4 w-4 text-primary" />,
                      description: "Status: Connection Handshake Initiated"
                    })}
                  >
                    <Zap className="h-4 w-4 fill-indigo-600 group-hover:fill-white" /> RUN AUTOMATION
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-white/50 dark:bg-muted shadow-md hover:scale-110 transition-all border border-white/20"><MoreVertical className="h-5 w-5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 shadow-2xl border-none">
                      <DropdownMenuLabel className="font-black text-[10px] uppercase tracking-widest opacity-50 px-3 py-2">Stream Protocol</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-3 rounded-xl py-3 font-bold"><Star className="h-4 w-4" /> Mark as Strategic VIP</DropdownMenuItem>
                      <DropdownMenuItem className="gap-3 rounded-xl py-3 font-bold"><ShieldCheck className="h-4 w-4" /> Execute Node Verification</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-3 text-destructive rounded-xl py-3 font-bold" onClick={() => toast.error("Archival restricted for core assets")}><Trash2 className="h-4 w-4" /> Decommission Thread</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Chat Messages */}
              <ScrollArea className="flex-1">
                {loadingMsgs ? (
                  <div className="flex flex-col items-center justify-center h-full py-40 gap-6 opacity-30 grayscale">
                    <RefreshCw className="h-16 w-16 animate-spin text-muted-foreground" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Verifying Encrypted Channel...</p>
                  </div>
                ) : (
                  <div className="p-10 space-y-12 max-w-5xl mx-auto">
                    <div className="flex justify-center relative">
                      <div className="absolute inset-x-0 top-1/2 h-px bg-white/10 dark:bg-muted -translate-y-1/2" />
                      <Badge variant="outline" className="relative z-10 text-[9px] font-black uppercase tracking-[0.3em] bg-white/80 dark:bg-muted backdrop-blur-md border-none shadow-xl py-2 px-6 rounded-full text-muted-foreground italic">
                        Quantum Link Authorized • High Priority Protocol
                      </Badge>
                    </div>
                    
                    {(Array.isArray(messages) ? messages : []).map((msg, idx) => {
                      const isNewDay = idx === 0 || new Date(msg.sent_at).toDateString() !== new Date(messages[idx-1].sent_at).toDateString();
                      
                      return (
                        <div key={msg.id} className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                          {isNewDay && (
                            <div className="flex items-center gap-6 py-6">
                              <div className="h-px flex-1 bg-white/10 dark:bg-muted" />
                              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest italic opacity-60">
                                {new Date(msg.sent_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                              </span>
                              <div className="h-px flex-1 bg-white/10 dark:bg-muted" />
                            </div>
                          )}
                          
                          <div className={cn(
                            "flex flex-col gap-3 group transition-all",
                            msg.direction === 'OUTBOUND' ? "items-end" : "items-start"
                          )}>
                            <div className={cn(
                              "max-w-[75%] p-6 rounded-[2.5rem] text-sm shadow-2xl relative overflow-hidden group/msg",
                              msg.direction === 'OUTBOUND' 
                                ? "bg-primary text-white rounded-tr-none shadow-indigo-500/20" 
                                : "bg-white/80 dark:bg-muted text-muted-foreground dark:text-muted-foreground rounded-tl-none border border-white/20 dark:border-border/20 shadow-black/5 backdrop-blur-md"
                            )}>
                              {msg.direction === 'OUTBOUND' && (
                                <div className="absolute top-0 right-0 h-24 w-24 bg-white/10 rounded-full blur-2xl -mr-12 -mt-12 group-hover/msg:scale-150 transition-transform duration-700" />
                              )}
                              <div className="relative z-10 font-medium leading-relaxed italic">
                                {msg.content}
                              </div>
                            </div>
                            <div className={cn(
                              "flex items-center gap-3 px-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0",
                              msg.direction === 'OUTBOUND' ? "flex-row-reverse" : "flex-row"
                            )}>
                              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest italic opacity-60">
                                {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                                {msg.direction === 'OUTBOUND' && (
                                  <div className="flex gap-1 items-center">
                                    {msg.status === 'SENDING' && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                    {msg.status === 'SENT' && <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />}
                                    {msg.status === 'READ' && <CheckCheck className="h-3.5 w-3.5 text-success" />}
                                    {msg.status === 'FAILED' && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              {/* Message Input Cluster */}
              <div className="p-8 border-t border-white/10 dark:border-border/10 shrink-0 bg-white/60 dark:bg-muted backdrop-blur-2xl z-10">
                <div className="max-w-5xl mx-auto flex items-end gap-6">
                  <div className="flex gap-2 pb-2">
                     <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-white/50 dark:bg-muted shadow-md hover:scale-110 transition-all text-muted-foreground"><Paperclip className="h-5 w-5" /></Button>
                     <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-white/50 dark:bg-muted shadow-md hover:scale-110 transition-all text-muted-foreground"><Smile className="h-5 w-5" /></Button>
                  </div>
                  
                  <div className="flex-1 relative group/input">
                    <div className="absolute inset-0 bg-primary rounded-[2rem] blur-xl opacity-0 group-focus-within/input:opacity-100 transition-opacity" />
                    <textarea 
                      placeholder={`Authorize response via ${selectedConv.channel} stream...`} 
                      className="w-full bg-white dark:bg-muted border-none rounded-[2rem] p-5 pr-16 shadow-inner focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium resize-none h-16 min-h-[64px] max-h-40 relative z-10 italic"
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <div className="absolute right-3 bottom-3 z-20">
                      <Button 
                        size="icon" 
                        className={cn(
                          "h-12 w-12 rounded-2xl shadow-2xl transition-all duration-500",
                          inputText.trim() 
                            ? "bg-primary text-white hover:bg-primary hover:scale-110 active:scale-95 shadow-indigo-500/30" 
                            : "bg-muted dark:bg-muted text-muted-foreground cursor-not-allowed"
                        )}
                        onClick={handleSendMessage}
                        disabled={!inputText.trim()}
                      >
                        <Send className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-20 animate-in zoom-in duration-1000 grayscale opacity-30 space-y-12">
              <div className="relative">
                 <div className="absolute inset-0 bg-primary blur-[100px] rounded-full scale-[3] animate-pulse" />
                 <div className="h-48 w-48 rounded-[4rem] bg-white dark:bg-muted flex items-center justify-center shadow-[0_50px_100px_-20px_rgba(79,70,229,0.3)] relative z-10 border border-white/20">
                    <MessageSquare className="h-24 w-24 text-primary drop-shadow-2xl" />
                 </div>
              </div>
              <div className="text-center space-y-4">
                <h3 className="text-4xl font-black uppercase tracking-tighter italic">Command Center Inactive</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground max-w-[400px] mx-auto leading-relaxed italic">Select a strategic conversation from the matrix to begin orchestrating your omnichannel communication strategy.</p>
              </div>
              <Button 
                className="h-[4.5rem] px-12 rounded-[2.5rem] bg-primary hover:bg-primary shadow-2xl shadow-indigo-500/30 font-black text-sm gap-4 group transition-all hover:scale-105 active:scale-95 text-white"
                onClick={() => setNewConvOpen(true)}
              >
                <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" />
                INITIATE NEW PROTOCOL
              </Button>
            </div>
          )}
        </div>

        {/* Right Sidebar: Intelligence Matrix */}
        {selectedConv && (
          <div className="w-96 border-l border-white/10 dark:border-border/10 bg-white/40 dark:bg-muted backdrop-blur-xl flex flex-col shrink-0 overflow-y-auto animate-in slide-in-from-right duration-700">
            <div className="p-10 text-center bg-white/60 dark:bg-muted backdrop-blur-2xl border-b border-white/10 dark:border-border/10">
              <div className="relative mx-auto w-32 h-32 mb-8">
                <div className="absolute inset-0 bg-primary rounded-full animate-ping blur-xl" />
                <Avatar className="h-32 w-32 border-8 border-white dark:border-border shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] relative group-hover:scale-105 transition-transform duration-500">
                  <AvatarFallback className="bg-gradient-to-br from-slate-900 to-indigo-900 text-white text-3xl font-black uppercase italic">
                    {(selectedConv.contactName || "??").split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
              </div>
              <h3 className="font-black text-3xl tracking-tighter uppercase italic mb-2">{selectedConv.contactName}</h3>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-8">Strategic Principal Node</p>
              
              <div className="flex justify-center gap-4">
                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-2xl bg-white dark:bg-muted shadow-lg hover:scale-110 hover:bg-primary hover:text-white transition-all"><Phone className="h-5 w-5" /></Button>
                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-2xl bg-white dark:bg-muted shadow-lg hover:scale-110 hover:bg-primary hover:text-white transition-all"><Mail className="h-5 w-5" /></Button>
                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-2xl bg-white dark:bg-muted shadow-lg hover:scale-110 hover:bg-warning hover:text-white transition-all"><Star className="h-5 w-5" /></Button>
              </div>
            </div>
            
            <div className="p-10 space-y-12">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic leading-none">Intelligence Hub</p>
                  <BrainCircuit className="h-4 w-4 text-primary" />
                </div>
                
                <div className="bg-white/60 dark:bg-muted backdrop-blur-md rounded-[2.5rem] p-8 shadow-2xl border border-white/20 dark:border-border/20 space-y-8">
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest italic">Growth Index</span>
                      <p className="text-xl font-black text-success">{selectedConv.score}%</p>
                    </div>
                    <div className="h-2 w-full bg-muted dark:bg-muted rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-success transition-all duration-1000" style={{ width: `${selectedConv.score}%` }} />
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2 border-t border-white/10">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest italic">Lead Rating</span>
                    <Badge className="bg-primary text-white font-black text-[9px] uppercase tracking-widest px-4 py-1 h-6 rounded-full border-none shadow-lg shadow-indigo-500/20">PREMIUM</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic leading-none">Environment</p>
                <div className="space-y-6 bg-white/40 dark:bg-muted p-8 rounded-[2.5rem] border border-white/10 dark:border-border/10 shadow-sm backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest flex items-center gap-3"><Globe className="h-4 w-4 text-primary" /> REGION</span>
                    <span className="text-xs font-black uppercase italic">CALIFORNIA, US</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest flex items-center gap-3"><Clock className="h-4 w-4 text-primary" /> LOCAL TIME</span>
                    <span className="text-xs font-black uppercase italic">08:42 AM</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6 pt-4">
                 <Button className="w-full h-16 rounded-[1.5rem] bg-primary hover:bg-primary shadow-2xl shadow-indigo-500/30 font-black text-[10px] uppercase tracking-[0.2em] group gap-3 text-white" asChild>
                   <Link to={`/core/marketing/customer-360?id=${selectedConv.contactId}`}>
                     <ExternalLink className="h-4 w-4 group-hover:scale-110 transition-transform" />
                     VIEW 360 REPORT
                   </Link>
                 </Button>
                 <div className="flex items-start gap-4 p-5 rounded-2xl bg-white/20 dark:bg-muted border border-white/10">
                    <Target className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground font-medium leading-relaxed italic">
                      "Strategic Insight: Client demonstrates high intent for Enterprise Q4. Authorize high-touch conversion protocol."
                    </p>
                 </div>
               </div>
            </div>
          </div>
        )}
      </div>

      {/* Omnichannel Config Modal */}
      <OmnichannelConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />
    </div>
  );
}
