import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { financeService } from "@/core/services/finance/financeService";
import { useSession } from "@/core/security/session";
import { Scale } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";

interface JVSettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  onSuccess: () => void;
}

export function JVSettlementDialog({ open, onOpenChange, profileId, onSuccess }: JVSettlementDialogProps) {
  const session = useSession();
  const { addNotification } = useNotifications();
  const [loading, setLoading] = useState(false);

  // Default to first of current month → today
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  const [form, setForm] = useState({
    period_start: firstOfMonth,
    period_end: today,
  });

  const handleGenerate = async () => {
    if (!profileId || !form.period_start || !form.period_end) return;
    setLoading(true);
    try {
      const result = await financeService.generateJVSettlement(session, {
        jv_profile_id: profileId,
        period_start: form.period_start,
        period_end: form.period_end,
      });
      addNotification({
        type: "success",
        title: "Settlement Generated",
        message: `Settlement for ${form.period_start} to ${form.period_end} created with ${result?.lines?.length || 0} participant lines.`,
      });
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      addNotification({
        type: "error",
        title: "Generation Failed",
        message: e?.message || "Could not generate settlement.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] glass-morphism border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Scale className="h-5 w-5" />
            Generate JV Settlement
          </DialogTitle>
          <DialogDescription>
            Calculate the net settlement for a period. This aggregates revenue allocations and expense burdens to determine who owes whom.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Period Start</Label>
              <Input
                type="date"
                value={form.period_start}
                onChange={e => setForm({ ...form, period_start: e.target.value })}
                className="bg-white/50"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Period End</Label>
              <Input
                type="date"
                value={form.period_end}
                onChange={e => setForm({ ...form, period_end: e.target.value })}
                className="bg-white/50"
              />
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Settlement includes:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Revenue allocations from shadow ledger (automatic journal-based)</li>
              <li>Approved JV expenses with their split allocations</li>
              <li>Cost burden mapping by category</li>
            </ul>
            <p className="mt-2">Net result = Revenue Share − Cost Burden − Expense Share</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleGenerate}
            disabled={loading || !form.period_start || !form.period_end}
            className="gap-2 shadow-lg shadow-primary/20"
          >
            <Scale className="h-4 w-4" />
            {loading ? "Generating..." : "Generate Settlement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
