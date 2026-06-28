import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, User, ArrowRight, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface WorkflowItem {
  id: string;
  type: string;
  title: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  assignee?: string;
  timeElapsed: string;
}

interface WorkflowPipelineProps {
  data: WorkflowItem[];
}

export const WorkflowPipeline: React.FC<WorkflowPipelineProps> = ({ data = [] }) => {
  const navigate = useNavigate();

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-warning-foreground bg-warning border-warning/20';
      case 'IN_PROGRESS': return 'text-primary-foreground bg-primary border-primary';
      case 'COMPLETED': return 'text-success-foreground bg-success border-success/20';
      default: return 'text-destructive-foreground bg-destructive border-destructive/20';
    }
  };

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border bg-card p-8 shadow-2xl transition-all duration-500 hover:shadow-indigo-500/10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground border border-border group-hover:text-foreground transition-colors">
            <GitBranch className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-[0.15em] text-foreground">Operational Pipeline</h4>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Active multi-step business processes</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/core/workflow')}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-all"
          title="Go to Workflow Inbox"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        {data.length > 0 ? (
          data.map((item, i) => (
            <div key={i} className="group relative flex items-center gap-4 rounded-2xl border border-border bg-white/2 p-4 transition-all hover:bg-muted cursor-pointer">
              <div className={cn("h-12 w-1 rounded-full", item.status === 'PENDING' ? 'bg-warning' : 'bg-primary')} />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">{item.type}</span>
                  <div className={cn("rounded-full px-2 py-0.5 text-[8px] font-black border tracking-widest uppercase", getStatusStyle(item.status))}>
                    {item.status}
                  </div>
                </div>
                <p className="text-xs font-black text-foreground">{item.title}</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground">
                    <Clock className="h-3 w-3" /> {item.timeElapsed}
                  </div>
                  {item.assignee && (
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground">
                      <User className="h-3 w-3" /> {item.assignee}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-4 opacity-40">
             <div className="h-16 w-16 rounded-3xl bg-muted flex items-center justify-center border border-border">
                <Clock className="h-8 w-8 text-muted-foreground" />
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">No active processes</p>
          </div>
        )}
      </div>

      <button 
        className="mt-6 w-full py-4 rounded-2xl border border-border bg-muted text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:bg-primary hover:text-foreground hover:border-primary transition-all active:scale-[0.98]"
        onClick={() => navigate('/core/workflow')}
      >
        ACCESS CONTROL CENTER
      </button>
    </div>
  );
};
