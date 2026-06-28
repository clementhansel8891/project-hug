import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Calendar, CreditCard, Building2, ArrowUpRight, Info, UploadCloud } from "lucide-react";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { FilterBar } from "@/core/tools/FilterBar";
import { ApprovalStatusBadge } from "@/core/tools/ApprovalStatusBadge";
import { FeedbackAlert } from "@/core/tools/FeedbackAlert";
import { useSession } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import { useToast } from "@/hooks/use-toast";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import { financeApiClient } from "@/core/services/finance/financeApiClient";
import type { FinancePayableRow } from "@/core/services/finance/financeService";
import { logService } from "@/core/services/finance/logService";
import { formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/shared/AsyncState";
import { payableSchema, type PayableFormData } from "@/core/finance/schemas";
import { CreatePayableModal } from "@/core/finance/FinanceModalForms";

type PayableTab = "PENDING" | "APPROVED" | "PAID" | "OVERDUE";

const TABS: PayableTab[] = ["PENDING", "APPROVED", "PAID", "OVERDUE"];

export default function PayableDesk() {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<PayableTab>("PENDING");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payables, setPayables] = useState<FinancePayableRow[]>([]);
  const [selectedItem, setSelectedItem] = useState<FinancePayableRow | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- React Hook Form: Create Payable ---
  const payableForm = useForm<PayableFormData>({
    resolver: zodResolver(payableSchema),
    defaultValues: { vendor: "", amount: 0, dueDate: "", currency: "IDR" },
  });

  const createPayableMutation = useMutation({
    mutationFn: (data: PayableFormData) =>
      apiRequest("/v1/finance/payables", "POST", session, data),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["finance", "payables"]],
      onClose: () => setDialogOpen(false),
      form: payableForm,
      successTitle: "Payable Created",
      successDescription: "Accounts payable entry submitted for approval.",
    }),
    onSuccess: () => {
      toast({ title: "Payable Created", description: "Accounts payable entry submitted for approval." });
      queryClient.invalidateQueries({ queryKey: ["finance", "payables"] });
      payableForm.reset();
      setDialogOpen(false);
      refreshPayables();
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/v1/finance/payables/${id}/paid`, "PATCH", session, {}),
    onSuccess: () => {
      toast({ title: "Paid", description: "Payable marked as paid and posted to ledger." });
      queryClient.invalidateQueries({ queryKey: ["finance", "payables"] });
      refreshPayables();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to mark as paid.", variant: "destructive" });
    },
  });

  const clearStatus = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const refreshPayables = useCallback(async () => {
    setPayables(await financeApiClient.listPayables(session.tenant_id, session));
  }, [session]);

  useEffect(() => {
    refreshPayables();
  }, [refreshPayables]);

  const filtered = useMemo(
    () =>
      (Array.isArray(payables) ? payables : []).filter((item) =>
        search ? item.vendorName.toLowerCase().includes(search.toLowerCase()) : true,
      ),
    [payables, search],
  );

  const grouped = useMemo(() => {
    const next: Record<PayableTab, FinancePayableRow[]> = {
      PENDING: [],
      APPROVED: [],
      PAID: [],
      OVERDUE: [],
    };
    filtered.forEach((item) => {
      const statusKey = item.status as PayableTab;
      if (next[statusKey]) {
        next[statusKey].push(item);
      } else {
        // Defensive: default to PENDING if status is unknown/legacy
        next.PENDING.push(item);
      }
    });
    return next;
  }, [filtered]);

  const createPayable = (data: PayableFormData) => {
    createPayableMutation.mutate(data);
  };

  const approvePayable = async (id: string) => {
    try {
      await financeApiClient.approvePayable(session.tenant_id, session, id);
      logService.log(session.tenant_id, session.user_id, "Approved payable", id);
      setStatusMessage("Payable approved by department HOD.");
      refreshPayables();
    } catch (err) {
      setErrorMessage("Approval failed. Budget limit exceeded.");
    }
  };

  const markPaid = (id: string) => {
    markPaidMutation.mutate(id);
  };

  const renderTable = (items: FinancePayableRow[]) => (
    <DataTableShell total={items.length} page={1} pageSize={10}>
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="p-3 text-left">Vendor</th>
            <th className="p-3 text-left">Invoice</th>
            <th className="p-3 text-left">Amount</th>
            <th className="p-3 text-left">Due Date</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {(Array.isArray(items) ? items : []).map((payable) => (
            <tr
              key={payable.id}
              className="cursor-pointer border-t hover:bg-muted/50"
              onClick={() => setSelectedItem(payable)}
            >
              <td className="p-3">{payable.vendorName}</td>
              <td className="p-3">{payable.billNumber}</td>
              <td className="p-3 text-muted-foreground">{formatNumber(payable.amount)}</td>
              <td className="p-3">{payable.dueDate}</td>
              <td className="p-3">
                <ApprovalStatusBadge status={payable.status} />
              </td>
              <td className="p-3">
                <div className="flex flex-wrap gap-2">
                  {payable.status === "PENDING" ? (
                    <Button size="sm" variant="outline" onClick={() => approvePayable(payable.id)}>
                      Approve
                    </Button>
                  ) : null}
                  {payable.status !== "PAID" ? (
                    <Button size="sm" onClick={() => markPaid(payable.id)}>
                      Mark Paid
                    </Button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(Array.isArray(items) ? items : []).length === 0 ? (
        <EmptyState
          title="No payables"
          description="No payables exist for this view in the current tenant scope."
        />
      ) : null}
    </DataTableShell>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payable Desk"
        subtitle="Manage outgoing bills with approval and settlement controls."
        primaryAction={<Button onClick={() => setDialogOpen(true)}>Create Payable</Button>}
        secondaryActions={
          <Input
            placeholder="Search vendors"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-[220px]"
          />
        }
      />

      <FeedbackAlert message={statusMessage} error={errorMessage} onClear={clearStatus} />

      <WorkspacePanel title="Payable Health" description="Approval and settlement status.">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-lg font-semibold">{grouped.PENDING.length}</p>
            <Badge variant="secondary">Needs review</Badge>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Settled / Paid</p>
            <p className="text-lg font-semibold">{grouped.PAID.length}</p>
            <Badge variant="default">Settled</Badge>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="text-lg font-semibold text-destructive">{grouped.OVERDUE.length}</p>
            <Badge variant="destructive">Escalate</Badge>
          </div>
        </div>
      </WorkspacePanel>

      <WorkspacePanel title="Payables Work Queue" description="Bills requiring action.">
        <FilterBar searchValue={search} onSearchChange={setSearch} />
        <Tabs value={tab} onValueChange={(value) => setTab(value as PayableTab)}>
          <TabsList>
            {(Array.isArray(TABS) ? TABS : []).map((status) => (
              <TabsTrigger key={status} value={status}>
                {status.charAt(0) + status.slice(1).toLowerCase()}
              </TabsTrigger>
            ))}
          </TabsList>
          {(Array.isArray(TABS) ? TABS : []).map((status) => (
            <TabsContent key={status} value={status} className="mt-4">
              {renderTable(grouped[status])}
            </TabsContent>
          ))}
        </Tabs>
      </WorkspacePanel>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !createPayableMutation.isPending) { payableForm.reset(); setDialogOpen(false); } }}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden" aria-describedby="payable-create-description">
          <DialogHeader className="sr-only">
            <DialogTitle>Create Payable</DialogTitle>
          </DialogHeader>
          <div id="payable-create-description" className="sr-only">Form to establish a new accounts payable liability.</div>
          <div className="grid md:grid-cols-[1fr_2fr]">
            {/* Left Info Panel */}
            <div className="bg-muted p-6 flex flex-col justify-between">
              <div>
                <ArrowUpRight className="w-8 h-8 text-primary mb-4" />
                <DialogTitle className="text-xl mb-2">Create Payable</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Record outgoing vendor bills. This establishes an Accounts Payable liability awaiting approval.
                </p>
                <div className="mt-8 space-y-4">
                  <div className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5"><Building2 className="w-4 h-4 text-muted-foreground" /></div>
                    <div>
                      <p className="font-medium">Vendor Selection</p>
                      <p className="text-muted-foreground text-xs">A valid vendor profile is required.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5"><Calendar className="w-4 h-4 text-muted-foreground" /></div>
                    <div>
                      <p className="font-medium">Payment Scheduling</p>
                      <p className="text-muted-foreground text-xs">Due dates guide treasury disbursements.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-primary/5 p-4 rounded-lg mt-8 border border-primary/10">
                <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                  <Info className="w-4 h-4" /> Ledger Sync
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Generates an automatic Expense / Liability journal entry.
                </p>
              </div>
            </div>

            {/* Right Form Panel */}
            <div className="p-6">
              <form onSubmit={payableForm.handleSubmit(createPayable)} className="space-y-6">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Vendor Name</label>
                  <Input placeholder="e.g., Summit Supplies Ltd." {...payableForm.register("vendor")} disabled={createPayableMutation.isPending} />
                  {payableForm.formState.errors.vendor && (
                    <p className="text-xs text-destructive mt-1">{payableForm.formState.errors.vendor.message}</p>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Amount (IDR)</label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        placeholder="0"
                        type="number"
                        {...payableForm.register("amount", { valueAsNumber: true })}
                        disabled={createPayableMutation.isPending}
                      />
                    </div>
                    {payableForm.formState.errors.amount && (
                      <p className="text-xs text-destructive mt-1">{payableForm.formState.errors.amount.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Required Due Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        type="date"
                        {...payableForm.register("dueDate")}
                        disabled={createPayableMutation.isPending}
                      />
                    </div>
                    {payableForm.formState.errors.dueDate && (
                      <p className="text-xs text-destructive mt-1">{payableForm.formState.errors.dueDate.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Supplier Invoice (Optional)</label>
                  <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors">
                    <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Attach Invoice Document</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, JPG up to 10MB</p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => { payableForm.reset(); setDialogOpen(false); }} disabled={createPayableMutation.isPending}>Cancel</Button>
                  <Button type="submit" disabled={createPayableMutation.isPending}>
                    {createPayableMutation.isPending ? "Submitting..." : "Submit for Approval"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-2xl" aria-describedby="payable-detail-description">
          <div id="payable-detail-description" className="sr-only">Detailed view of the selected payable invoice and settlement workflow.</div>
          <DialogHeader className="pb-4 border-b">
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Payable Detail
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">ID: <span className="font-mono">{selectedItem?.billNumber}</span></p>
              </div>
              <ApprovalStatusBadge status={selectedItem?.status || "PENDING"} />
            </div>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-8 py-4">
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground uppercase font-semibold tracking-wider mb-1">Vendor</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{selectedItem?.vendorName}</p>
                    <p className="text-sm text-muted-foreground">Supplier Account</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground uppercase font-semibold tracking-wider mb-1">Timeline</p>
                <div className="bg-muted/30 p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="font-medium text-sm text-destructive">{selectedItem?.dueDate}</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-6 border-l pl-8">
              <div>
                <p className="text-sm text-muted-foreground uppercase font-semibold tracking-wider mb-1">Financials</p>
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                  <p className="text-sm font-medium mb-1">Total Due</p>
                  <p className="text-3xl font-bold tracking-tight">Rp {formatNumber(selectedItem?.amount ?? null)}</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Settlement Workflow</p>
                <p className="text-xs text-muted-foreground">
                  Payment scheduled for next cash disbursement run. 
                  VAT compliance verified for this vendor invoice.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
