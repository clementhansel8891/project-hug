import { useEffect, useState, useRef, useCallback } from "react";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { useSession } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Send,
  Users,
  Search,
  User as UserIcon,
  Circle,
  MoreVertical,
  Plus,
  Loader2,
  Lock,
  Radio,
  Activity,
  Megaphone,
  FileText
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTime, safeText } from "@/lib/format";
import DepartmentWorkspaceLayout from "@/components/layouts/DepartmentWorkspaceLayout";
import { ChatCreateModal } from "./modals/ChatCreateModal";

const SECTIONS = [
  {
    title: "COMMUNICATION",
    items: [
      { id: 'bulletin', icon: Megaphone, label: "Bulletin Board", to: "/core/comms/bulletin" },
      { id: 'chat', icon: MessageSquare, label: "Live Chat", to: "/core/comms/chat" },
      { id: 'mail', icon: Send, label: "Secure Mail", to: "/core/comms/mail" },
    ]
  },
  {
    title: "CONTENT",
    items: [
      { id: 'broadcast', icon: Radio, label: "Broadcasts", to: "/core/comms/broadcast" },
      { id: 'docs', icon: FileText, label: "Internal Docs", to: "/core/comms/docs" },
    ]
  }
];

interface ChatMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  channelId?: string;
}

interface ChatChannel {
  id: string;
  name: string;
  type: "PUBLIC" | "PRIVATE";
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

export default function ChatHub() {
  const session = useSession();
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchChannels = useCallback(async () => {
    try {
      const data = await apiRequest<ChatChannel[]>("/comms/chat/channels", "GET", session);
      setChannels(data || []);
      if (data && data.length > 0 && !activeChannel) {
        setActiveChannel(data[0]);
      }
    } catch (error: any) {
      console.error("Failed to fetch channels:", error);
    } finally {
      setLoading(false);
    }
  }, [session, activeChannel]);

  const fetchMessages = useCallback(async (channelId: string) => {
    setMsgLoading(true);
    try {
      const data = await apiRequest<ChatMessage[]>(`/comms/chat/channels/${channelId}/messages`, "GET", session);
      setMessages(data || []);
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (error: any) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setMsgLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  useEffect(() => {
    if (activeChannel) {
      fetchMessages(activeChannel.id);
      const interval = setInterval(() => fetchMessages(activeChannel.id), 5000);
      return () => clearInterval(interval);
    }
  }, [activeChannel, fetchMessages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeChannel) return;
    const body = newMessage;
    setNewMessage("");

    try {
      const sent = await apiRequest<ChatMessage>(`/comms/chat/channels/${activeChannel.id}/messages`, "POST", session, { body });
      setMessages((prev) => [...prev, sent]);
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (error: any) {
      toast({
        title: "Transmission Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const headerActions = (
    <div className="flex gap-2">
      <Button
        variant="outline"
        className="rounded-xl bg-card shadow-sm hover:bg-muted font-bold text-[10px] uppercase tracking-widest h-9"
        onClick={() => setIsCreateGroupOpen(true)}
      >
        <Plus className="h-3 w-3 mr-2" /> New Group
      </Button>
    </div>
  );

  const mainContent = (
    <div className="flex h-[calc(100vh-140px)] overflow-hidden bg-muted dark:bg-muted rounded-[2.5rem] border border-border/50 dark:border-border/50 m-6">
      {/* Sidebar - Channels */}
      <div className="w-80 border-r border-border/50 dark:border-border/50 flex flex-col bg-card dark:bg-muted backdrop-blur-xl">
        <div className="p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter transmissions..."
              className="pl-9 h-11 bg-muted dark:bg-muted border-none rounded-xl text-xs font-bold"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1 px-3">
          <div className="space-y-1 pb-6">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-muted dark:bg-muted animate-pulse mx-3" />
              ))
            ) : channels.length === 0 ? (
              <div className="p-12 text-center opacity-40">
                <Radio className="h-8 w-8 mx-auto mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest">No Active Channels</p>
              </div>
            ) : (
              channels
                .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
                .map((channel) => (
                  <div
                    key={channel.id}
                    onClick={() => setActiveChannel(channel)}
                    className={`p-4 rounded-2xl cursor-pointer transition-all flex items-center gap-4 group ${activeChannel?.id === channel.id ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'hover:bg-muted dark:hover:bg-muted'}`}
                  >
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${activeChannel?.id === channel.id ? 'bg-background/20' : 'bg-primary/10 text-primary'}`}>
                      {channel.type === "PRIVATE" ? <Lock className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[11px] font-black uppercase tracking-widest truncate">{channel.name}</span>
                        {channel.unreadCount ? (
                          <Badge className="h-4 min-w-[1rem] p-0 flex items-center justify-center bg-destructive text-[9px] font-black rounded-full border-none">
                            {channel.unreadCount}
                          </Badge>
                        ) : (
                          <span className="text-[9px] font-bold opacity-40">12:45</span>
                        )}
                      </div>
                      <p className={`text-[10px] truncate font-medium ${activeChannel?.id === channel.id ? 'text-white/70' : 'text-muted-foreground'}`}>
                        {channel.lastMessage || "Standby for incoming..."}
                      </p>
                    </div>
                  </div>
                ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-card dark:bg-muted backdrop-blur-sm relative">
        {!activeChannel ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-20">
            <MessageSquare className="h-24 w-24 mb-6 stroke-[1]" />
            <h3 className="text-xl font-black uppercase tracking-[0.3em]">Encrypted Terminal</h3>
            <p className="text-[10px] font-bold mt-2">Select a frequency to begin transmission</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-6 border-b border-border/50 dark:border-border/50 flex justify-between items-center bg-muted0 dark:bg-muted backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                  {activeChannel.type === "PRIVATE" ? <Lock className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest leading-tight">{activeChannel.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Circle className="h-2 w-2 fill-success text-success" />
                    <span className="text-[9px] font-black text-success uppercase tracking-tighter">Transmission Stable</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-muted-foreground hover:text-muted-foreground"><MoreVertical className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-8">
              <div className="space-y-8 max-w-4xl mx-auto pb-8">
                {msgLoading && messages.length === 0 ? (
                  <div className="flex justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-24 text-center opacity-20">
                    <Radio className="h-12 w-12 mx-auto mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">No previous logs on this frequency</p>
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isMe = msg.senderId === session?.user?.id;
                    return (
                      <div key={msg.id} className={`flex gap-4 group ${isMe ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                        <div className={`h-10 w-10 rounded-xl shrink-0 flex items-center justify-center font-black text-xs ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          {safeText(msg.senderId?.[0]?.toUpperCase())}
                        </div>
                        <div className={`max-w-[70%] space-y-2 ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                            <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">@{safeText(msg.senderId?.split("-")[0])}</span>
                            <span className="text-[9px] font-bold text-muted-foreground">{formatDateTime(msg.createdAt)}</span>
                          </div>
                          <div className={`p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-card border border-border rounded-tl-none'}`}>
                            {safeText(msg.body)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-8 border-t border-border/50 dark:border-border/50 bg-muted0 dark:bg-muted backdrop-blur-md">
              <div className="max-w-4xl mx-auto flex gap-4">
                <div className="relative flex-1 group">
                  <Input
                    placeholder="Enter transmission content..."
                    className="h-14 bg-muted dark:bg-muted border-none rounded-2xl px-6 text-sm font-bold shadow-inner focus-visible:ring-1 focus-visible:ring-primary/20 pr-16"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="icon" 
                            className={`h-10 w-10 rounded-xl bg-primary shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all ${!newMessage.trim() ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim()}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-popover text-popover-foreground border-none font-black text-[9px] uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-2xl">Execute Transmission</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
    <DepartmentWorkspaceLayout
      title="Secure Terminal"
      subtitle="Operational live chat and secure peer-to-peer transmissions."
      headerIcon={MessageSquare}
      accentColor="blue"
      engineName="COMMS_ENGINE"
      pulseLabel="Chat Pulse"
      pulseIcon={Activity}
      sections={SECTIONS}
      routeLabels={{}}
      basePath="/core/comms/chat"
      headerActions={headerActions}
    >
      {mainContent}
    </DepartmentWorkspaceLayout>

    <ChatCreateModal
      isOpen={isCreateGroupOpen}
      onClose={() => setIsCreateGroupOpen(false)}
      onSuccess={() => fetchChannels()}
    />
    </>
  );
}
