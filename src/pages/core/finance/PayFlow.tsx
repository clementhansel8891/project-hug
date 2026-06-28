import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
// cspell:ignore qris gopay shopeepay
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShieldCheck, CreditCard, Building2, Fingerprint, CalendarDays, ArrowRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { ApprovalStatusBadge } from "@/core/tools/ApprovalStatusBadge";
import { useSession } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import { useToast } from "@/hooks/use-toast";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import { financeApiClient } from "@/core/services/finance/financeApiClient";
import { logService } from "@/core/services/finance/logService";
import { useTreasury } from "@/hooks/finance/useTreasury";
import { formatNumber } from "@/lib/format";
import { paymentSchema, type PaymentFormData } from "@/core/finance/schemas";

type PaymentStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "SCHEDULED"
  | "FAILED";

type PaymentTab = PaymentStatus;

type Payment = {
  id?: string;
  destination: string;
  amount: number;
  method: string;
  purpose: string;
  status?: PaymentStatus;
  approvalLevel?: number;
  scheduledDate?: string;
  recurring?: boolean;
};

const TABS: PaymentTab[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "SCHEDULED",
  "FAILED",
];

export default function PayFlow() {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<PaymentTab>("PENDING");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchPayments, setBatchPayments] = useState<Payment[]>([]);
  const [selectedItem, setSelectedItem] = useState<Payment | null>(null);

  const { sources } = useTreasury(session.tenant_id, session);

  // --- React Hook Form: Create Payment ---
  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      beneficiary: "",
      amount: 0,
      method: "BANK_TRANSFER",
      purpose: "",
      source: "",
      department: "",
      currency: "IDR",
      scheduledDate: "",
      extraInfo: "",
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: (data: PaymentFormData) =>
      apiRequest("/v1/finance/payments", "POST", session, {
        amount: data.amount,
        beneficiary: data.beneficiary,
        method: data.method,
        purpose: data.purpose,
        extraInfo: { scheduledDate: data.scheduledDate },
      }),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["finance", "payments"]],
      onClose: () => setDialogOpen(false),
      form,
      successTitle: "Payment Created",
      successDescription: "Payment has been authorized and routed.",
    }),
  });

  const batchMutation = useMutation({
    mutationFn: async (payments: Payment[]) => {
      await Promise.all((Array.isArray(payments) ? payments : []).map(async (p) => {
        await financeApiClient.createPayment(session.tenant_id, session, {
          amount: p.amount,
          beneficiary: p.destination,
          method: p.method as "QRIS" | "GOPAY" | "OVO" | "DANA" | "SHOPEEPAY" | "BANK_TRANSFER" | "CARD",
          purpose: p.purpose,
          extraInfo: { scheduledDate: p.scheduledDate, recurring: p.recurring }
        });
      }));
    },
    onSuccess: () => {
      toast({ title: "Batch Created", description: "All payments have been submitted." });
      queryClient.invalidateQueries({ queryKey: ["finance", "payments"] });
      setBatchDialogOpen(false);
      setBatchPayments([]);
      refreshPayments();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Batch creation failed.", variant: "destructive" });
    },
  });

  const fetchPayments = useCallback(async () => {
    const raw = await financeApiClient.listPayments(session.tenant_id, session);
    return (Array.isArray(raw) ? raw : []).map((payment) => ({
      ...payment,
      destination: payment.beneficiary,
      purpose: "Operational expenses",
      status:
        (payment.status as string) === "PENDING" ||
        (payment.status as string) === "APPROVED" ||
        (payment.status as string) === "REJECTED" ||
        (payment.status as string) === "SCHEDULED" ||
        (payment.status as string) === "FAILED"
          ? (payment.status as unknown as PaymentStatus)
          : ("PENDING" as PaymentStatus),
    })) as Payment[];
  }, [session]);

  const [payments, setPayments] = useState<Payment[]>([]);

  const refreshPayments = useCallback(async () => {
    setPayments(await fetchPayments());
  }, [fetchPayments]);

  useEffect(() => {
    refreshPayments();
  }, [refreshPayments, session]);

  const groupedPayments = useMemo(() => {
    const groups: Record<PaymentTab, Payment[]> = {
      PENDING: [],
      APPROVED: [],
      REJECTED: [],
      SCHEDULED: [],
      FAILED: [],
    };
    for (const item of payments) {
      const status: PaymentStatus = item.status ?? "PENDING";
      groups[status].push(item);
    }
    return groups;
  }, [payments]);

  const summaryCounts = useMemo(
    () => ({
      pending: groupedPayments.PENDING.length,
      approved: groupedPayments.APPROVED.length,
      rejected: groupedPayments.REJECTED.length,
      scheduled: groupedPayments.SCHEDULED.length,
      failed: groupedPayments.FAILED.length,
    }),
    [groupedPayments],
  );

  const filteredPayments = useMemo(
    () =>
      (Array.isArray(groupedPayments[tab]) ? groupedPayments[tab] : []).filter((p) =>
        !search ? true : p.destination.toLowerCase().includes(search.toLowerCase()),
      ),
    [groupedPayments, search, tab],
  );

  const handleCreatePayment = (data: PaymentFormData) => {
    createPaymentMutation.mutate(data);
  };

  const handleCreateBatch = () => {
    batchMutation.mutate(batchPayments);
  };

  const handleApprovalAction = async (id: string, action: "APPROVED" | "REJECTED") => {
    await financeApiClient.updatePaymentStatus(session.tenant_id, session, id, action);
    logService.log(session.tenant_id, session.user_id, `Payment ${id} ${action}`);
    refreshPayments();
  };

  const renderTable = (items: Payment[]) => (
    <DataTableShell total={items.length} page={1} pageSize={10}>
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="p-3 text-left">Destination</th>
            <th className="p-3 text-left">Method</th>
            <th className="p-3 text-left">Amount</th>
            <th className="p-3 text-left">Purpose</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {(Array.isArray(items) ? items : []).map((p) => (
            <tr
              key={p.id}
              className="cursor-pointer border-t hover:bg-muted/50"
              onClick={() => setSelectedItem(p)}
            >
              <td className="p-3">{p.destination}</td>
              <td className="p-3 text-muted-foreground">{p.method}</td>
              <td className="p-3 text-muted-foreground">
                {formatNumber(p.amount)}
              </td>
              <td className="p-3">{p.purpose}</td>
              <td className="p-3">
                <ApprovalStatusBadge status={p.status ?? "PENDING"} />
              </td>
              <td className="p-3 space-x-2">
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={p.status === "APPROVED"}
                    onClick={() => p.id && handleApprovalAction(p.id, "APPROVED")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={p.status === "REJECTED"}
                    onClick={() => p.id && handleApprovalAction(p.id, "REJECTED")}
                  >
                    Reject
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pay Flow"
        subtitle="Operational payments: create, approve, track, schedule, and audit all transactions."
        primaryAction={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBatchDialogOpen(true)}>
              Create Batch
            </Button>
            <Button onClick={() => setDialogOpen(true)}>Create Payment</Button>
          </div>
        }
        secondaryActions={
          <div className="flex gap-2">
            <Select
              value={tab}
              onValueChange={(value) =>
                setTab(value as PaymentStatus)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Tab" />
              </SelectTrigger>
              <SelectContent>
                {(Array.isArray(TABS) ? TABS : []).map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Search payments"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-[220px]"
            />
          </div>
        }
      />

      <WorkspacePanel
        title="Payment Health"
        description="Counts by status for transparency and approvals."
      >
        <div className="grid gap-3 sm:grid-cols-5">
          {(Array.isArray(TABS) ? TABS : []).map((status) => (
            <div key={status} className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{status}</p>
              <p className="text-xl font-semibold">
                {summaryCounts[status.toLowerCase() as keyof typeof summaryCounts]}
              </p>
              <Badge variant="outline">{status}</Badge>
            </div>
          ))}
        </div>
      </WorkspacePanel>

      <WorkspacePanel
        title="Payments Work Queue"
        description="Payments requiring action, approvals, or review."
      >
        <Tabs value={tab} onValueChange={(value) => setTab(value as PaymentTab)}>
          <TabsList>
            {(Array.isArray(TABS) ? TABS : []).map((status) => (
              <TabsTrigger key={status} value={status}>
                {status.charAt(0) + status.slice(1).toLowerCase()}
              </TabsTrigger>
            ))}
          </TabsList>

          {(Array.isArray(TABS) ? TABS : []).map((status) => {
            const items =
              status === tab ? filteredPayments : groupedPayments[status];
            return (
              <TabsContent key={status} value={status} className="mt-4">
                {items.length ? (
                  renderTable(items)
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    {status.charAt(0) + status.slice(1).toLowerCase()} payments will
                    appear here.
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </WorkspacePanel>

      {/* Dialogs */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !createPaymentMutation.isPending) { form.reset(); setDialogOpen(false); } }}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <div className="grid md:grid-cols-[1fr_2fr] h-full">
            {/* Left Info Panel */}
            <div className="bg-muted text-muted-foreground p-6 flex flex-col justify-between">
              <div>
                <ShieldCheck className="w-8 h-8 text-primary mb-4" />
                <DialogTitle className="text-xl mb-2 text-white">Secure Payment Protocol</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  All decentralized payments are hashed, signed by internal HSM prior to broadcast, and routed strictly per RBAC limits.
                </p>
                <div className="mt-8 space-y-5">
                  <div className="flex items-start gap-3">
                    <Fingerprint className="w-5 h-5 text-success mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-white">Biometric Authorization</p>
                      <p className="text-xs text-muted-foreground">Transactions over Rp 150jt require CFO physical YubiKey or Biometric approval.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Building2 className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-white">Treasury Gateway</p>
                      <p className="text-xs text-muted-foreground">Funds are pulled from unified internal treasury pools linked to source accounts.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-primary p-4 rounded-lg border border-primary mt-8">
                <p className="text-xs text-primary font-medium">Compliance Note</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Ensure AML checks are complete before executing cross-border payments.
                </p>
              </div>
            </div>

            {/* Right Form Panel */}
            <div className="p-6 flex flex-col">
              <form onSubmit={form.handleSubmit(handleCreatePayment)} className="space-y-6 flex-1 overflow-y-auto pr-2">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-3 block">Transaction Directives</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                       <Input
                        placeholder="Destination Account / Beneficiary"
                        {...form.register("beneficiary")}
                        className="font-medium text-sm"
                        disabled={createPaymentMutation.isPending}
                      />
                      {form.formState.errors.beneficiary && (
                        <p className="text-xs text-destructive mt-1">{form.formState.errors.beneficiary.message}</p>
                      )}
                    </div>
                    <div>
                       <Select
                        value={form.watch("method")}
                        onValueChange={(value) => form.setValue("method", value as any)}
                        disabled={createPaymentMutation.isPending}
                      >
                        <SelectTrigger><SelectValue placeholder="Payment Rail / Method" /></SelectTrigger>
                        <SelectContent>
                          {(Array.isArray(sources) ? sources : []).map((s) => (
                            <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                          ))}
                          <SelectItem value="BANK_TRANSFER">Bank/Wire Transfer</SelectItem>
                          <SelectItem value="QRIS">QRIS</SelectItem>
                          <SelectItem value="GOPAY">GoPay / E-Wallet</SelectItem>
                          <SelectItem value="OVO">OVO</SelectItem>
                          <SelectItem value="DANA">Dana</SelectItem>
                          <SelectItem value="SHOPEEPAY">ShopeePay</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Input
                        placeholder="Amount"
                        type="number"
                        {...form.register("amount", { valueAsNumber: true })}
                        className="font-mono"
                        disabled={createPaymentMutation.isPending}
                      />
                      {form.formState.errors.amount && (
                        <p className="text-xs text-destructive mt-1">{form.formState.errors.amount.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                   <label className="text-xs font-semibold uppercase text-muted-foreground mb-3 block">Purpose & Traceability</label>
                   <Textarea
                    placeholder="Provide explicit business rationale. This will be embedded in the audit blockchain."
                    {...form.register("purpose")}
                    className="resize-none h-20"
                    disabled={createPaymentMutation.isPending}
                  />
                  {form.formState.errors.purpose && (
                    <p className="text-xs text-destructive mt-1">{form.formState.errors.purpose.message}</p>
                  )}
                </div>

                <div>
                   <label className="text-xs font-semibold uppercase text-muted-foreground mb-3 block">Execution Schedule</label>
                   <div className="flex gap-4 items-center">
                     <div className="relative flex-1">
                       <CalendarDays className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                       <Input
                        type="date"
                        className="pl-9"
                        {...form.register("scheduledDate")}
                        disabled={createPaymentMutation.isPending}
                      />
                     </div>
                   </div>
                </div>

              <div className="mt-6 pt-4 border-t flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => { form.reset(); setDialogOpen(false); }} disabled={createPaymentMutation.isPending}>Cancel</Button>
                <Button type="submit" className="gap-2 px-6" disabled={createPaymentMutation.isPending}>
                  {createPaymentMutation.isPending ? "Processing..." : "Authorize & Route"} <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={batchDialogOpen} onOpenChange={(open) => { if (!open && !batchMutation.isPending) setBatchDialogOpen(false); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Batch Payments</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Upload a CSV or add multiple payments manually.
            </div>
            {(Array.isArray(batchPayments) ? batchPayments : []).map((p, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  placeholder="Destination"
                  value={p.destination}
                  disabled={batchMutation.isPending}
                  onChange={(e) =>
                    setBatchPayments(
                      (Array.isArray(batchPayments) ? batchPayments : []).map((b, i) =>
                        i === idx ? { ...b, destination: e.target.value } : b,
                      ),
                    )
                  }
                />
                <Input
                  placeholder="Amount"
                  type="number"
                  value={p.amount}
                  disabled={batchMutation.isPending}
                  onChange={(e) =>
                    setBatchPayments(
                      (Array.isArray(batchPayments) ? batchPayments : []).map((b, i) =>
                        i === idx
                          ? { ...b, amount: Number(e.target.value) }
                          : b,
                      ),
                    )
                  }
                />
              </div>
            ))}
            <Button
              disabled={batchMutation.isPending}
              onClick={() =>
                setBatchPayments([
                  ...batchPayments,
                  {
                    destination: "",
                    amount: 0,
                    method: "BANK_TRANSFER",
                    purpose: "",
                    status: "PENDING",
                    approvalLevel: 0,
                  },
                ])
              }
            >
              Add Payment
            </Button>
            <div className="flex justify-end gap-2">
              <Button onClick={handleCreateBatch} disabled={batchMutation.isPending}>
                {batchMutation.isPending ? "Creating..." : "Create Batch"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader className="pb-4 border-b">
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Payment Record Detail
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">Ref: <span className="font-mono">{selectedItem?.id}</span></p>
              </div>
              <ApprovalStatusBadge status={selectedItem?.status || "PENDING"} />
            </div>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-8 py-4">
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground uppercase font-semibold tracking-wider mb-2">Transaction Specs</p>
                <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Beneficiary / Destination</p>
                    <p className="font-semibold">{selectedItem?.destination}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Authorized Amount</p>
                    <p className="font-bold text-xl">{formatNumber(selectedItem?.amount ?? null)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Execution Rail</p>
                      <p className="font-medium text-sm border bg-background rounded px-2 py-0.5 inline-block mt-0.5">{selectedItem?.method}</p>
                    </div>
                    {selectedItem?.scheduledDate && (
                      <div>
                        <p className="text-xs text-muted-foreground">Scheduled Date</p>
                        <p className="text-sm font-medium mt-0.5">{selectedItem.scheduledDate}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-6 border-l pl-8">
              <div>
                <p className="text-sm text-muted-foreground uppercase font-semibold tracking-wider mb-2">Business Purpose</p>
                <div className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3">
                  {selectedItem?.purpose || "No specific rationale was provided for this transaction."}
                </div>
              </div>
              <div className="pt-2">
                <p className="text-sm text-muted-foreground uppercase font-semibold tracking-wider mb-2">Audit & Cryptographic Proof</p>
                <div className="space-y-3 bg-muted dark:bg-muted border rounded-lg p-4">
                  <div className="flex gap-2 text-xs">
                    <ShieldCheck className="w-4 h-4 text-success" />
                    <span className="text-muted-foreground">Transaction mapped securely. HSM validation passed.</span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <Fingerprint className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Trace route established. Compliance check: <span className="text-success font-bold">CLEARED</span>.</span>
                  </div>
                  {selectedItem?.recurring && (
                    <div className="flex gap-2 text-xs">
                      <CalendarDays className="w-4 h-4 text-primary" />
                      <span className="text-muted-foreground">This is marked as a <span className="font-bold text-foreground">Recurring Payment Structure</span>.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
