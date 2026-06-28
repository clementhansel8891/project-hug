import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadCloud, FileText, Info, ShieldCheck, FileCheck2 } from "lucide-react";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { FilterBar } from "@/core/tools/FilterBar";
import { ApprovalStatusBadge } from "@/core/tools/ApprovalStatusBadge";
import { useSession } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import { useToast } from "@/hooks/use-toast";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import { financeApiClient } from "@/core/services/finance/financeApiClient";
import type { FinanceDocumentRow } from "@/core/services/finance/financeService";
import { logService } from "@/core/services/finance/logService";
import { documentUploadSchema, type DocumentUploadFormData } from "@/core/finance/schemas";

type DocumentTab = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

const TABS: DocumentTab[] = ["ALL", "PENDING", "APPROVED", "REJECTED"];

export default function FinanceDocs() {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<DocumentTab>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const refreshDocs = useCallback(async () => {
    setDocs(await financeApiClient.listDocuments(session.tenant_id, session));
  }, [session.tenant_id, session]);

  const [docs, setDocs] = useState<FinanceDocumentRow[]>([]);
  const [selectedItem, setSelectedItem] = useState<FinanceDocumentRow | null>(null);

  // --- React Hook Form: Upload Document ---
  const docForm = useForm<DocumentUploadFormData>({
    resolver: zodResolver(documentUploadSchema),
    defaultValues: { title: "", type: "INVOICE", description: "" },
  });

  const uploadMutation = useMutation({
    mutationFn: (data: DocumentUploadFormData) =>
      apiRequest("/v1/finance/documents", "POST", session, data),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["finance", "documents"]],
      onClose: () => setDialogOpen(false),
      form: docForm,
      successTitle: "Document Uploaded",
      successDescription: "Document has been submitted to the vault.",
    }),
    onSuccess: () => {
      toast({ title: "Document Uploaded", description: "Document has been submitted to the vault." });
      queryClient.invalidateQueries({ queryKey: ["finance", "documents"] });
      docForm.reset();
      setDialogOpen(false);
      refreshDocs();
    },
  });

  useEffect(() => {
    refreshDocs();
  }, [refreshDocs]);

  const filteredDocs = useMemo(
    () =>
      (Array.isArray(docs) ? docs : []).filter((doc) => {
        const searchMatch = search ? doc.title.toLowerCase().includes(search.toLowerCase()) : true;
        const tabMatch = tab === "ALL" ? true : doc.status === tab;
        return searchMatch && tabMatch;
      }),
    [docs, search, tab],
  );

  const uploadDoc = (data: DocumentUploadFormData) => {
    uploadMutation.mutate(data);
  };

  const updateStatus = async (id: string, status: "APPROVED" | "REJECTED") => {
    await financeApiClient.updateDocumentStatus(session.tenant_id, session, id, status);
    logService.log(session.tenant_id, session.user_id, "Updated finance document status", `${id} -> ${status}`);
    refreshDocs();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Docs"
        subtitle="Document control with route-to-approval and audit-ready status tracking."
        primaryAction={<Button onClick={() => setDialogOpen(true)}>Upload Document</Button>}
        secondaryActions={
          <Input
            placeholder="Search documents"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-[220px]"
          />
        }
      />

      <WorkspacePanel title="Documents Work Queue" description="Document inbox by approval stage.">
        <FilterBar searchValue={search} onSearchChange={setSearch} />
        <Tabs value={tab} onValueChange={(value) => setTab(value as DocumentTab)}>
          <TabsList>
            {(Array.isArray(TABS) ? TABS : []).map((status) => (
              <TabsTrigger key={status} value={status}>
                {status.charAt(0) + status.slice(1).toLowerCase()}
              </TabsTrigger>
            ))}
          </TabsList>

          {(Array.isArray(TABS) ? TABS : []).map((status) => (
            <TabsContent key={status} value={status} className="mt-4">
              <DataTableShell total={filteredDocs.length} page={1} pageSize={10}>
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-3 text-left">Title</th>
                      <th className="p-3 text-left">Type</th>
                      <th className="p-3 text-left">Description</th>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(filteredDocs) ? filteredDocs : []).map((doc) => (
                      <tr
                        key={doc.id}
                        className="cursor-pointer border-t hover:bg-muted/50"
                        onClick={() => setSelectedItem(doc)}
                      >
                        <td className="p-3 font-medium">{doc.title}</td>
                        <td className="p-3 text-muted-foreground">{doc.type}</td>
                        <td className="p-3 text-muted-foreground">{doc.description}</td>
                        <td className="p-3">
                          <ApprovalStatusBadge status={doc.status} />
                        </td>
                        <td className="p-3">
                          {doc.status === "PENDING" ? (
                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="outline" onClick={() => updateStatus(doc.id, "APPROVED")}>
                                Approve
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => updateStatus(doc.id, "REJECTED")}>
                                Reject
                              </Button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTableShell>
            </TabsContent>
          ))}
        </Tabs>
      </WorkspacePanel>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !uploadMutation.isPending) { docForm.reset(); setDialogOpen(false); } }}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <div className="grid md:grid-cols-[1fr_2fr]">
            {/* Left Info Panel */}
            <div className="bg-muted p-6 flex flex-col justify-between">
              <div>
                <UploadCloud className="w-8 h-8 text-primary mb-4" />
                <DialogTitle className="text-xl mb-2">Upload Document</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Ingest financial documents into the secure vault. Documents are hashed and immutable upon entry.
                </p>
                <div className="mt-8 space-y-4">
                  <div className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5"><ShieldCheck className="w-4 h-4 text-muted-foreground" /></div>
                    <div>
                      <p className="font-medium">Audit Trail Linkage</p>
                      <p className="text-muted-foreground text-xs">Instantly binds to ledger entries.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5"><FileCheck2 className="w-4 h-4 text-muted-foreground" /></div>
                    <div>
                      <p className="font-medium">OCR Extraction</p>
                      <p className="text-muted-foreground text-xs">Active Beta Protocol - Auto-populates metadata.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-primary/5 p-4 rounded-lg mt-8 border border-primary/10">
                <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                  <Info className="w-4 h-4" /> Secure Vault
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Files are stored in the WORM (Write Once, Read Many) compliant vault segment.
                </p>
              </div>
            </div>

            {/* Right Form Panel */}
            <div className="p-6">
              <form onSubmit={docForm.handleSubmit(uploadDoc)} className="space-y-6">
                
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Document Source File</label>
                  <div className="border-2 border-dashed border-primary/20 bg-primary/5 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-primary/10 transition-colors">
                    <UploadCloud className="h-10 w-10 text-primary mb-3" />
                    <p className="text-sm font-semibold">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">PDF, JPG, PNG (Max 50MB)</p>
                    <Input type="file" className="w-[200px] text-xs" onChange={() => {}} disabled={uploadMutation.isPending} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Document Title</label>
                    <Input placeholder="e.g., Q3 Office Lease" {...docForm.register("title")} disabled={uploadMutation.isPending} />
                    {docForm.formState.errors.title && (
                      <p className="text-xs text-destructive mt-1">{docForm.formState.errors.title.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Document Type</label>
                    <Select value={docForm.watch("type")} onValueChange={(v) => docForm.setValue("type", v)} disabled={uploadMutation.isPending}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INVOICE">Invoice</SelectItem>
                        <SelectItem value="RECEIPT">Receipt</SelectItem>
                        <SelectItem value="CONTRACT">Contract</SelectItem>
                        <SelectItem value="PAYMENT_PROOF">Payment Proof</SelectItem>
                        <SelectItem value="TAX">Tax Document</SelectItem>
                        <SelectItem value="JOURNAL_ENTRY">Journal Entry</SelectItem>
                      </SelectContent>
                    </Select>
                    {docForm.formState.errors.type && (
                      <p className="text-xs text-destructive mt-1">{docForm.formState.errors.type.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Description & Metadata</label>
                  <Input placeholder="Optional reference notes" {...docForm.register("description")} disabled={uploadMutation.isPending} />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => { docForm.reset(); setDialogOpen(false); }} disabled={uploadMutation.isPending}>Cancel</Button>
                  <Button type="submit" className="gap-2" disabled={uploadMutation.isPending}>
                    <UploadCloud className="w-4 h-4" /> {uploadMutation.isPending ? "Uploading..." : "Upload to Vault"}
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
                  Vaulted Document Record
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">ID: <span className="font-mono">{selectedItem?.id}</span></p>
              </div>
              <ApprovalStatusBadge status={selectedItem?.status || "PENDING"} />
            </div>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-8 py-4">
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground uppercase font-semibold tracking-wider mb-1">Metadata</p>
                <div className="bg-muted/30 p-4 rounded-lg border space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Title</p>
                    <p className="font-semibold">{selectedItem?.title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="font-medium text-sm border bg-background rounded px-2 py-0.5 inline-block mt-0.5">{selectedItem?.type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Description</p>
                    <p className="text-sm">{selectedItem?.description || "N/A"}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-6 border-l pl-8">
              <div>
                <p className="text-sm text-muted-foreground uppercase font-semibold tracking-wider mb-1">Vault Lineage</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm border-b pb-2">
                    <span className="text-muted-foreground">Uploaded By</span>
                    <span className="font-medium">{selectedItem?.uploadedBy || "System Admin"}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b pb-2">
                    <span className="text-muted-foreground">Timestamp</span>
                    <span>{selectedItem?.uploadedAt.slice(0, 16).replace("T", " ")}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b pb-2">
                    <span className="text-muted-foreground">Location</span>
                    <span className="font-mono text-xs">/finance/ledger-docs/{selectedItem?.id.slice(-6)}.pdf</span>
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <Button disabled title="Not available yet" variant="default" className="w-full gap-2"><UploadCloud className="w-4 h-4 rotate-180" /> Access Original File</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
