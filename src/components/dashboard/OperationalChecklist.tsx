import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ClipboardCheck, Target, ListTodo } from 'lucide-react';

export const OperationalChecklist: React.FC = () => {
  const [items, setItems] = React.useState([
    { id: '1', label: 'Verify Nightly Backup Integrity', completed: true },
    { id: '2', label: 'Review Pending Staff Leave Requests', completed: false },
    { id: '3', label: 'Sync Retail Inventory with Master Ledger', completed: false },
    { id: '4', label: 'Audit High-Value Transactions (> Rp 150jt)', completed: false },
    { id: '5', label: 'Monitor IoT Sensor Gateway Latency', completed: true },
  ]);

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const completedCount = items.filter(i => i.completed).length;
  const progress = (completedCount / items.length) * 100;

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border bg-card p-8 shadow-2xl transition-all duration-500 hover:shadow-indigo-500/10 group overflow-hidden relative">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success text-success-foreground border border-success/20">
            <ListTodo className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-[0.15em] text-foreground">Daily Checklist</h4>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Mission-critical tasks for oversight</p>
          </div>
        </div>
        <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center border border-border">
           <Target className="h-5 w-5 text-primary opacity-50" />
        </div>
      </div>

      <div className="mb-8 space-y-3 px-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Execution Progress</span>
          <span className="text-sm font-black text-foreground">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted border border-border">
          <div 
            className="h-full bg-primary transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
            style={{ width: `${progress}%` }} 
          />
        </div>
      </div>

      <div className="space-y-5">
        {items.map((item) => (
          <div 
            key={item.id} 
            className={cn(
              "group/item flex items-center gap-4 rounded-2xl border border-transparent p-2 transition-all hover:bg-muted",
              item.completed && "opacity-50"
            )}
          >
            <div className="relative">
              <Checkbox 
                id={item.id} 
                checked={item.completed} 
                onCheckedChange={() => toggleItem(item.id)}
                className="h-6 w-6 rounded-lg border-border bg-card data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all"
              />
            </div>
            <label 
              htmlFor={item.id} 
              className={cn(
                "cursor-pointer text-xs font-black transition-all tracking-tight",
                item.completed ? "text-muted-foreground line-through" : "text-muted-foreground group-hover/item:text-foreground"
              )}
            >
              {item.label}
            </label>
          </div>
        ))}
      </div>
      
      {/* Subtle corner glow */}
      <div className="absolute -bottom-16 -right-16 h-32 w-32 bg-primary blur-[60px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
    </div>
  );
};
