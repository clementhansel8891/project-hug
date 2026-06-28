import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { FilterBar } from "@/core/tools/FilterBar";
import { ApprovalStatusBadge } from "@/core/tools/ApprovalStatusBadge";
import { FeedbackAlert } from "@/core/tools/FeedbackAlert";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { procurementService } from "@/core/services/procurement/procurementService";
import type { ContractRecord, Requisition, SupplierMaster } from "@/core/types/procurement/procurement";
import { FileText, ShieldCheck, Signature, ClipboardList, Info, Building2, User, Loader2 } from "lucide-react";
import { contractPacketSchema, type ContractPacketFormValues } from "@/modules/procurement/schemas";
import {
  useUpsertContract,
  useApproveLegalContract,
  useSignContract,
  PROCUREMENT_KEYS,
} from "@/modules/procurement/hooks";

export default function ContractDesk() {
  const navigate = useNavigate();
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ─── React Hook Form: Contract Packet ─────────────────────────────────────────
  const contractForm = useForm<ContractPacketFormValues>({
    resolver: zodResolver(contractPacketSchema),
    defaultValues: { requisitionId: "", supplierId: "", notes: "", attachmentIds: [] },
  });

  // TanStack Query mutations
  const upsertContractMutation = useUpsertContract();
  const approveLegalMutation = useApproveLegalContract();
  const signContractMutation = useSignContract();

  const contractIsPending = upsertContractMutation.isPending;

  const clearStatus = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [c, r, s] = await Promise.all([
        procurementService.listContracts(session.tenant_id, session),
        procurementService.listRequisitions(session.tenant_id, session),
        procurementService.listSupplierMasters(session.tenant_id, session),
      ]);
      setContracts(c);
      setRequisitions(r);
      setSuppliers(s);
    } catch (err) {
      setErrorMessage("Failed to load contract data.");
    } finally {
      setLoading(false);
    }
  }, [session.tenant_id, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredContracts = useMemo(
    () =>
      (Array.isArray(contracts) ? contracts : []).filter((item) =>
        search
          ? `${item.id} ${item.requisitionId} ${item.supplierId}`
              .toLowerCase()
              .includes(search.toLowerCase())
          : true,
      ),
    [contracts, search],
  );

  const onSubmitContract = contractForm.handleSubmit(async (data) => {
    try {
      await upsertContractMutation.mutateAsync(data);
      toast({ title: "Contract Saved", description: "Contract packet created or updated successfully." });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.contracts });
      queryClient.invalidateQueries({ queryKey: PROCUREMENT_KEYS.requisitions });
      contractForm.reset();
      setDialogOpen(false);
      refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to save contract packet.", variant: "destructive" });
    }
  });

  const approveLegal = async (contractId: string) => {
    try {
      await approveLegalMutation.mutateAsync(contractId);
      toast({ title: "Legal Approved", description: "Legal approval recorded." });
      refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Legal approval failed.", variant: "destructive" });
    }
  };

  const sign = async (contractId: string, party: "SUPPLIER" | "PROCUREMENT_HOD" | "FINANCE_HOD") => {
    try {
      await signContractMutation.mutateAsync({ contractId, party });
      toast({ title: "Signed", description: `Contract signed by ${party}.` });
      refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || `Signature by ${party} failed.`, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contract Desk"
        subtitle="Legal collaboration, signature control, and procurement contract governance."
        primaryAction={<Button onClick={() => setDialogOpen(true)}>Create Contract Packet</Button>}
        secondaryActions={
          <Input
            placeholder="Search contracts"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-[220px]"
          />
        }
      />

      <FeedbackAlert message={statusMessage} error={errorMessage} onClear={clearStatus} />

      <WorkspacePanel title="Contract Governance" description="Track legal review and mandatory signatures before PO release.">
        <FilterBar searchValue={search} onSearchChange={setSearch} />
        <DataTableShell total={filteredContracts.length} page={1} pageSize={10}>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Contract</th>
                <th className="p-3 text-left">Requisition</th>
                <th className="p-3 text-left">Supplier</th>
                <th className="p-3 text-left">Version</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-3 text-center">Loading...</td></tr>
              ) : filteredContracts.length === 0 ? (
                <tr><td colSpan={6} className="p-3 text-center text-muted-foreground">No contracts found.</td></tr>
              ) : (
                (Array.isArray(filteredContracts) ? filteredContracts : []).map((contract) => (
                  <tr key={contract.id} className="border-t">
                    <td className="p-3 font-medium">{contract.id}</td>
                    <td className="p-3 text-muted-foreground">{contract.requisitionId}</td>
                    <td className="p-3 text-muted-foreground">{contract.supplierId}</td>
                    <td className="p-3 text-muted-foreground">v{contract.version}</td>
                    <td className="p-3">
                      <ApprovalStatusBadge status={contract.status} />
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {contract.status === "LEGAL_REVIEW" ? (
                          <Button size="sm" variant="outline" onClick={() => approveLegal(contract.id)}>
                            Approve Legal
                          </Button>
                        ) : null}
                        {contract.status === "LEGAL_APPROVED" || contract.status === "PARTIAL_SIGNED" ? (
                          <>
                            {!contract.signedBySupplier ? (
                              <Button size="sm" variant="outline" onClick={() => sign(contract.id, "SUPPLIER")}>
                                Supplier Sign
                              </Button>
                            ) : null}
                            {!contract.signedByProcurementHod ? (
                              <Button size="sm" variant="outline" onClick={() => sign(contract.id, "PROCUREMENT_HOD")}>
                                Procurement HOD Sign
                              </Button>
                            ) : null}
                            {!contract.signedByFinanceHod ? (
                              <Button size="sm" variant="outline" onClick={() => sign(contract.id, "FINANCE_HOD")}>
                                Finance HOD Sign
                              </Button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DataTableShell>
      </WorkspacePanel>

      <WorkspacePanel title="Signature Completeness" description="Mandatory signatures: Supplier + Procurement HOD + Finance HOD.">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Legal Approved</p>
            <p className="text-lg font-semibold">
              {(Array.isArray(contracts) ? contracts : []).filter((item) => item.status === "LEGAL_APPROVED" || item.status === "SIGNED" || item.status === "PARTIAL_SIGNED").length}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Signed</p>
            <p className="text-lg font-semibold">{(Array.isArray(contracts) ? contracts : []).filter((item) => item.status === "SIGNED").length}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Pending Legal Review</p>
            <p className="text-lg font-semibold">{(Array.isArray(contracts) ? contracts : []).filter((item) => item.status === "LEGAL_REVIEW").length}</p>
          </div>
        </div>
      </WorkspacePanel>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !contractIsPending) { contractForm.reset(); setDialogOpen(false); } }}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden" aria-describedby="contract-create-description">
          <DialogHeader className="sr-only">
            <DialogTitle>Create or Update Contract Packet</DialogTitle>
          </DialogHeader>
          <div id="contract-create-description" className="sr-only">Initialize or modify a legal packet. This packet must be approved by Legal before any party can sign.</div>

          <div className="grid md:grid-cols-[1fr_2fr]">
            {/* Left Column: Context & Governance */}
            <div className="bg-muted p-6 flex flex-col justify-between border-r shadow-inner">
              <div>
                <ShieldCheck className="w-8 h-8 text-primary mb-4" />
                <DialogTitle className="text-xl mb-2">Contract Packet</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Secure the legal foundation of this procurement. Packets require mandatory Legal Review followed by tri-party signatures.
                </p>
                
                <div className="mt-8 space-y-4">
                  <div className="flex items-start gap-3 p-3 bg-background rounded-lg border border-primary/10 shadow-sm transition-all hover:bg-primary/5">
                    <Building2 className="w-4 h-4 text-primary mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Target Entity</p>
                      <p className="text-xs font-semibold">{suppliers.find(s => s.id === contractForm.watch("supplierId"))?.name || 'Pending Selection'}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Required Signers</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <Badge variant="outline" className="text-[8px] px-1.5 py-0 bg-background border-dashed opacity-50">Supplier Representative</Badge>
                      <Badge variant="outline" className="text-[8px] px-1.5 py-0 bg-background border-dashed opacity-50">Procurement HOD</Badge>
                      <Badge variant="outline" className="text-[8px] px-1.5 py-0 bg-background border-dashed opacity-50">Finance HOD</Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                <p className="text-xs text-primary font-bold flex items-center gap-1.5 uppercase tracking-wider">
                  <Info className="w-3.5 h-3.5" /> Compliance Mode
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Once created, the status reverts to <span className="text-warning font-bold">LEGAL_REVIEW</span>. Versioning is automatic.
                </p>
              </div>
            </div>

            {/* Right Column: Identification & Terms */}
            <div className="p-6">
              <form onSubmit={onSubmitContract} noValidate>
                <fieldset disabled={contractIsPending} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contract-req" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block tracking-wider">Source Requisition</label>
                    <Select value={contractForm.watch("requisitionId")} onValueChange={(v) => contractForm.setValue("requisitionId", v, { shouldValidate: true })}>
                      <SelectTrigger id="contract-req" className="h-10 text-foreground transition-all focus:ring-1 focus:ring-primary/20"
                        aria-describedby={contractForm.formState.errors.requisitionId ? "contract-req-error" : undefined}
                        aria-invalid={!!contractForm.formState.errors.requisitionId}
                      >
                        <SelectValue placeholder="Select REQ ID" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Array.isArray(requisitions) ? requisitions : []).map(r => (
                          <SelectItem key={r.id} value={r.id}>{r.id} - {r.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {contractForm.formState.errors.requisitionId && (
                      <p id="contract-req-error" className="text-xs text-destructive mt-1" role="alert">{contractForm.formState.errors.requisitionId.message}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="contract-supplier" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block tracking-wider">Selected Supplier</label>
                    <Select value={contractForm.watch("supplierId")} onValueChange={(v) => contractForm.setValue("supplierId", v, { shouldValidate: true })}>
                      <SelectTrigger id="contract-supplier" className="h-10 text-foreground transition-all focus:ring-1 focus:ring-primary/20"
                        aria-describedby={contractForm.formState.errors.supplierId ? "contract-supplier-error" : undefined}
                        aria-invalid={!!contractForm.formState.errors.supplierId}
                      >
                        <SelectValue placeholder="Select Supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Array.isArray(suppliers) ? suppliers : []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {contractForm.formState.errors.supplierId && (
                      <p id="contract-supplier-error" className="text-xs text-destructive mt-1" role="alert">{contractForm.formState.errors.supplierId.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-primary" />
                    <label htmlFor="contract-notes" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground tracking-wider">Legal Terms & Addenda</label>
                  </div>
                  <Textarea 
                    id="contract-notes"
                    placeholder="Describe specific terms (Validty, SLA, Payment terms, etc.)..."
                    className="min-h-[160px] resize-none text-sm p-4 bg-muted/20 focus:bg-background transition-colors"
                    {...contractForm.register("notes")}
                  />
                  <div className="flex gap-4 pt-2">
                    <div 
                      onClick={() => navigate("/core/finance/docs")}
                      className="flex-1 p-2 rounded border border-dashed text-center text-[10px] text-muted-foreground hover:bg-muted/50 cursor-pointer transition-all"
                    >
                      + Access Document Vault
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t mt-4">
                  <Button type="button" variant="outline" disabled={contractIsPending} onClick={() => { contractForm.reset(); setDialogOpen(false); }} className="hover:bg-muted">Cancel</Button>
                  <Button type="submit" disabled={contractIsPending} className="shadow-sm">
                    {contractIsPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Signature className="w-4 h-4 mr-2" />}
                    {contracts.some(c => c.requisitionId === contractForm.watch("requisitionId")) ? 'Update Packet' : 'Initialize Packet'}
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

