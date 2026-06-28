import type React from "react";
import { cn } from "@/lib/utils";

interface WorkspacePanelProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  variant?: 'default' | 'glass' | 'dark';
}

export function WorkspacePanel({
  title,
  description,
  className,
  children,
  action,
  variant = 'default',
  ...props
}: WorkspacePanelProps) {
  const variantClasses = {
    default: "bg-background",
    glass: "bg-white/80 backdrop-blur-xl border-border shadow-xl",
    dark: "bg-muted text-muted-foreground border-border"
  };

  return (
    <section 
      className={cn(
        "rounded-2xl border p-5 shadow-sm transition-all duration-300", 
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {(title || description || action) && (
        <div className="mb-4 flex items-center justify-between">
          <div className="space-y-1">
            {title ? (
              <p className={cn(
                "text-sm font-semibold",
                variant === 'dark' ? "text-muted-foreground" : "text-foreground"
              )}>{title}</p>
            ) : null}
            {description ? (
              <p className={cn(
                "text-xs",
                variant === 'dark' ? "text-muted-foreground" : "text-muted-foreground"
              )}>{description}</p>
            ) : null}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export default WorkspacePanel;
