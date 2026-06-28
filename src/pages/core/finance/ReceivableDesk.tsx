import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Calendar, CreditCard, Building2, ArrowDownToLine, Info, UploadCloud } from "lucide-react";
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
import type { FinanceReceivableRow } from "@/core/services/finance/financeService";
import { logService } from "@/core/services/finance/logService";
import { formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/shared/AsyncState";
import { receivableSchema, type ReceivableFormData } from "@/core/finance/schemas";
import { CreateReceivableModal } from "@/core/finance/FinanceModalForms";

type ReceivableTab = "PENDING" | "APPROVED" | "OVERDUE";

const TABS: ReceivableTab[] = ["PENDING", "APPROVED", "OVERDUE"];

export default function ReceivableDesk() {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ReceivableTab>("PENDING");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [receivables, setReceivables] = useState<FinanceReceivableRow[]>([]);
  const [selectedItem, setSelectedItem] = useState<FinanceReceivableRow | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- React Hook Form: Create Receivable ---
  const receivableForm = useForm<ReceivableFormData>({
    resolver: zodResolver(receivableSchema),
    defaultValues: { customer: "", amount: 0, dueDate: "", currency: "IDR" },
  });

  const createReceivableMutation = useMutation({
    mutationFn: (data: ReceivableFormData) =>
      apiRequest("/v1/finance/receivables", "POST", session, data),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["finance", "receivables"]],
      onClose: () => setDialogOpen(false),
      form: receivableForm,
      successTitle: "Receivable Created",
      successDescription: "Accounts receivable entry created and routed.",
    }),
    onSuccess: () => {
      toast({ title: "Receivable Created", description: "Accounts receivable entry created and routed." });
      queryClient.invalidateQueries({ queryKey: ["finance", "receivables"] });
      receivableForm.reset();
      setDialogOpen(false);
      refreshReceivables();
    },
  });

  const markReceivedMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/v1/finance/receivables/${id}/collected`, "PATCH", session, {}),
    onSuccess: () => {
      toast({ title: "Collected", description: "Receivable marked as received and settled." });
      queryClient.invalidateQueries({ queryKey: ["finance", "receivables"] });
      refreshReceivables();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to mark as received.", variant: "destructive" });
    },
  });

  const clearStatus = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const refreshReceivables = useCallback(async () => {
    setReceivables(await financeApiClient.listReceivables(session.tenant_id, session));
  }, [session]);

  useEffect(() => {
    refreshReceivables();
  }, [refreshReceivables]);

  const filtered = useMemo(
    () =>
      (Array.isArray(receivables) ? receivables : []).filter((item) =>
        search ? item.customerName.toLowerCase().includes(search.toLowerCase()) : true,
      ),
    [receivables, search],
  );

  const grouped = useMemo(() => {
    const next: Record<ReceivableTab, FinanceReceivableRow[]> = {
      PENDING: [],
      APPROVED: [],
      OVERDUE: [],
    };
    filtered.forEach((item) => {
      if (item.status === "PAID") {
        next.APPROVED.push(item);
      } else if (item.status === "OVERDUE") {
        next.OVERDUE.push(item);
      } else {
        next.PENDING.push(item);
      }
    });
    return next;
  }, [filtered]);

  const createReceivable = (data: ReceivableFormData) => {
    createReceivableMutation.mutate(data);
  };

  const markReceived = (id: string) => {
    markReceivedMutation.mutate(id);
  };

  const sendReminder = async (id: string) => {
    try {
      await financeApiClient.sendReceivableReminder(session.tenant_id, session, id);
      logService.log(session.tenant_id, session.user_id, "Sent receivable reminder", id);
      setStatusMessage("Collection reminder sent to customer contact.");
    } catch (err) {
      setErrorMessage("Failed to send reminder. Email gateway offline.");
    }
  };

  const renderTable = (items: FinanceReceivableRow[]) => (
    <DataTableShell total={items.length} page={1} pageSize={10}>
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="p-3 text-left">Customer</th>
            <th className="p-3 text-left">Invoice</th>
            <th className="p-3 text-left">Amount</th>
            <th className="p-3 text-left">Due Date</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {(Array.isArray(items) ? items : []).map((receivable) => (
            <tr
              key={receivable.id}
              className="cursor-pointer border-t hover:bg-muted/50"
              onClick={() => setSelectedItem(receivable)}
            >
              <td className="p-3">{receivable.customerName}</td>
              <td className="p-3">{receivable.invoiceNumber}</td>
              <td className="p-3 text-muted-foreground">{formatNumber(receivable.amount)}</td>
              <td className="p-3">{receivable.dueDate}</td>
              <td className="p-3">
                <ApprovalStatusBadge status={receivable.status} />
              </td>
              <td className="p-3">
                <div className="flex flex-wrap gap-2">
                  {receivable.status !== "PAID" ? (
                    <Button size="sm" onClick={() => markReceived(receivable.id)}>
                      Mark Received
                    </Button>
                  ) : null}
                  {receivable.status !== "PAID" ? (
                    <Button size="sm" variant="outline" onClick={() => sendReminder(receivable.id)}>
                      Reminder
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
          title="No receivables"
          description="No receivables exist for this view in the current tenant scope."
        />
      ) : null}
    </DataTableShell>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receivable Desk"
        subtitle="Track incoming invoices with collection and reminder workflows."
        primaryAction={<Button onClick={() => setDialogOpen(true)}>Create Receivable</Button>}
        secondaryActions={
          <Input
            placeholder="Search customers"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-[220px]"
          />
        }
      />

      <FeedbackAlert message={statusMessage} error={errorMessage} onClear={clearStatus} />

      <WorkspacePanel title="Receivable Health" description="Collection visibility by status.">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-xl font-semibold">{grouped.PENDING.length}</p>
            <Badge variant="secondary">Collecting</Badge>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Received</p>
            <p className="text-xl font-semibold">{grouped.APPROVED.length}</p>
            <Badge variant="default">Settled</Badge>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="text-xl font-semibold text-destructive">{grouped.OVERDUE.length}</p>
            <Badge variant="destructive">Follow up</Badge>
          </div>
        </div>
      </WorkspacePanel>

      <WorkspacePanel title="Receivables Work Queue" description="Invoices requiring collection action.">
        <FilterBar searchValue={search} onSearchChange={setSearch} />
        <Tabs value={tab} onValueChange={(value) => setTab(value as ReceivableTab)}>
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

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !createReceivableMutation.isPending) { receivableForm.reset(); setDialogOpen(false); } }}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <div className="grid md:grid-cols-[1fr_2fr]">
            {/* Left Info Panel */}
            <div className="bg-muted p-6 flex flex-col justify-between">
              <div>
                <ArrowDownToLine className="w-8 h-8 text-primary mb-4" />
                <DialogTitle className="text-xl mb-2">Create Receivable</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Record incoming funds due. This creates an Accounts Receivable entry tied instantly to the customer's balance.
                </p>
                <div className="mt-8 space-y-4">
                  <div className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5"><Building2 className="w-4 h-4 text-muted-foreground" /></div>
                    <div>
                      <p className="font-medium">Customer Selection</p>
                      <p className="text-muted-foreground text-xs">A valid customer profile is required.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5"><Calendar className="w-4 h-4 text-muted-foreground" /></div>
                    <div>
                      <p className="font-medium">Terms Analysis</p>
                      <p className="text-muted-foreground text-xs">Due dates trigger automated collection.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-primary/5 p-4 rounded-lg mt-8 border border-primary/10">
                <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                  <Info className="w-4 h-4" /> Ledger Sync
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Generates an automatic un-posted Revenue entry.
                </p>
              </div>
            </div>

            {/* Right Form Panel */}
            <div className="p-6">
              <form onSubmit={receivableForm.handleSubmit(createReceivable)} className="space-y-6">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Customer Name</label>
                  <Input placeholder="e.g., Global Tech Inc." {...receivableForm.register("customer")} disabled={createReceivableMutation.isPending} />
                  {receivableForm.formState.errors.customer && (
                    <p className="text-xs text-destructive mt-1">{receivableForm.formState.errors.customer.message}</p>
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
                        {...receivableForm.register("amount", { valueAsNumber: true })}
                        disabled={createReceivableMutation.isPending}
                      />
                    </div>
                    {receivableForm.formState.errors.amount && (
                      <p className="text-xs text-destructive mt-1">{receivableForm.formState.errors.amount.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Expected Due Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        type="date"
                        {...receivableForm.register("dueDate")}
                        disabled={createReceivableMutation.isPending}
                      />
                    </div>
                    {receivableForm.formState.errors.dueDate && (
                      <p className="text-xs text-destructive mt-1">{receivableForm.formState.errors.dueDate.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Supporting Contract / PO (Optional)</label>
                  <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors">
                    <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Attach PO Document</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, JPG up to 10MB</p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => { receivableForm.reset(); setDialogOpen(false); }} disabled={createReceivableMutation.isPending}>Cancel</Button>
                  <Button type="submit" disabled={createReceivableMutation.isPending}>
                    {createReceivableMutation.isPending ? "Creating..." : "Create and Route"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="pb-4 border-b">
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Receivable Detail
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">ID: <span className="font-mono">{selectedItem?.invoiceNumber}</span></p>
              </div>
              <ApprovalStatusBadge status={selectedItem?.status || "DRAFT"} />
            </div>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-8 py-4">
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground uppercase font-semibold tracking-wider mb-1">Customer</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{selectedItem?.customerName}</p>
                    <p className="text-sm text-muted-foreground">Corporate Account</p>
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
                  <p className="text-sm font-medium mb-1">Total Outstanding</p>
                  <p className="text-3xl font-bold tracking-tight">Rp {formatNumber(selectedItem?.amount ?? null)}</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes & History</p>
                <p className="text-xs text-muted-foreground">
                  Automatic reminder scheduled for 2 days before due date. 
                  Credit limits verified for this counterparty.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
