import React from "react";
import { AlertCircle, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface ExceptionItem {
  type: string;
  msg: string;
  link: string;
}

interface ActionableExceptionsProps {
  exceptions: ExceptionItem[];
}

export const ActionableExceptions: React.FC<ActionableExceptionsProps> = ({
  exceptions,
}) => {
  const navigate = useNavigate();

  return (
    <Card className="rounded-2xl bg-card border-border shadow-xl overflow-hidden">
      <div className="p-8 pb-4 flex items-center justify-between border-b bg-secondary/5">
        <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest italic">
          Actionable Exceptions
        </div>
        <Badge
          variant="destructive"
          className="font-black italic text-[8px] tracking-widest cursor-pointer hover:bg-destructive"
        >
          {exceptions.length} URGENT
        </Badge>
      </div>
      <div className="p-6 space-y-4">
        {(Array.isArray(exceptions) ? exceptions : []).map((err, i) => (
          <div
            key={i}
            onClick={() => navigate(err.link)}
            className="p-4 rounded-2xl bg-secondary/5 border border-border flex items-center justify-between group cursor-pointer hover:bg-primary/5 hover:border-primary transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-warning" />
              </div>
              <div className="text-[10px] font-black italic text-muted-foreground uppercase tracking-tighter">
                {err.msg}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        ))}
      </div>
    </Card>
  );
};
