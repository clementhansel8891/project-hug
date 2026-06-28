import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { ApprovalStatusBadge } from "@/core/tools/ApprovalStatusBadge";
import { FeedbackAlert } from "@/core/tools/FeedbackAlert";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { procurementService } from "@/core/services/procurement/procurementService";
import { formatNumber } from "@/lib/format";
import type { DraftPurchaseOrder, FinalPurchaseOrder, Requisition } from "@/core/types/procurement/procurement";
import { FileText, ClipboardList, Info, Building2, ShoppingCart, CheckCircle2, DollarSign, Tag, ArrowRight, Loader2 } from "lucide-react";
import { supplierQuoteSchema, goodsReceiptSchema, validatePoTransition, type SupplierQuoteFormValues } from "@/modules/procurement/schemas";
import {
  useConfirmSupplierQuote,
  useReleasePurchaseOrder,
  useRecordReceipt,
  PROCUREMENT_KEYS,
} from "@/modules/procurement/hooks";

export default function PoReleaseDesk() {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [drafts, setDrafts] = useState<DraftPurchaseOrder[]>([]);
  const [finalPos, setFinalPos] = useState<FinalPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ─── React Hook Form: Quote Confirmation ──────────────────────────────────────
  const quoteForm = useForm<SupplierQuoteFormValues>({
    resolver: zodResolver(supplierQuoteSchema),
    defaultValues: { draftPoId: "", quoteReference: "", quoteNotes: "" },
  });

  // TanStack Query mutations
  const confirmQuoteMutation = useConfirmSupplierQuote();
  const releasePoMutation = useReleasePurchaseOrder();
  const recordReceiptMutation = useRecordReceipt();

  const quoteIsPending = confirmQuoteMutation.isPending;

  const clearStatus = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [r, d, f] = await Promise.all([
        procurementService.listRequisitions(session.tenant_id, session),
        procurementService.listDraftPurchaseOrders(session.tenant_id, session),
        procurementService.listFinalPurchaseOrders(session.tenant_id, session),
      ]);
      setRequisitions(r);
      setDrafts(d);
      setFinalPos(f);
    } catch (err) {
      setErrorMessage("Failed to load PO release data.");
    } finally {
      setLoading(false);
    }
  }, [session.tenant_id, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredRequisitions = useMemo(
    () =>
      (Array.isArray(requisitions) ? requisitions : []).filter((item) =>
        search
          ? `${item.id} ${item.title} ${item.status}`.toLowerCase().includes(search.toLowerCase())
          : true,
      ),
    [requisitions, search],
  );

  const filteredDrafts = useMemo(
    () =>
      (Array.isArray(drafts) ? drafts : []).filter((item) =>
        search
          ? `${item.id} ${item.requisitionId} ${item.status}`.toLowerCase().includes(search.toLowerCase())
          : true,
      ),
    [drafts, search],
  );

  const filteredFinalPos = useMemo(
    () =>
      (Array.isArray(finalPos) ? finalPos : []).filter((item) =>
        search
          ? `${item.id} ${item.requisitionId} ${item.status}`.toLowerCase().includes(search.toLowerCase())
          : true,
      ),
    [finalPos, search],
  );

  const onSubmitQuote = quoteForm.handleSubmit(async (data) => {
    try {
      await confirmQuoteMutation.mutateAsync(data);
      toast({ title: "Quote Confirmed", description: "Supplier quote confirmed." });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.draftPos });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.requisitions });
      quoteForm.reset();
      setQuoteDialogOpen(false);
      refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Quote confirmation failed.", variant: "destructive" });
    }
  });

  const releasePo = async (requisitionId: string) => {
    // Validate the PO state transition (conceptually: approved → released/received)
    const transition = validatePoTransition("approved", "received");
    if (!transition.valid) {
      toast({ title: "Error", description: transition.error || "Invalid PO state transition.", variant: "destructive" });
      return;
    }
    try {
      await releasePoMutation.mutateAsync(requisitionId);
      toast({ title: "PO Released", description: "Purchase Order released and synchronized with Payable/Receipt systems." });
      refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "PO release failed.", variant: "destructive" });
    }
  };

  const recordReceipt = async (finalPoId: string) => {
    const receiptData = {
      finalPoId,
      deliveryOnTime: true,
      quantityAccuracy: 96,
      qualityScore: 92,
      issueCount: 0,
      invoiceMismatch: false,
    };
    const result = goodsReceiptSchema.safeParse(receiptData);
    if (!result.success) {
      toast({ title: "Error", description: "Receipt data validation failed: " + result.error.issues.map(i => i.message).join(", "), variant: "destructive" });
      return;
    }
    try {
      await recordReceiptMutation.mutateAsync(result.data);
      toast({ title: "Receipt Recorded", description: "Receipt record posted and rating engine updated." });
      refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Receipt recording failed.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="PO Release Desk"
        subtitle="Supplier quote confirmation, final gate checks, PO release, and receipt posting."
        secondaryActions={
          <Input
            placeholder="Search requisition, draft, or PO"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-[240px]"
          />
        }
      />

      <FeedbackAlert message={statusMessage} error={errorMessage} onClear={clearStatus} />

      <WorkspacePanel title="Supplier Quote Gate" description="Procurement HOD approved drafts require supplier quote confirmation.">
        <DataTableShell total={filteredDrafts.length} page={1} pageSize={10}>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Draft PO</th>
                <th className="p-3 text-left">Requisition</th>
                <th className="p-3 text-left">Quoted Total</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-3 text-center">Loading...</td></tr>
              ) : filteredDrafts.length === 0 ? (
                <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">No draft POs found.</td></tr>
              ) : (
                (Array.isArray(filteredDrafts) ? filteredDrafts : []).map((draft) => (
                  <tr key={draft.id} className="border-t">
                    <td className="p-3 font-medium">{draft.id}</td>
                    <td className="p-3 text-muted-foreground">{draft.requisitionId}</td>
                    <td className="p-3 text-muted-foreground">{formatNumber(draft.quotedTotal)}</td>
                    <td className="p-3">
                      <ApprovalStatusBadge status={draft.status} />
                    </td>
                    <td className="p-3">
                      {draft.status === "PROCUREMENT_HOD_APPROVED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedDraftId(draft.id);
                            quoteForm.setValue("draftPoId", draft.id);
                            setQuoteDialogOpen(true);
                          }}
                        >
                          Confirm Supplier Quote
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DataTableShell>
      </WorkspacePanel>

      <WorkspacePanel title="Final Approval and Release" description="Release is allowed only when final multi-HOD approvals are complete.">
        <DataTableShell total={filteredRequisitions.length} page={1} pageSize={10}>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Requisition</th>
                <th className="p-3 text-left">Branch</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-3 text-center">Loading...</td></tr>
              ) : filteredRequisitions.length === 0 ? (
                <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">No requisitions found.</td></tr>
              ) : (
                (Array.isArray(filteredRequisitions) ? filteredRequisitions : []).map((request) => (
                  <tr key={request.id} className="border-t">
                    <td className="p-3 font-medium">{request.id}</td>
                    <td className="p-3 text-muted-foreground">{request.branchCode}</td>
                    <td className="p-3 text-muted-foreground">{formatNumber(request.amount)}</td>
                    <td className="p-3">
                      <ApprovalStatusBadge status={request.status} />
                    </td>
                    <td className="p-3">
                      {request.status === "FINAL_APPROVED" ? (
                        <Button size="sm" onClick={() => releasePo(request.id)}>
                          Release PO
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DataTableShell>
      </WorkspacePanel>

      <WorkspacePanel title="Execution Monitoring" description="Released PO execution and receipt capture updates supplier rating engine.">
        <DataTableShell total={filteredFinalPos.length} page={1} pageSize={10}>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Final PO</th>
                <th className="p-3 text-left">Requisition</th>
                <th className="p-3 text-left">Total</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-3 text-center">Loading...</td></tr>
              ) : filteredFinalPos.length === 0 ? (
                <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">No final POs found.</td></tr>
              ) : (
                (Array.isArray(filteredFinalPos) ? filteredFinalPos : []).map((po) => (
                  <tr key={po.id} className="border-t">
                    <td className="p-3 font-medium">{po.id}</td>
                    <td className="p-3 text-muted-foreground">{po.requisitionId}</td>
                    <td className="p-3 text-muted-foreground">{formatNumber(po.totalAmount)}</td>
                    <td className="p-3">
                      <ApprovalStatusBadge status={po.status} />
                    </td>
                    <td className="p-3">
                      {po.status === "RELEASED" || po.status === "DELIVERING" ? (
                        <Button size="sm" variant="outline" onClick={() => recordReceipt(po.id)}>
                          Record Receipt
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DataTableShell>
      </WorkspacePanel>

      <Dialog open={quoteDialogOpen} onOpenChange={(open) => { if (!open && !quoteIsPending) { quoteForm.reset(); setQuoteDialogOpen(false); } }}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden" aria-describedby="quote-confirm-description">
          <DialogHeader className="sr-only">
            <DialogTitle>Supplier Quote Confirmation</DialogTitle>
          </DialogHeader>
          <div id="quote-confirm-description" className="sr-only">Record the definitive supplier quote reference and any technical/price notes before final PO release.</div>

          <div className="grid md:grid-cols-[1fr_2fr]">
            {/* Left Column: Context */}
            <div className="bg-muted p-6 flex flex-col justify-between border-r shadow-inner">
              <div>
                <Tag className="w-8 h-8 text-primary mb-4" />
                <DialogTitle className="text-xl mb-2">Quote Confirmation</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Finalize the commercial terms. This step bridge the gap between internal estimates and actual supplier pricing.
                </p>
                <div className="mt-8 space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                    <ShoppingCart className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Draft PO Reference</p>
                      <p className="text-xs font-mono">{quoteForm.watch("draftPoId")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-1" />
                    <div>
                      <p className="font-medium text-xs">Validation Required</p>
                      <p className="text-muted-foreground text-[10px]">Ensure the quoted total aligns with the approved requisition budget.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                <p className="text-xs text-primary font-bold flex items-center gap-1.5 uppercase tracking-wider">
                  <Info className="w-3.5 h-3.5" /> Release Trigger
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Confirmation here moves the sequence to <span className="font-bold">FINAL_APPROVAL_PENDING</span>.
                </p>
              </div>
            </div>

            {/* Right Column: Form */}
            <div className="p-6">
              <form onSubmit={onSubmitQuote} noValidate>
                <fieldset disabled={quoteIsPending} className="space-y-6">
                <div>
                  <label htmlFor="quote-ref" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Quote Reference Number</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input 
                      id="quote-ref"
                      placeholder="e.g. Q-2024-889012"
                      {...quoteForm.register("quoteReference")}
                      className="pl-10 h-10 font-medium"
                      aria-describedby={quoteForm.formState.errors.quoteReference ? "quote-ref-error" : undefined}
                      aria-invalid={!!quoteForm.formState.errors.quoteReference}
                    />
                  </div>
                  {quoteForm.formState.errors.quoteReference && (
                    <p id="quote-ref-error" className="text-xs text-destructive mt-1" role="alert">{quoteForm.formState.errors.quoteReference.message}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1.5 italic">Official reference from the supplier's quotation document.</p>
                </div>

                <div className="pt-4 border-t">
                  <label htmlFor="quote-notes" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Negotiation & Technical Notes</label>
                  <Input 
                    id="quote-notes"
                    placeholder="Discounts applied, validity period, payment terms adjustments..."
                    {...quoteForm.register("quoteNotes")}
                    className="h-10"
                  />
                </div>

                <div className="pt-4 border-t">
                  <div className="p-4 rounded-lg bg-warning border border-warning/10">
                    <p className="text-[10px] font-bold uppercase text-warning tracking-widest mb-1 flex items-center gap-1.5">
                      <DollarSign className="w-3 h-3" /> Integrity Check
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      By confirming, you verify that these prices are definitive and reflect the final negotiated agreement.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t mt-4">
                  <Button type="button" variant="outline" disabled={quoteIsPending} onClick={() => { quoteForm.reset(); setQuoteDialogOpen(false); }}>Cancel</Button>
                  <Button type="submit" disabled={quoteIsPending} className="shadow-sm">
                    {quoteIsPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Confirm and Route
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
                </fieldset>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

