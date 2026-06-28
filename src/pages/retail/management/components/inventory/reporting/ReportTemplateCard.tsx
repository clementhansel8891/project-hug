import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ReportTemplate } from "./ReportingHubTypes";

interface ReportTemplateCardProps {
  template: ReportTemplate;
  isActive: boolean;
  onClick: () => void;
}

export const ReportTemplateCard: React.FC<ReportTemplateCardProps> = ({
  template,
  isActive,
  onClick,
}) => {
  const Icon = template.icon;

  return (
    <Card
      onClick={onClick}
      className={cn(
        "rounded-[2rem] border-2 cursor-pointer transition-all p-6 group relative overflow-hidden h-[320px] flex flex-col justify-between backdrop-blur-xl",
        isActive
          ? "border-primary/50 bg-primary/10 shadow-[0_32px_80px_-20px_rgba(99,102,241,0.25)] ring-4 ring-primary/10"
          : "border-border bg-card hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1",
      )}
    >
      {/* Decorative Elements */}
      <div
        className={cn(
          "absolute -right-12 -bottom-12 w-48 h-48 opacity-[0.03] transition-transform duration-1000 group-hover:scale-125 group-hover:-rotate-12",
          isActive ? "text-primary opacity-[0.08]" : "text-primary-foreground",
        )}
      >
        <Icon className="w-full h-full" />
      </div>

      <div>
        <div
          className={cn(
            "w-16 h-16 rounded-[2rem] flex items-center justify-center mb-8 transition-all duration-500 group-hover:rotate-12",
            isActive
              ? "bg-primary text-foreground shadow-2xl shadow-indigo-200"
              : "bg-secondary/5 text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary",
          )}
        >
          <Icon className="w-8 h-8" />
        </div>

        <div className="space-y-3 relative z-10">
          <div className="flex items-center gap-3">
            <h3
              className={cn(
                "text-2xl font-black italic uppercase tracking-tighter leading-tight",
                isActive ? "text-foreground" : "text-foreground/80",
              )}
            >
              {template.label}
            </h3>
            {isActive && (
              <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
            )}
          </div>
          <p className="text-sm text-muted-foreground font-medium leading-relaxed max-w-[90%] italic">
            {template.description}
          </p>
        </div>
      </div>

      <div className="flex justify-between items-end relative z-10 mt-6">
        <Badge
          className={cn(
            "rounded-2xl text-[10px] font-black italic uppercase tracking-widest px-4 py-1.5 border-none shadow-sm transition-all duration-500",
            isActive
              ? "bg-primary text-foreground"
              : "bg-secondary/10 text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary",
          )}
        >
          {isActive ? "Configuring..." : "Access Report"}
        </Badge>
        {isActive && (
          <div className="flex -space-x-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full border-4 border-background bg-white/10"
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
