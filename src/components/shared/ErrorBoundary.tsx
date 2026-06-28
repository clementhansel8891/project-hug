import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in Zenvix Runtime:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-[400px] p-8 space-y-8 animate-in fade-in duration-700 bg-muted dark:bg-muted rounded-[3rem] border border-border dark:border-border shadow-2xl m-8">
            <div className="relative">
              <div className="h-24 w-24 bg-destructive rounded-[2.5rem] flex items-center justify-center animate-pulse">
                <ShieldAlert className="h-12 w-12 text-destructive" />
              </div>
              <div className="absolute -top-2 -right-2 h-8 w-8 bg-card dark:bg-muted rounded-full flex items-center justify-center shadow-lg border border-border dark:border-border">
                <AlertTriangle className="h-4 w-4 text-warning" />
              </div>
            </div>

            <div className="text-center space-y-3 max-w-md">
              <h2 className="text-3xl font-black tracking-tighter uppercase italic text-muted-foreground dark:text-white leading-none">
                Runtime Exception
              </h2>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] leading-relaxed italic">
                A critical logic branch has failed in the current module.
              </p>
              <div className="mt-4 p-4 rounded-2xl bg-muted dark:bg-muted border border-border dark:border-border overflow-hidden">
                <p className="text-[10px] font-mono text-destructive truncate">
                  {this.state.error?.message || "Unknown internal error"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button
                onClick={this.handleReset}
                className="rounded-2xl bg-primary hover:bg-primary text-white font-black text-[10px] uppercase tracking-widest px-8 h-12 shadow-xl shadow-indigo-500/20 gap-2 transition-all active:scale-95"
              >
                <RefreshCcw className="h-4 w-4" /> Reset Environment
              </Button>
              <Button
                variant="outline"
                onClick={() => (window.location.href = "/core/dashboard")}
                className="rounded-2xl border-border dark:border-border font-black text-[10px] uppercase tracking-widest px-8 h-12 transition-all active:scale-95"
              >
                Return to Command
              </Button>
            </div>

            <div className="pt-4 flex items-center gap-2">
               <div className="h-1 w-1 rounded-full bg-destructive" />
               <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Diagnostic Data captured for Audit</span>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
