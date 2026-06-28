/**
 * AuditTrailModal — Read-only audit trail viewer with useQuery for data fetching.
 *
 * This is a read-only modal (no form submission), but wired with:
 * 1. useQuery for fetching audit trail data from the API
 * 2. Loading/error states for data fetching
 * 3. Proper accessibility: aria-labelledby, focus trap (via Dialog)
 * 4. Cache-aware: uses query keys for automatic refresh
 *
 * Since this is read-only, it uses useQuery rather than useMutation.
 * The wiring pattern is adapted: apiRequest for data fetching + loading states.
 *
 * Requirements: 4 (Loading State), 5 (Error Handling), 8 (Accessibility),
 *               10 (Consistent Pattern)
 */

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Clock, ShieldCheck, User, Loader2, AlertCircle } from "lucide-react";
import { useSession } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import type { AuditEntry } from "../types/governance";

// ─── Props ──────────────────────────────────────────────────────────────────────

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  promoId?: string;
  promoTitle: string;
  /** Optionally pass audit log directly if already loaded */
  auditLog?: AuditEntry[];
}

// ─── Component ──────────────────────────────────────────────────────────────────

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({
  isOpen,
  onClose,
  promoId,
  promoTitle,
  auditLog: externalAuditLog,
}) => {
  const session = useSession();

  // Fetch audit trail from API if not passed externally
  const { data: fetchedAuditLog, isLoading, error } = useQuery({
    queryKey: ["retail", "audit-trail", promoId],
    queryFn: () =>
      apiRequest<AuditEntry[]>(
        `/v1/retail/promotions/${promoId}/audit-trail`,
        "GET",
        session
      ),
    enabled: isOpen && !!promoId && !externalAuditLog,
    staleTime: 30_000,
  });

  const auditLog = externalAuditLog ?? fetchedAuditLog ?? [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl bg-secondary border-border p-8 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
        <DialogHeader className="mb-8">
          <DialogTitle className="text-xl font-black italic tracking-tighter flex items-center gap-3 text-foreground">
            <div className="p-2.5 rounded-2xl bg-primary/20 text-primary">
              <ShieldCheck className="w-6 h-6" />
            </div>
            IMMUTABLE LEDGER: {promoTitle.toUpperCase()}
          </DialogTitle>
          <div className="text-[10px] font-black text-primary uppercase tracking-widest mt-2 pl-14">
            Cryptographic Version History
          </div>
        </DialogHeader>

        <ScrollArea className="h-[450px] pr-6">
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-3 text-sm font-bold text-muted-foreground italic">Loading audit trail...</span>
            </div>
          )}

          {error && !isLoading && (
            <div className="flex items-center justify-center py-20 gap-3">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <span className="text-sm font-bold text-destructive italic">
                Failed to load audit trail.
              </span>
            </div>
          )}

          {!isLoading && !error && (
            <div className="space-y-6">
              {auditLog.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground font-black italic uppercase text-xs tracking-widest">
                  No governance events recorded yet.
                </div>
              ) : (
                <div className="relative border-l-2 border-border pl-8 ml-4 space-y-10 pb-4">
                  {(Array.isArray(auditLog) ? auditLog : []).map((entry) => (
                    <div key={entry.id} className="relative group">
                      <div className="absolute -left-[41px] top-1.5 w-4 h-4 rounded-full bg-secondary/60 border-[3px] border-border group-hover:bg-primary group-hover:shadow-[0_0_15px_rgba(59,130,246,0.6)] transition-all z-10" />

                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-4">
                          <Badge className="bg-secondary/60 text-foreground font-black italic text-[9px] uppercase border-none px-2 rounded-lg">
                            V{entry.version}.0
                          </Badge>
                          <span className="text-xs font-black italic tracking-widest text-foreground uppercase">
                            {entry.action}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest bg-secondary/60 px-3 py-1 rounded-full">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {new Date(entry.timestamp).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </div>
                      </div>

                      <div className="bg-secondary/60 hover:bg-secondary/60 transition-colors p-5 rounded-xl border border-white/5 space-y-4">
                        <p className="text-[11px] font-medium text-muted-foreground leading-relaxed italic">
                          &ldquo;{entry.details}&rdquo;
                        </p>

                        <div className="flex items-center gap-6 text-[9px] font-black uppercase tracking-widest text-muted-foreground border-t border-white/5 pt-4 mt-2">
                          <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg">
                            <User className="w-3 h-3 text-success" />
                            <span className="text-success/80">
                              {entry.actor}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg">
                            <ShieldCheck className="w-3 h-3 text-primary" />
                            <span className="text-primary">{entry.role}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
