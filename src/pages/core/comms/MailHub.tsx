import { useEffect, useState, useCallback } from "react";
import { useSession } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Inbox, 
  Send, 
  File, 
  Trash2, 
  Star, 
  Plus, 
  Search,
  RefreshCw,
  X,
  Reply,
  Forward,
  ChevronRight,
  Loader2,
  Mail,
  Activity
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNotifications } from "@/contexts/NotificationContext";
import { formatDate, formatDateTime, safeText } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import DepartmentWorkspaceLayout from "@/components/layouts/DepartmentWorkspaceLayout";
import { MailComposeModal } from "./modals/MailComposeModal";

interface MailMessage {
  id: string;
  subject: string;
  bodyText: string;
  fromAddress: string;
  toAddresses: string[];
  isRead: boolean;
  isStarred: boolean;
  createdAt: string;
}

interface MailAccount {
  id: string;
  internalEmail: string;
  address: string;
}

const SECTIONS = [
  {
    title: "MESSAGES",
    items: [
      { id: 'inbox', icon: Inbox, label: "Inbox", to: "/core/mail?f=inbox" },
      { id: 'sent', icon: Send, label: "Sent", to: "/core/mail?f=sent" },
      { id: 'drafts', icon: File, label: "Drafts", to: "/core/mail?f=drafts" },
      { id: 'starred', icon: Star, label: "Starred", to: "/core/mail?f=starred" },
      { id: 'trash', icon: Trash2, label: "Trash", to: "/core/mail?f=trash" },
    ]
  }
];

export default function MailHub() {
  const session = useSession();
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMail, setSelectedMail] = useState<MailMessage | null>(null);
  const [activeFolder, setActiveFolder] = useState("inbox");
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState({ to: "", subject: "", body: "", status: "draft" });
  const [filter, setFilter] = useState("");
  const [userAccount, setUserAccount] = useState<MailAccount | null>(null);

  const { fetchCounts } = useNotifications();

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<any>(`/comms/mail/messages?folder=${activeFolder}`, "GET", session);
      setMessages(data.data || []);
      setUserAccount(data.account);
    } catch (error: any) {
      console.error("Failed to fetch mail:", error);
      toast({
        title: "Sync Error",
        description: error.message || "Failed to synchronize mail account.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [session, activeFolder]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleSelectMail = async (mail: MailMessage) => {
    setSelectedMail(mail);
    if (!mail.isRead) {
      try {
        await apiRequest(`/comms/mail/${mail.id}/read`, "PATCH", session);
        setMessages(prev => (Array.isArray(prev) ? prev : []).map(m => m.id === mail.id ? { ...m, isRead: true } : m));
        await fetchCounts();
      } catch (e) {
        console.error("Failed to mark read:", e);
      }
    }
  };

  const handleToggleStar = async (e: React.MouseEvent, mailId: string) => {
    e.stopPropagation();
    try {
      await apiRequest(`/comms/mail/${mailId}/star`, "PATCH", session);
      setMessages(prev => (Array.isArray(prev) ? prev : []).map(m => m.id === mailId ? { ...m, isStarred: !m.isStarred } : m));
      if (selectedMail && selectedMail.id === mailId) {
        setSelectedMail({ ...selectedMail, isStarred: !selectedMail.isStarred });
      }
    } catch (e: any) {
      toast({ 
        title: "Action Failed", 
        description: e.message || "Failed to update star status.", 
        variant: "destructive" 
      });
    }
  };

  const handleDeleteMail = async (id: string) => {
    try {
      await apiRequest(`/comms/mail/${id}`, "DELETE", session);
      toast({ title: "Updated", description: "Message status updated." });
      setSelectedMail(null);
      fetchMessages();
    } catch (e: any) {
      toast({ 
        title: "Deletion Failed", 
        description: e.message || "Operation failed.", 
        variant: "destructive" 
      });
    }
  };

  const handleRestoreMail = async (id: string) => {
    try {
      await apiRequest(`/comms/mail/${id}/restore`, "PATCH", session);
      toast({ title: "Restored", description: "Message moved back to Inbox." });
      setSelectedMail(null);
      fetchMessages();
    } catch (e: any) {
      toast({ 
        title: "Restore Failed", 
        description: e.message || "Restore operation failed.", 
        variant: "destructive" 
      });
    }
  };

  const filteredMessages = (Array.isArray(messages) ? messages : []).filter(m => 
    m.subject?.toLowerCase().includes(filter.toLowerCase()) || 
    m.fromAddress?.toLowerCase().includes(filter.toLowerCase()) ||
    m.bodyText?.toLowerCase().includes(filter.toLowerCase())
  );

  const mainContent = (
    <TooltipProvider delayDuration={400}>
      <div className="flex flex-col h-full gap-6 p-6 overflow-hidden">
        {/* Top Action Bar */}
        <div className="flex justify-between items-center bg-white dark:bg-muted p-4 rounded-3xl shadow-sm border border-border">
          <div className="flex items-center gap-4 flex-1">
             <div className="relative w-full max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search in mail..." 
                  className="pl-12 h-11 bg-muted dark:bg-muted border-none rounded-2xl font-bold text-xs"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
             </div>
             <Button variant="ghost" size="icon" onClick={fetchMessages} className="rounded-xl h-11 w-11 shadow-none">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
             </Button>
          </div>
          <div className="flex items-center gap-4">
             {userAccount && (
                <Badge variant="outline" className="h-8 px-4 rounded-full border-primary bg-primary text-primary lowercase font-mono">
                   {userAccount.address}
                </Badge>
             )}
             <Button onClick={() => { setComposeData({to:"", subject:"", body:"", status: "sent"}); setIsComposeOpen(true); }} className="h-11 px-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg">
                <Plus className="h-4 w-4 mr-2" /> Compose
             </Button>
          </div>
        </div>

        <div className="flex-1 flex gap-6 overflow-hidden">
          {/* Sidebar */}
          <div className="w-56 flex flex-col gap-2">
            {[
              { id: 'inbox', icon: Inbox, label: "Inbox" },
              { id: 'sent', icon: Send, label: "Sent" },
              { id: 'drafts', icon: File, label: "Drafts" },
              { id: 'starred', icon: Star, label: "Starred" },
              { id: 'trash', icon: Trash2, label: "Trash" },
            ].map((item) => (
              <Button 
                key={item.id} 
                variant={activeFolder === item.id ? "secondary" : "ghost"}
                className={`w-full justify-start h-12 rounded-2xl px-5 font-black uppercase tracking-[0.2em] text-[10px] transition-all group ${activeFolder === item.id ? 'bg-primary text-primary' : 'text-muted-foreground hover:bg-white'}`}
                onClick={() => { setActiveFolder(item.id); setSelectedMail(null); }}
              >
                <item.icon className={`h-4 w-4 mr-4 transition-transform group-hover:scale-110 ${activeFolder === item.id ? 'text-primary' : ''}`} />
                {item.label}
              </Button>
            ))}
          </div>

          {/* Master-Detail Container */}
          <div className="flex-1 flex bg-white dark:bg-muted rounded-[2.5rem] border border-border overflow-hidden shadow-2xl relative min-h-0">
            {/* List Column */}
            <div className={`flex flex-col border-r border-border bg-muted transition-all duration-500 ${selectedMail ? 'w-[380px] shrink-0 opacity-100' : 'w-full'}`}>
              <div className="flex-1 overflow-y-auto scrollbar-hide py-2">
                {loading ? (
                  Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="p-5 border-b flex gap-4 animate-pulse">
                      <div className="h-10 w-10 bg-muted rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-muted w-1/4 rounded" />
                        <div className="h-3 bg-muted w-3/4 rounded" />
                      </div>
                    </div>
                  ))
                ) : filteredMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-20 py-24 text-center">
                    <Inbox className="h-16 w-16 mb-4" />
                    <h3 className="text-lg font-black uppercase tracking-widest">No Messages</h3>
                    <p className="text-[10px] font-bold">This folder is currently empty.</p>
                  </div>
                ) : (
                  (Array.isArray(filteredMessages) ? filteredMessages : []).map((msg) => (
                    <div 
                      key={msg.id} 
                      onClick={() => handleSelectMail(msg)}
                      className={`flex items-start gap-4 p-5 border-b border-border cursor-pointer transition-all hover:bg-muted dark:hover:bg-muted relative group ${selectedMail?.id === msg.id ? 'bg-primary dark:bg-primary ring-1 ring-inset ring-indigo-500/20' : ''} ${!msg.isRead ? 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary shadow-sm' : ''}`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-black text-xs ${!msg.isRead ? 'bg-primary text-white' : 'bg-muted dark:bg-muted text-muted-foreground'}`}>
                          {msg.fromAddress?.[0]?.toUpperCase() || 'S'}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={`h-6 w-6 rounded-md hover:scale-120 transition-all ${msg.isStarred ? 'text-warning' : 'text-muted-foreground opacity-0 group-hover:opacity-100'}`}
                          onClick={(e) => handleToggleStar(e, msg.id)}
                        >
                          <Star className={`h-3.5 w-3.5 ${msg.isStarred ? 'fill-amber-500' : ''}`} />
                        </Button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-[10px] uppercase font-black tracking-widest truncate ${!msg.isRead ? 'text-muted-foreground dark:text-white' : 'text-muted-foreground'}`}>
                            {activeFolder === 'sent' ? `To: ${msg.toAddresses?.[0] || 'Unknown'}` : (msg.fromAddress || 'System Correspondence')}
                          </span>
                          <span className="text-[9px] font-bold text-muted-foreground shrink-0 whitespace-nowrap ml-2">
                             {formatDate(msg.createdAt, "short")}
                          </span>
                        </div>
                        <h4 className={`text-sm truncate mb-0.5 ${!msg.isRead ? 'font-black text-muted-foreground dark:text-white' : 'font-bold text-muted-foreground dark:text-muted-foreground'}`}>{safeText(msg.subject)}</h4>
                        <p className="text-[11px] text-muted-foreground line-clamp-1 font-medium">{safeText(msg.bodyText)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Detail Column */}
            <div className={`flex-1 flex flex-col bg-white dark:bg-muted transition-all duration-300 relative ${!selectedMail ? 'hidden md:flex' : 'flex'}`}>
               {selectedMail ? (
                 <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-500 overflow-hidden">
                   <div className="p-6 border-b border-border flex justify-between items-center bg-white/80 dark:bg-muted backdrop-blur-md sticky top-0 z-10">
                      <div className="flex items-center gap-3">
                         <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setSelectedMail(null)}>
                            <ChevronRight className="h-5 w-5 rotate-180" />
                         </Button>
                         <div className="h-6 w-px bg-muted dark:bg-muted mx-2" />
                         <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-destructive dark:hover:bg-destructive hover:text-destructive" onClick={() => handleDeleteMail(selectedMail.id)}>
                            <Trash2 className="h-5 w-5" />
                         </Button>
                         {activeFolder === 'trash' && (
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-success dark:hover:bg-success hover:text-success" onClick={() => handleRestoreMail(selectedMail.id)}>
                               <RefreshCw className="h-5 w-5" />
                            </Button>
                         )}
                         <Button variant="ghost" size="icon" className={`h-10 w-10 rounded-xl ${selectedMail.isStarred ? 'text-warning' : ''}`} onClick={(e) => handleToggleStar(e, selectedMail.id)}>
                            <Star className={`h-5 w-5 ${selectedMail.isStarred ? 'fill-amber-500' : ''}`} />
                         </Button>
                      </div>
                      <div className="flex gap-2">
                         <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest" onClick={() => {
                            setComposeData({ to: selectedMail.fromAddress, subject: `RE: ${selectedMail.subject}`, body: `\n\n--- Original Message from ${selectedMail.fromAddress} ---\n${selectedMail.bodyText}`, status: "sent" });
                            setIsComposeOpen(true);
                         }}>
                            <Reply className="h-3.5 w-3.5 mr-2" /> Reply
                         </Button>
                      </div>
                   </div>

                   <div className="flex-1 overflow-y-auto p-10 space-y-8">
                      <div className="space-y-6">
                         <h2 className="text-4xl font-black tracking-tighter leading-none text-muted-foreground dark:text-white uppercase italic">{safeText(selectedMail.subject)}</h2>
                         <div className="flex items-center gap-4 py-4 border-y border-border">
                            <div className="h-12 w-12 rounded-[1.25rem] bg-primary flex items-center justify-center text-primary-foreground font-black text-xl shadow-lg shadow-primary/20">
                               {selectedMail.fromAddress?.[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1">
                               <div className="flex justify-between items-center">
                                  <span className="font-black text-sm uppercase tracking-widest text-muted-foreground dark:text-white">{safeText(selectedMail.fromAddress)}</span>
                                  <span className="text-[10px] font-black text-muted-foreground">{formatDateTime(selectedMail.createdAt)}</span>
                               </div>
                               <div className="text-[10px] font-bold text-muted-foreground mt-0.5">
                                  to {selectedMail.toAddresses?.join(', ')}
                                </div>
                            </div>
                         </div>
                      </div>

                      <div className="text-base text-muted-foreground dark:text-muted-foreground leading-relaxed font-medium whitespace-pre-wrap tracking-tight min-h-[300px]">
                         {safeText(selectedMail.bodyText)}
                      </div>

                      <div className="pt-10 border-t border-border flex gap-4 pb-12">
                         <Button onClick={() => {
                            setComposeData({ to: selectedMail.fromAddress, subject: `RE: ${selectedMail.subject}`, body: `\n\n--- Original Message ---\n${selectedMail.bodyText}`, status: "sent" });
                            setIsComposeOpen(true);
                         }} className="rounded-2xl h-14 px-8 bg-muted dark:bg-primary font-black uppercase tracking-widest text-[10px]">
                            Reply
                         </Button>
                         <Button variant="outline" className="rounded-2xl h-14 px-8 font-black uppercase tracking-widest text-[10px]" onClick={() => {
                            setComposeData({ to: "", subject: `FWD: ${selectedMail.subject}`, body: `\n\n--- Forwarded Message ---\n${selectedMail.bodyText}`, status: "sent" });
                            setIsComposeOpen(true);
                         }}>
                            Forward
                         </Button>
                      </div>
                   </div>
                 </div>
               ) : (
                 <div className="flex-1 flex flex-col items-center justify-center p-20 text-center bg-muted animate-in fade-in zoom-in-95 duration-1000">
                    <div className="h-24 w-24 rounded-[2.5rem] bg-white dark:bg-muted shadow-xl shadow-slate-200/50 dark:shadow-none flex items-center justify-center mb-8 opacity-40 border border-border">
                       <Inbox className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-widest text-muted-foreground">Message Intelligence</h2>
                    <p className="text-xs font-bold text-muted-foreground mt-2">Select correspondence from the queue to decrypt and view full payload.</p>
                 </div>
               )}
            </div>
          </div>
        </div>

        {/* Compose Modal */}
        <MailComposeModal
          isOpen={isComposeOpen}
          onClose={() => { setIsComposeOpen(false); setComposeData({ to: "", subject: "", body: "", status: "sent" }); }}
          defaultTo={composeData.to}
          defaultSubject={composeData.subject}
          defaultBody={composeData.body}
          onSuccess={() => fetchMessages()}
        />
      </div>
    </TooltipProvider>
  );

  return (
    <DepartmentWorkspaceLayout
      title="Mail Hub"
      subtitle="Encrypted organizational correspondence and secure tactical messaging."
      headerIcon={Mail}
      accentColor="indigo"
      engineName="COMMS_ENGINE"
      pulseLabel="Mail Pulse"
      pulseIcon={Activity}
      sections={SECTIONS}
      routeLabels={{}}
      basePath="/core/mail"
    >
      {mainContent}
    </DepartmentWorkspaceLayout>
  );
}
