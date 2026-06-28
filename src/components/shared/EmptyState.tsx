import React from "react";
import { 
  Database, 
  AlertCircle, 
  Lock, 
  RefreshCw,
  SearchX,
  FileQuestion
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmptyStateVariant = "no-data" | "error" | "restricted" | "not-found" | "search";

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
  actionLabel?: string;
}

export function EmptyState({
  variant = "no-data",
  title,
  description,
  onRetry,
  className,
  actionLabel = "Refresh Telemetry"
}: EmptyStateProps) {
  
  const config = {
    "no-data": {
      icon: Database,
      defaultTitle: "No Data Found",
      defaultDescription: "The requested dataset is currently empty. This might be due to a new tenant environment or missing historical records.",
      color: "text-muted-foreground",
      bg: "bg-muted dark:bg-muted"
    },
    "error": {
      icon: AlertCircle,
      defaultTitle: "Telemetry Link Failure",
      defaultDescription: "A neural synchronization error occurred. Please verify your connection to the core mainframe and try again.",
      color: "text-destructive",
      bg: "bg-destructive dark:bg-destructive"
    },
    "restricted": {
      icon: Lock,
      defaultTitle: "Access Restricted",
      defaultDescription: "Your current clearance level does not permit access to this module. Please contact your system administrator.",
      color: "text-warning",
      bg: "bg-warning dark:bg-warning"
    },
    "not-found": {
      icon: FileQuestion,
      defaultTitle: "Entity Not Found",
      defaultDescription: "The specified data object could not be located in the central registry.",
      color: "text-primary",
      bg: "bg-primary dark:bg-primary"
    },
    "search": {
      icon: SearchX,
      defaultTitle: "No Results",
      defaultDescription: "Your search parameters yielded no matches in the current index.",
      color: "text-muted-foreground",
      bg: "bg-muted dark:bg-muted"
    }
  }[variant];

  const Icon = config.icon;

  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-12 text-center rounded-[2.5rem] border border-dashed border-border dark:border-border transition-all duration-500",
      config.bg,
      className
    )}>
      <div className={cn(
        "h-20 w-20 rounded-[2rem] flex items-center justify-center mb-6 shadow-xl shadow-slate-200/20 dark:shadow-none",
        variant === "error" ? "bg-destructive dark:bg-destructive" : 
        variant === "restricted" ? "bg-warning dark:bg-warning" :
        "bg-card dark:bg-muted"
      )}>
        <Icon className={cn("h-10 w-10", config.color)} />
      </div>
      
      <h3 className="text-2xl font-black tracking-tight mb-2 text-muted-foreground dark:text-white uppercase">
        {title || config.defaultTitle}
      </h3>
      
      <p className="text-muted-foreground dark:text-muted-foreground max-w-md text-sm font-medium leading-relaxed mb-8">
        {description || config.defaultDescription}
      </p>

      {onRetry && (
        <Button 
          onClick={onRetry}
          variant="outline"
          className="rounded-xl h-12 px-6 font-black text-xs gap-2 border-border hover:bg-muted dark:border-border hover:scale-105 transition-all"
        >
          <RefreshCw className="h-4 w-4" />
          {actionLabel.toUpperCase()}
        </Button>
      )}
    </div>
  );
}
