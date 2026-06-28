import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Wallet, Landmark, Info, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { FilterBar } from "@/core/tools/FilterBar";
import { ApprovalStatusBadge } from "@/core/tools/ApprovalStatusBadge";
import { FeedbackAlert } from "@/core/tools/FeedbackAlert";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import { useTreasury } from "@/hooks/finance/useTreasury";
import { Roles, type Role } from "@/core/security/roles";
import { treasuryTransferSchema, settlementReconcileSchema, type TreasuryTransferFormData, type SettlementReconcileFormData } from "@/core/finance/schemas";
import {
  TreasurySourceCreateModal,
  TreasurySourceEditModal,
} from "@/core/finance/FinanceModalForms";
import type { MoneySource } from "@/core/types/finance/accounts";
import type { TreasuryTransfer } from "@/core/types/finance/treasury";
import { formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/shared/AsyncState";

export default function TreasuryMap() {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reconcileDialogOpen, setReconcileDialogOpen] = useState(false);
  const [sourceCreateOpen, setSourceCreateOpen] = useState(false);
  const [sourceEditOpen, setSourceEditOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<MoneySource | null>(null);
  const [selectedSource, setSelectedSource] = useState<{
    id: string;
    name: string;
    pending: number;
  } | null>(null);
  const [selectedAccountDetail, setSelectedAccountDetail] =
    useState<MoneySource | null>(null);
  const [selectedTransferDetail, setSelectedTransferDetail] =
    useState<TreasuryTransfer | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearStatus = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const isHighLevelRole = useMemo(() => {
    const role = session.role;
    const allowed: Role[] = [
      Roles.SUPERADMIN,
      Roles.OWNER,
      Roles.COMPANY_ADMIN,
      Roles.FINANCE_ADMIN,
      Roles.FINANCE_DEPT_HEAD,
    ];
    return allowed.includes(role);
  }, [session.role]);

  const { sources, transfers, fetchSources, fetchTransfers } =
    useTreasury(session.tenant_id, session);

  // --- React Hook Form for Transfer ---
  const transferForm = useForm<TreasuryTransferFormData>({
    resolver: zodResolver(treasuryTransferSchema),
    defaultValues: { sourceId: "", destinationId: "", amount: 0, description: "" },
  });

  const transferMutation = useMutation({
    mutationFn: (data: TreasuryTransferFormData) =>
      apiRequest("/v1/finance/treasury/transfers", "POST", session, {
        fromSourceId: data.sourceId,
        toSourceId: data.destinationId,
        amount: data.amount,
        status: isHighLevelRole ? "approved" : "pending",
      }),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["finance", "treasury-sources"], ["/v1/finance/treasury/transfers"]],
      onClose: () => setDialogOpen(false),
      form: transferForm,
      successTitle: isHighLevelRole ? "Transfer Executed" : "Transfer Requested",
      successDescription: "The inter-account transfer has been processed.",
    }),
    onSuccess: () => {
      toast({ title: isHighLevelRole ? "Transfer Executed" : "Transfer Requested", description: "The inter-account transfer has been processed." });
      queryClient.invalidateQueries({ queryKey: ["finance", "treasury-sources"] });
      transferForm.reset();
      setDialogOpen(false);
      void fetchSources();
      void fetchTransfers();
    },
  });

  const handleTransfer = transferForm.handleSubmit((data) => {
    transferMutation.mutate(data);
  });

  // --- React Hook Form for Reconciliation ---
  const reconcileForm = useForm<SettlementReconcileFormData>({
    resolver: zodResolver(settlementReconcileSchema),
    defaultValues: { sourceId: "", amount: 0 },
  });

  const reconcileMutation = useMutation({
    mutationFn: (data: SettlementReconcileFormData) =>
      apiRequest("/v1/finance/treasury/reconcile", "POST", session, data),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["finance", "treasury-sources"]],
      onClose: () => { setReconcileDialogOpen(false); setSelectedSource(null); },
      form: reconcileForm,
      successTitle: "Reconciliation Complete",
      successDescription: "Settlement has been reconciled successfully.",
    }),
    onSuccess: () => {
      toast({ title: "Reconciliation Complete", description: "Settlement has been reconciled successfully." });
      queryClient.invalidateQueries({ queryKey: ["finance", "treasury-sources"] });
      reconcileForm.reset();
      setReconcileDialogOpen(false);
      setSelectedSource(null);
      void fetchSources();
    },
  });

  const handleReconcile = reconcileForm.handleSubmit((data) => {
    reconcileMutation.mutate(data);
  });

  // Watch transfer form sources for display
  const watchedSourceId = transferForm.watch("sourceId");
  const watchedDestId = transferForm.watch("destinationId");
  const selectedFromSource = useMemo(() => sources.find(s => s.id === watchedSourceId), [sources, watchedSourceId]);
  const selectedToSource = useMemo(() => sources.find(s => s.id === watchedDestId), [sources, watchedDestId]);

  const filteredSources = useMemo(
    () =>
      (Array.isArray(sources) ? sources : []).filter((src) =>
        search ? src.name.toLowerCase().includes(search.toLowerCase()) : true,
      ),
    [sources, search],
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Treasury Map"
        subtitle="Real-time cash positioning, liquidity, inter-account transfers, and settlements."
        primaryAction={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setSourceCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Source
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              {isHighLevelRole ? "Create Transfer" : "Request Transfer"}
            </Button>
          </div>
        }
        secondaryActions={
          <Input
            placeholder="Search treasury accounts"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[220px]"
          />
        }
      />

      <FeedbackAlert
        message={statusMessage}
        error={errorMessage}
        onClear={clearStatus}
      />

      {/* Liquidity Overview */}
      <WorkspacePanel
        title="Liquidity Overview"
        description="Bank, wallets, cash registers, settlement balances. Click on an account to see details."
      >
        <FilterBar searchValue={search} onSearchChange={setSearch} />
        <DataTableShell total={filteredSources.length} page={1} pageSize={10}>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Account</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Balance</th>
                <th className="p-3 text-left">Pending Settlement</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(filteredSources) ? filteredSources : []).map((src) => (
                <tr
                  key={src.id}
                  className="cursor-pointer border-t hover:bg-muted/50"
                  onClick={() => setSelectedAccountDetail(src)}
                >
                  <td className="p-3 font-medium text-foreground">
                    {src.name}
                  </td>
                  <td className="p-3 text-muted-foreground">{src.type}</td>
                  <td className="p-3 text-muted-foreground">
                    {formatNumber(src.balance)}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {formatNumber(src.pendingSettlement ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(Array.isArray(filteredSources) ? filteredSources : []).length === 0 ? (
            <EmptyState
              title="No treasury accounts"
              description="No treasury accounts match this view in the current tenant scope."
            />
          ) : null}
        </DataTableShell>
      </WorkspacePanel>

      {/* Pending Settlements */}
      <WorkspacePanel
        title="Pending Settlements"
        description="Reconcile gateway settlements to bank accounts."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(Array.isArray(filteredSources) ? filteredSources : []).filter((src) => (src.pendingSettlement ?? 0) > 0)
            .map((src) => (
              <div
                key={src.id}
                className="flex items-center justify-between rounded-lg border p-4 text-sm"
              >
                <div>
                  <p className="font-semibold text-foreground">{src.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Pending: {formatNumber(src.pendingSettlement ?? 0)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedSource({
                      id: src.id,
                      name: src.name,
                      pending: src.pendingSettlement ?? 0,
                    });
                    reconcileForm.reset({
                      sourceId: src.id,
                      amount: src.pendingSettlement ?? 0,
                    });
                    setReconcileDialogOpen(true);
                  }}
                >
                  Reconcile
                </Button>
              </div>
            ))}
        </div>
      </WorkspacePanel>

      {/* Transfers Table */}
      <WorkspacePanel
        title="Transfers"
        description="Inter-account transfers and approval workflow. Click to view audit trail."
      >
        <DataTableShell total={transfers.length} page={1} pageSize={10}>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">From</th>
                <th className="p-3 text-left">To</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Requested By</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(transfers) ? transfers : []).map((trf) => (
                <tr
                  key={trf.id}
                  className="cursor-pointer border-t hover:bg-muted/50"
                  onClick={() => setSelectedTransferDetail(trf)}
                >
                  <td className="p-3 text-muted-foreground">
                    {trf.fromSourceId}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {trf.toSourceId}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {formatNumber(trf.amount)}
                  </td>
                  <td className="p-3">
                    <ApprovalStatusBadge status={trf.status.toUpperCase()} />
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {trf.requestedBy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(Array.isArray(transfers) ? transfers : []).length === 0 ? (
            <EmptyState
              title="No transfers"
              description="No inter-account transfers exist for this tenant scope yet."
            />
          ) : null}
        </DataTableShell>
      </WorkspacePanel>

      {/* Transfer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !transferMutation.isPending) { transferForm.reset(); setDialogOpen(false); } }}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <div className="grid md:grid-cols-[1fr_2fr]">
            {/* Left Info Panel */}
            <div className="bg-muted p-6 flex flex-col justify-between">
              <div>
                <ArrowRightLeft className="w-8 h-8 text-primary mb-4" />
                <DialogTitle className="text-xl mb-2">
                  {isHighLevelRole ? "Treasury Transfer" : "Request Transfer"}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Move liquidity between corporate accounts, wallets, and retail floats. All movements are strictly audited.
                </p>
                <div className="mt-8 space-y-4">
                  <div className="bg-background p-3 rounded-lg border shadow-sm">
                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Source Account</p>
                    <p className="font-semibold">{selectedFromSource?.name || "Select Account"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Available: <span className="font-medium text-foreground">Rp {formatNumber(selectedFromSource?.balance ?? 0)}</span>
                    </p>
                  </div>
                  <div className="flex justify-center -my-2 relative z-10">
                    <div className="bg-background border rounded-full p-1 drop-shadow-sm">
                      <ArrowRightLeft className="w-4 h-4 text-muted-foreground rotate-90" />
                    </div>
                  </div>
                  <div className="bg-background p-3 rounded-lg border shadow-sm">
                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Destination Account</p>
                    <p className="font-semibold">{selectedToSource?.name || "Select Account"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Current: <span className="font-medium text-foreground">Rp {formatNumber(selectedToSource?.balance ?? 0)}</span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-primary/5 p-4 rounded-lg mt-8 border border-primary/10">
                <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                  <Info className="w-4 h-4" /> Settlement
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Transfers may require secondary approval scaling dynamically based on your role.
                </p>
              </div>
            </div>

            {/* Right Form Panel */}
            <div className="p-6">
              <form onSubmit={handleTransfer}>
                <fieldset disabled={transferMutation.isPending} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="tf-from" className="text-xs font-semibold uppercase text-muted-foreground mb-2 block flex items-center gap-1.5">
                      <Wallet className="w-3 h-3" /> From Source
                    </label>
                    <Select
                      value={transferForm.watch("sourceId")}
                      onValueChange={(val) => transferForm.setValue("sourceId", val, { shouldValidate: true })}
                    >
                      <SelectTrigger id="tf-from" className="w-full" aria-invalid={!!transferForm.formState.errors.sourceId} aria-describedby={transferForm.formState.errors.sourceId ? "tf-from-error" : undefined}>
                        <SelectValue placeholder="From source" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Array.isArray(sources) ? sources : []).map((src) => (
                          <SelectItem key={src.id} value={src.id}>
                            {src.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {transferForm.formState.errors.sourceId && (
                      <p id="tf-from-error" role="alert" className="text-xs text-destructive mt-1">{transferForm.formState.errors.sourceId.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="tf-to" className="text-xs font-semibold uppercase text-muted-foreground mb-2 block flex items-center gap-1.5">
                      <Landmark className="w-3 h-3" /> To Destination
                    </label>
                    <Select
                      value={transferForm.watch("destinationId")}
                      onValueChange={(val) => transferForm.setValue("destinationId", val, { shouldValidate: true })}
                    >
                      <SelectTrigger id="tf-to" className="w-full" aria-invalid={!!transferForm.formState.errors.destinationId} aria-describedby={transferForm.formState.errors.destinationId ? "tf-to-error" : undefined}>
                        <SelectValue placeholder="To source" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Array.isArray(sources) ? sources : []).map((src) => (
                          <SelectItem key={src.id} value={src.id}>
                            {src.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {transferForm.formState.errors.destinationId && (
                      <p id="tf-to-error" role="alert" className="text-xs text-destructive mt-1">{transferForm.formState.errors.destinationId.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="tf-amount" className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Transfer Amount (IDR)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground font-medium">Rp</span>
                    <Input
                      id="tf-amount"
                      type="number"
                      className="pl-9 text-lg font-medium"
                      placeholder="0"
                      {...transferForm.register("amount", { valueAsNumber: true })}
                      aria-invalid={!!transferForm.formState.errors.amount}
                      aria-describedby={transferForm.formState.errors.amount ? "tf-amount-error" : undefined}
                    />
                  </div>
                  {transferForm.formState.errors.amount && (
                    <p id="tf-amount-error" role="alert" className="text-xs text-destructive mt-1">{transferForm.formState.errors.amount.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="tf-desc" className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Description</label>
                  <Input
                    id="tf-desc"
                    placeholder="Transfer description"
                    {...transferForm.register("description")}
                    aria-invalid={!!transferForm.formState.errors.description}
                    aria-describedby={transferForm.formState.errors.description ? "tf-desc-error" : undefined}
                  />
                  {transferForm.formState.errors.description && (
                    <p id="tf-desc-error" role="alert" className="text-xs text-destructive mt-1">{transferForm.formState.errors.description.message}</p>
                  )}
                </div>

                <div className="border-t pt-4 flex justify-end gap-3 mt-8">
                  <Button type="button" variant="outline" onClick={() => { transferForm.reset(); setDialogOpen(false); }} disabled={transferMutation.isPending}>Cancel</Button>
                  <Button type="submit" size="lg" className="gap-2" disabled={transferMutation.isPending}>
                    <ArrowRightLeft className="w-4 h-4" />
                    {transferMutation.isPending ? "Processing..." : isHighLevelRole ? "Execute Transfer" : "Submit Request"}
                  </Button>
                </div>
                </fieldset>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Reconcile Dialog */}
      <Dialog open={reconcileDialogOpen} onOpenChange={(open) => { if (!open && !reconcileMutation.isPending) { reconcileForm.reset(); setReconcileDialogOpen(false); setSelectedSource(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Reconcile Settlement{selectedSource ? ` - ${selectedSource.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReconcile}>
            <fieldset disabled={reconcileMutation.isPending} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="rc-amount" className="text-sm font-medium">Reconcile Amount</label>
                <Input
                  id="rc-amount"
                  type="number"
                  {...reconcileForm.register("amount", { valueAsNumber: true })}
                  aria-invalid={!!reconcileForm.formState.errors.amount}
                  aria-describedby={reconcileForm.formState.errors.amount ? "rc-amount-error" : undefined}
                />
                {reconcileForm.formState.errors.amount && (
                  <p id="rc-amount-error" role="alert" className="text-xs text-destructive">{reconcileForm.formState.errors.amount.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Max pending: {formatNumber(selectedSource?.pending ?? 0)}
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => { reconcileForm.reset(); setReconcileDialogOpen(false); setSelectedSource(null); }} disabled={reconcileMutation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={reconcileMutation.isPending}>
                  {reconcileMutation.isPending ? "Processing..." : "Finalize Reconciliation"}
                </Button>
              </div>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
      {/* Account Detail Dialog */}
      <Dialog
        open={!!selectedAccountDetail}
        onOpenChange={() => setSelectedAccountDetail(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Account Detail - {selectedAccountDetail?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 text-sm gap-y-2">
              <span className="text-muted-foreground">Source ID:</span>
              <span>{selectedAccountDetail?.id}</span>
              <span className="text-muted-foreground">Type:</span>
              <span>{selectedAccountDetail?.type}</span>
              <span className="text-muted-foreground">Available Balance:</span>
              <span className="font-bold">
                {formatNumber(selectedAccountDetail?.balance ?? null)}
              </span>
              <span className="text-muted-foreground">Pending Settlement:</span>
              <span>
                {formatNumber(selectedAccountDetail?.pendingSettlement ?? 0)}
              </span>
            </div>
            <div className="border-t pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recent Activity
              </p>
              <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                No recent transactions for this account found.
              </div>
            </div>
            <div className="flex justify-end border-t pt-4">
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => {
                  setEditingSource(selectedAccountDetail);
                  setSourceEditOpen(true);
                }}
              >
                <Pencil className="w-3 h-3" /> Edit Source
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Detail Dialog */}
      <Dialog
        open={!!selectedTransferDetail}
        onOpenChange={() => setSelectedTransferDetail(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Audit Trail</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 text-sm gap-y-2">
              <span className="text-muted-foreground">Transfer ID:</span>
              <span>{selectedTransferDetail?.id}</span>
              <span className="text-muted-foreground">From Account:</span>
              <span>{selectedTransferDetail?.fromSourceId}</span>
              <span className="text-muted-foreground">To Account:</span>
              <span>{selectedTransferDetail?.toSourceId}</span>
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-bold text-primary">
                {formatNumber(selectedTransferDetail?.amount ?? null)}
              </span>
              <span className="text-muted-foreground">Status:</span>
              <span>
                <ApprovalStatusBadge
                  status={selectedTransferDetail?.status.toUpperCase()}
                />
              </span>
            </div>
            <div className="border-t pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Workflow History
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>
                    Created by {selectedTransferDetail?.requestedBy || "system"}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date().toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Routing to Approval Engine</span>
                  <span className="text-muted-foreground">PENDING</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Treasury Source Create Modal */}
      <TreasurySourceCreateModal
        isOpen={sourceCreateOpen}
        onClose={() => setSourceCreateOpen(false)}
        onSuccess={() => void fetchSources()}
      />

      {/* Treasury Source Edit Modal */}
      <TreasurySourceEditModal
        isOpen={sourceEditOpen}
        onClose={() => { setSourceEditOpen(false); setEditingSource(null); }}
        onSuccess={() => void fetchSources()}
        sourceId={editingSource?.id || ""}
        defaultValues={editingSource ? {
          name: editingSource.name,
          type: editingSource.type,
          currency: editingSource.currency,
          provider: editingSource.provider,
        } : undefined}
      />
    </div>
  );
}
