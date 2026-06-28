import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApprovalStatusBadge } from "@/core/tools/ApprovalStatusBadge";
import {
  CreditCard, Send, CheckCircle2, Info, AlertTriangle,
} from "lucide-react";
import type { FinanceAlert } from "@/core/types/finance/assets";
import type { PaymentMethod } from "@/core/types/finance/payments";
import type { WorkflowRequest } from "@/core/tools/workflows/workflowTypes";

const PAYMENT_METHODS: PaymentMethod[] = [
  "BANK_TRANSFER", "QRIS", "GOPAY", "OVO", "DANA", "SHOPEEPAY", "CARD",
];

/* ─── Create Payment Dialog ─────────────────────────────────────── */
interface CreatePaymentProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isHighLevel: boolean;
  amount: string; setAmount: (v: string) => void;
  method: PaymentMethod; setMethod: (v: PaymentMethod) => void;
  destination: string; setDestination: (v: string) => void;
  purpose: string; setPurpose: (v: string) => void;
  source: string; setSource: (v: string) => void;
  department: string; setDepartment: (v: string) => void;
  extraInfo: string; setExtraInfo: (v: string) => void;
  moneySources: Array<{ id: string; name: string; currency: string }>;
  onSubmit: () => void;
}

export function CreatePaymentDialog({
  open, onOpenChange, isHighLevel,
  amount, setAmount, method, setMethod, destination, setDestination,
  purpose, setPurpose, source, setSource, department, setDepartment,
  extraInfo, setExtraInfo, moneySources, onSubmit,
}: CreatePaymentProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-3xl">
        <div className="grid md:grid-cols-[1fr_2fr]">
          {/* Left panel */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-800 p-10 flex flex-col justify-between">
            <div>
              <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6 border border-border">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <DialogTitle className="text-2xl font-black tracking-tighter text-white mb-3">
                {isHighLevel ? "Execute Payment" : "Request Payment"}
              </DialogTitle>
              <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                Initiate outgoing transfers to external beneficiaries, suppliers, or reimbursements.
              </p>
              <div className="mt-8 space-y-3">
                <div className="bg-white/5 border border-border p-4 rounded-2xl">
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1.5">Source Account</p>
                  <p className="font-bold text-white text-sm">
                    {source ? moneySources.find((s) => s.id === source)?.name : "Main Treasury"}
                  </p>
                </div>
                <div className="flex justify-center">
                  <div className="bg-white/10 border border-border rounded-full p-2.5">
                    <Send className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="bg-white/5 border border-border p-4 rounded-2xl">
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1.5">Authorization</p>
                  <p className="font-bold text-white text-sm flex items-center gap-2">
                    {isHighLevel
                      ? <><CheckCircle2 className="w-4 h-4 text-success" /> Direct Auth</>
                      : <><Info className="w-4 h-4 text-primary" /> Requires HOD Sign-off</>}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-primary/20 border border-primary/20 p-4 rounded-2xl mt-8">
              <p className="text-[10px] text-primary/80 font-black uppercase tracking-widest flex items-center gap-2">
                <Info className="w-3.5 h-3.5" /> Compliance Notice
              </p>
              <p className="text-xs font-medium text-muted-foreground mt-1.5 leading-relaxed">
                Ensure the purpose aligns with OPEX / CAPEX budgets.
              </p>
            </div>
          </div>

          {/* Right form */}
          <div className="p-10 bg-white">
            <div className="space-y-6">
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2.5 block">Payment Amount (IDR)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-black">Rp</span>
                  <Input className="pl-11 h-14 text-xl font-black rounded-2xl border-border"
                    value={amount} onChange={(e) => setAmount(e.target.value)}
                    placeholder="0" type="number" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2.5 block">Payment Method</label>
                  <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                    <SelectTrigger className="w-full h-12 rounded-2xl font-bold border-border"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {(Array.isArray(PAYMENT_METHODS) ? PAYMENT_METHODS : []).map((m) => (
                        <SelectItem key={m} value={m} className="font-bold">{m.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2.5 block">Funding Source</label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger className="w-full h-12 rounded-2xl font-bold border-border">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {(Array.isArray(moneySources) ? moneySources : []).map((ms) => (
                        <SelectItem key={ms.id} value={ms.id} className="font-bold">
                          {ms.name} ({ms.currency})
                        </SelectItem>
                      ))}
                      {!moneySources.length && <SelectItem value="none" disabled>No accounts available</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2.5 block">Beneficiary</label>
                  <Input value={destination} onChange={(e) => setDestination(e.target.value)}
                    placeholder="Name / Account No." className="h-12 rounded-2xl font-bold border-border" />
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2.5 block">Requesting Dept</label>
                  <Input value={department} onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. IT, HR, OPS" className="h-12 rounded-2xl font-bold border-border" />
                </div>
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2.5 block">Purpose of Payment</label>
                <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Justification aligned with budget..." rows={2}
                  className="resize-none rounded-2xl p-4 font-medium border-border" />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2.5 block">Extra Metadata (JSON)</label>
                <Textarea value={extraInfo} onChange={(e) => setExtraInfo(e.target.value)}
                  placeholder='{"invoiceId": "INV-1234"}' rows={2}
                  className="font-mono text-xs resize-none rounded-2xl p-4 border-border bg-muted" />
              </div>
              <div className="border-t border-border pt-5 flex justify-end gap-3">
                <Button onClick={() => onOpenChange(false)} variant="outline" className="h-12 rounded-2xl px-7 font-bold">Cancel</Button>
                <Button onClick={onSubmit} className="h-12 rounded-2xl px-7 gap-2 font-black shadow-lg shadow-primary/20">
                  <Send className="w-4 h-4" />
                  {isHighLevel ? "Execute Payment" : "Submit Request"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Workflow Detail Dialog ─────────────────────────────────────── */
interface WorkflowDetailProps {
  workflow: WorkflowRequest | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}
export function WorkflowDetailDialog({ workflow, onClose, onApprove, onReject }: WorkflowDetailProps) {
  return (
    <Dialog open={!!workflow} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-3xl p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black tracking-tighter">Workflow Detail</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          <div className="grid grid-cols-2 text-sm gap-y-4">
            <span className="text-muted-foreground font-semibold">Flow ID</span>
            <span className="font-mono font-bold bg-muted px-2 py-1 rounded-lg text-xs">{workflow?.id}</span>
            <span className="text-muted-foreground font-semibold">Entity</span>
            <span className="font-bold text-muted-foreground">{workflow?.entityType} | {workflow?.entityId}</span>
            <span className="text-muted-foreground font-semibold">Maker Dept</span>
            <span className="font-medium text-muted-foreground">{workflow?.makerDept}</span>
            <span className="text-muted-foreground font-semibold">Requested By</span>
            <span className="font-medium text-muted-foreground">{workflow?.requestedBy}</span>
            <span className="text-muted-foreground font-semibold">Status</span>
            <ApprovalStatusBadge status={workflow?.status || "PENDING"} />
          </div>
          <div className="border-t border-border pt-5">
            <p className="text-xs font-medium leading-relaxed text-muted-foreground bg-muted p-4 rounded-2xl">
              Automatically routed based on departmental thresholds. Verify supporting documentation if required.
            </p>
            {workflow?.status === "PENDING" && (
              <div className="mt-4 flex gap-3">
                <Button className="flex-1 h-12 rounded-2xl bg-success hover:bg-success font-black shadow-lg shadow-emerald-500/20"
                  onClick={() => { onApprove(workflow.id); onClose(); }}>
                  Approve
                </Button>
                <Button className="flex-1 h-12 rounded-2xl border border-destructive bg-destructive text-destructive hover:bg-destructive font-black" variant="outline"
                  onClick={() => { onReject(workflow.id); onClose(); }}>
                  Reject
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Alert Detail Dialog ────────────────────────────────────────── */
interface AlertDetailProps {
  alert: FinanceAlert | null;
  onClose: () => void;
}
export function AlertDetailDialog({ alert, onClose }: AlertDetailProps) {
  return (
    <Dialog open={!!alert} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-3xl p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black tracking-tighter">Operational Alert</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          <div className="rounded-2xl bg-destructive border border-destructive p-5 text-destructive">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <p className="font-black text-lg">{alert?.title}</p>
            </div>
            <p className="text-sm font-medium text-destructive">{alert?.description}</p>
          </div>
          <div className="grid grid-cols-2 text-sm gap-y-4">
            <span className="text-muted-foreground font-semibold">Severity</span>
            <span className="font-black uppercase text-muted-foreground">{alert?.severity}</span>
            <span className="text-muted-foreground font-semibold">Action</span>
            <span className="font-black text-primary bg-primary/10 px-3 py-1 rounded-xl w-fit text-xs">
              {alert?.action || "Review Required"}
            </span>
          </div>
          <div className="border-t border-border pt-4 text-center">
            <p className="text-xs font-medium text-muted-foreground">
              Triggered by automated treasury monitoring. Review linked accounts immediately.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
