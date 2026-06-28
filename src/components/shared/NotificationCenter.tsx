import React from 'react';
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Info, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink
} from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export function NotificationCenter() {
  const { notifications, unreadCounts, markAsRead, markAllAsRead } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl hover:bg-muted dark:hover:bg-muted transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground dark:text-muted-foreground" />
          {unreadCounts.notifications > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 bg-destructive text-[10px] font-black text-white rounded-full border-2 border-white dark:border-border flex items-center justify-center animate-in zoom-in">
              {unreadCounts.notifications > 9 ? '9+' : unreadCounts.notifications}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 border-none shadow-3xl bg-card dark:bg-muted rounded-3xl overflow-hidden" align="end">
        <div className="bg-muted p-6 text-white border-b border-border">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-black text-xs uppercase tracking-[0.2em] opacity-60">Intelligence Hub</h3>
            <Badge variant="outline" className="text-[9px] font-black uppercase text-primary border-primary bg-primary">
              {unreadCounts.notifications} Pending
            </Badge>
          </div>
          <p className="text-xl font-black tracking-tighter uppercase italic">Global Alerts</p>
        </div>

        <div className="bg-card dark:bg-muted border-b dark:border-border flex px-6 py-3 justify-between items-center">
            <div className="flex gap-4">
                <div className="flex flex-col items-center">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Mail</span>
                    <span className="text-xs font-black text-muted-foreground dark:text-white mt-0.5">{unreadCounts.mail}</span>
                </div>
                <div className="w-px h-8 bg-muted dark:bg-muted" />
                <div className="flex flex-col items-center">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Chat</span>
                    <span className="text-xs font-black text-muted-foreground dark:text-white mt-0.5">{unreadCounts.chat}</span>
                </div>
            </div>
            <Button variant="ghost" size="sm" className="h-8 text-[9px] font-black uppercase tracking-[0.1em] text-primary hover:bg-primary dark:hover:bg-primary" onClick={markAllAsRead}>
                Acknowledge All
            </Button>
        </div>

        <ScrollArea className="h-[400px]">
          {notifications.length > 0 ? (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {(Array.isArray(notifications) ? notifications : []).map((notif) => (
                <div 
                  key={notif.id} 
                  className={cn(
                    "p-5 hover:bg-muted dark:hover:bg-muted transition-colors group relative cursor-pointer",
                    !notif.isRead && "before:absolute before:left-0 before:top-4 before:bottom-4 before:w-1 before:bg-primary before:rounded-r-full"
                  )}
                  onClick={() => !notif.isRead && markAsRead(notif.id)}
                >
                  <div className="flex gap-4">
                    <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                        notif.type === 'ALERT' ? 'bg-destructive dark:bg-destructive text-destructive' : 'bg-primary dark:bg-primary text-primary'
                    )}>
                        {notif.type === 'CHAT' ? <MessageSquare className="h-5 w-5" /> : 
                         notif.type === 'MAIL' ? <Mail className="h-5 w-5" /> :
                         notif.type === 'ALERT' ? <AlertTriangle className="h-5 w-5" /> :
                         <Info className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <span className="font-black text-[9px] uppercase tracking-widest text-muted-foreground">{notif.type}</span>
                        <span className="text-[8px] font-bold text-muted-foreground">
                          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-muted-foreground dark:text-white tracking-tight leading-tight">{notif.title}</h4>
                      <p className="text-[11px] text-muted-foreground dark:text-muted-foreground font-medium mt-1 line-clamp-2">{notif.message}</p>
                      
                      {notif.link && (
                          <div className="mt-3 flex gap-2">
                              <Button variant="outline" size="sm" className="h-7 rounded-lg text-[9px] font-black uppercase tracking-widest px-3 border-border dark:border-border hover:bg-muted dark:hover:bg-muted">
                                  Access Payload <ExternalLink className="ml-2 h-3 w-3" />
                              </Button>
                          </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[300px] flex flex-col items-center justify-center p-10 text-center space-y-4">
              <div className="h-20 w-20 bg-muted dark:bg-muted rounded-[2rem] flex items-center justify-center shadow-inner">
                <CheckCircle2 className="h-10 w-10 text-muted-foreground dark:text-muted-foreground" />
              </div>
              <div>
                <p className="font-black text-xs uppercase tracking-[0.2em] text-muted-foreground">Operational Silence</p>
                <p className="text-[10px] font-bold text-muted-foreground mt-1 italic">No pending transmissions detected.</p>
              </div>
            </div>
          )}
        </ScrollArea>
        
        <div className="p-4 border-t dark:border-border bg-muted dark:bg-muted">
            <Button variant="ghost" className="w-full h-10 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-muted-foreground dark:hover:text-white transition-colors">
                Archive Log
            </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
