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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { financeService } from "@/core/services/finance/financeService";
import { useSession } from "@/core/security/session";
import { Receipt, Percent } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";

interface JVExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  onSuccess: () => void;
}

export function JVExpenseDialog({ open, onOpenChange, profileId, onSuccess }: JVExpenseDialogProps) {
  const session = useSession();
  const { addNotification } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    description: "",
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    split_method: "by_share",
    category_id: "",
    receipt_url: "",
  });

  const handleSubmit = async () => {
    if (!form.description || !form.amount || !profileId) return;
    setLoading(true);
    try {
      await financeService.createJVExpense(session, {
        jv_profile_id: profileId,
        description: form.description,
        amount: parseFloat(form.amount),
        expense_date: form.expense_date,
        split_method: form.split_method,
        category_id: form.category_id || undefined,
        receipt_url: form.receipt_url || undefined,
      });
      addNotification({
        type: "success",
        title: "Expense Submitted",
        message: `Expense "${form.description}" submitted for partner approval.`,
      });
      onOpenChange(false);
      onSuccess();
      setForm({
        description: "",
        amount: "",
        expense_date: new Date().toISOString().split("T")[0],
        split_method: "by_share",
        category_id: "",
        receipt_url: "",
      });
    } catch (e: any) {
      addNotification({
        type: "error",
        title: "Submission Failed",
        message: e?.message || "Could not submit expense.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] glass-morphism border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Receipt className="h-5 w-5" />
            Log JV Expense
          </DialogTitle>
          <DialogDescription>
            Submit a shared expense against this Joint Venture. The counterparty must approve before allocation.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</Label>
            <Textarea
              placeholder="e.g., Monthly office rent for shared branch"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="bg-muted0 min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount (IDR)</Label>
              <Input
                type="number"
                placeholder="5000000"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                className="bg-muted0"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Expense Date</Label>
              <Input
                type="date"
                value={form.expense_date}
                onChange={e => setForm({ ...form, expense_date: e.target.value })}
                className="bg-muted0"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Split Method</Label>
            <Select value={form.split_method} onValueChange={v => setForm({ ...form, split_method: v })}>
              <SelectTrigger className="bg-muted0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="by_share">By Profit Share % (uses participant %)</SelectItem>
                <SelectItem value="equal">Equal Split (50/50 or equal parts)</SelectItem>
                <SelectItem value="category_burden">By Cost Category Mapping</SelectItem>
                <SelectItem value="custom">Custom Split</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              "By Share" uses each participant's profit_share_pct. "Equal" divides evenly among all parties.
            </p>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Receipt URL (optional)</Label>
            <Input
              placeholder="https://storage.example.com/receipt.pdf"
              value={form.receipt_url}
              onChange={e => setForm({ ...form, receipt_url: e.target.value })}
              className="bg-muted0"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !form.description || !form.amount}
            className="gap-2 shadow-lg shadow-primary/20"
          >
            <Receipt className="h-4 w-4" />
            {loading ? "Submitting..." : "Submit Expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
