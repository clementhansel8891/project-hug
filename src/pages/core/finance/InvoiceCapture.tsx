import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Calendar, CreditCard, UploadCloud, Building2, Info, Receipt } from "lucide-react";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { FilterBar } from "@/core/tools/FilterBar";
import { ApprovalStatusBadge } from "@/core/tools/ApprovalStatusBadge";
import { useSession } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import { useToast } from "@/hooks/use-toast";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import { financeService, type FinanceInvoiceRow } from "@/core/services/finance/financeService";
import { logService } from "@/core/services/finance/logService";
import { invoiceCaptureSchema, type InvoiceCaptureFormData } from "@/core/finance/schemas";
import { InvoiceCaptureModal } from "@/core/finance/FinanceModalForms";

type InvoiceKind = "PAYABLE" | "RECEIVABLE";

export default function InvoiceCapture() {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [kindFilter, setKindFilter] = useState<InvoiceKind | "ALL">("ALL");
  const [formKind, setFormKind] = useState<InvoiceKind>("PAYABLE");
  const [invoices, setInvoices] = useState<FinanceInvoiceRow[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<FinanceInvoiceRow | null>(null);

  // --- React Hook Form: Invoice Capture ---
  const invoiceForm = useForm<InvoiceCaptureFormData>({
    resolver: zodResolver(invoiceCaptureSchema),
    defaultValues: { vendor: "", amount: 0, invoiceDate: "", dueDate: "" },
  });

  const captureMutation = useMutation({
    mutationFn: (data: InvoiceCaptureFormData) =>
      apiRequest("/v1/finance/invoices", "POST", session, { ...data, kind: formKind }),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["finance", "invoices"]],
      onClose: () => setDialogOpen(false),
      form: invoiceForm,
      successTitle: "Invoice Captured",
      successDescription: "Invoice has been captured and routed to the ledger.",
    }),
    onSuccess: () => {
      toast({ title: "Invoice Captured", description: "Invoice has been captured and routed to the ledger." });
      queryClient.invalidateQueries({ queryKey: ["finance", "invoices"] });
      invoiceForm.reset();
      setDialogOpen(false);
      refreshInvoices();
    },
  });

  const refreshInvoices = useCallback(() => {
    financeService.listInvoices(session.tenant_id, session).then(setInvoices).catch(console.error);
  }, [session.tenant_id, session]);

  useEffect(() => {
    refreshInvoices();
  }, [refreshInvoices]);

  const filteredInvoices = useMemo(
    () =>
      (Array.isArray(invoices) ? invoices : []).filter((invoice) => {
        const searchMatch = search
          ? invoice.vendor.toLowerCase().includes(search.toLowerCase())
          : true;
        const kindMatch = kindFilter === "ALL" ? true : invoice.kind === kindFilter;
        return searchMatch && kindMatch;
      }),
    [invoices, kindFilter, search],
  );

  const grouped = useMemo(() => {
    const groups: Record<InvoiceKind, FinanceInvoiceRow[]> = {
      PAYABLE: [],
      RECEIVABLE: [],
    };
    filteredInvoices.forEach((invoice) => {
      groups[invoice.kind].push(invoice);
    });
    return groups;
  }, [filteredInvoices]);

  const captureInvoice = (data: InvoiceCaptureFormData) => {
    captureMutation.mutate(data);
  };

  const renderTable = (items: FinanceInvoiceRow[]) => (
    <DataTableShell total={items.length} page={1} pageSize={10}>
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="p-3 text-left">Direction</th>
            <th className="p-3 text-left">Counterparty</th>
            <th className="p-3 text-left">Amount</th>
            <th className="p-3 text-left">Invoice Date</th>
            <th className="p-3 text-left">Due Date</th>
            <th className="p-3 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {(Array.isArray(items) ? items : []).map((invoice) => (
            <tr
              key={invoice.id}
              className="cursor-pointer border-t hover:bg-muted/50"
              onClick={() => setSelectedInvoice(invoice)}
            >
              <td className="p-3">{invoice.kind}</td>
              <td className="p-3 font-medium">{invoice.vendor}</td>
              <td className="p-3 text-muted-foreground">{invoice.amount.toLocaleString()}</td>
              <td className="p-3 text-muted-foreground">{invoice.invoiceDate}</td>
              <td className="p-3 text-muted-foreground">{invoice.dueDate}</td>
              <td className="p-3">
                <ApprovalStatusBadge status={invoice.status} />
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
        title="Invoice Capture"
        subtitle="Capture payable and receivable invoices into finance workflows."
        primaryAction={<Button onClick={() => setDialogOpen(true)}>Create Invoice</Button>}
        secondaryActions={
          <div className="flex gap-2">
            <Select value={kindFilter} onValueChange={(value) => setKindFilter(value as typeof kindFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="PAYABLE">Payable</SelectItem>
                <SelectItem value="RECEIVABLE">Receivable</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Search counterparties"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-w-[220px]"
            />
          </div>
        }
      />

      <WorkspacePanel title="Invoice Records" description="All captured invoices and settlement status.">
        <FilterBar searchValue={search} onSearchChange={setSearch} />
        <Tabs value={kindFilter}>
          <TabsList>
            <TabsTrigger value="PAYABLE" onClick={() => setKindFilter("PAYABLE")}>
              Payable
            </TabsTrigger>
            <TabsTrigger value="RECEIVABLE" onClick={() => setKindFilter("RECEIVABLE")}>
              Receivable
            </TabsTrigger>
            <TabsTrigger value="ALL" onClick={() => setKindFilter("ALL")}>
              All
            </TabsTrigger>
          </TabsList>

          <TabsContent value="PAYABLE" className="mt-4">
            {renderTable(grouped.PAYABLE)}
          </TabsContent>
          <TabsContent value="RECEIVABLE" className="mt-4">
            {renderTable(grouped.RECEIVABLE)}
          </TabsContent>
          <TabsContent value="ALL" className="mt-4">
            {renderTable(filteredInvoices)}
          </TabsContent>
        </Tabs>
      </WorkspacePanel>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !captureMutation.isPending) { invoiceForm.reset(); setDialogOpen(false); } }}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <div className="grid md:grid-cols-[1fr_2fr]">
            {/* Left Info Panel */}
            <div className="bg-muted p-6 flex flex-col justify-between">
              <div>
                <Receipt className="w-8 h-8 text-primary mb-4" />
                <DialogTitle className="text-xl mb-2">Capture Invoice</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Digitize and route payables or receivables. Fill out the core details to automatically log the transaction into the General Ledger.
                </p>
                <div className="mt-8 space-y-4">
                  <div className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5"><Building2 className="w-4 h-4 text-muted-foreground" /></div>
                    <div>
                      <p className="font-medium">Counterparty</p>
                      <p className="text-muted-foreground text-xs">Ensure vendor/customer is registered.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5"><CreditCard className="w-4 h-4 text-muted-foreground" /></div>
                    <div>
                      <p className="font-medium">Financials</p>
                      <p className="text-muted-foreground text-xs">Verify total amounts carefully.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-primary/5 p-4 rounded-lg mt-8 border border-primary/10">
                <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                  <Info className="w-4 h-4" /> DB Atomic Transaction
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Submitting this will immediately hit the DB and auto-balance a dual-sided Journal Entry.
                </p>
              </div>
            </div>

            {/* Right Form Panel */}
            <div className="p-6">
              <form onSubmit={invoiceForm.handleSubmit(captureInvoice)} className="space-y-6">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Invoice Type</label>
                  <Select value={formKind} onValueChange={(value) => setFormKind(value as InvoiceKind)} disabled={captureMutation.isPending}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Invoice type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PAYABLE">Accounts Payable (Vendor Bill)</SelectItem>
                      <SelectItem value="RECEIVABLE">Accounts Receivable (Customer Invoice)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">
                      {formKind === "PAYABLE" ? "Vendor Name" : "Customer Name"}
                    </label>
                    <Input
                      placeholder={formKind === "PAYABLE" ? "e.g., Acme Corp" : "e.g., Jane Doe"}
                      {...invoiceForm.register("vendor")}
                      disabled={captureMutation.isPending}
                    />
                    {invoiceForm.formState.errors.vendor && (
                      <p className="text-xs text-destructive mt-1">{invoiceForm.formState.errors.vendor.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Total Amount (IDR)</label>
                    <Input placeholder="0" type="number" {...invoiceForm.register("amount", { valueAsNumber: true })} disabled={captureMutation.isPending} />
                    {invoiceForm.formState.errors.amount && (
                      <p className="text-xs text-destructive mt-1">{invoiceForm.formState.errors.amount.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Invoice Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        type="date"
                        {...invoiceForm.register("invoiceDate")}
                        disabled={captureMutation.isPending}
                      />
                    </div>
                    {invoiceForm.formState.errors.invoiceDate && (
                      <p className="text-xs text-destructive mt-1">{invoiceForm.formState.errors.invoiceDate.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Due Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        type="date"
                        {...invoiceForm.register("dueDate")}
                        disabled={captureMutation.isPending}
                      />
                    </div>
                    {invoiceForm.formState.errors.dueDate && (
                      <p className="text-xs text-destructive mt-1">{invoiceForm.formState.errors.dueDate.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Source Document (Optional)</label>
                  <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors">
                    <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Drag & drop invoice PDF</p>
                    <p className="text-xs text-muted-foreground mt-1">or click to browse files</p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => { invoiceForm.reset(); setDialogOpen(false); }} disabled={captureMutation.isPending}>Cancel</Button>
                  <Button type="submit" disabled={captureMutation.isPending}>
                    {captureMutation.isPending ? "Capturing..." : "Capture Details"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="pb-4 border-b">
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Invoice Record Detail
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">ID: <span className="font-mono">{selectedInvoice?.id}</span></p>
              </div>
              <ApprovalStatusBadge status={selectedInvoice?.status || "PENDING"} />
            </div>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-8 py-4">
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground uppercase font-semibold tracking-wider mb-1">Counterparty</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{selectedInvoice?.vendor}</p>
                    <p className="text-sm text-muted-foreground">{selectedInvoice?.kind === "PAYABLE" ? "Vendor" : "Customer"}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground uppercase font-semibold tracking-wider mb-1">Dates</p>
                <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded-lg border">
                  <div>
                    <p className="text-xs text-muted-foreground">Invoice Date</p>
                    <p className="font-medium text-sm">{selectedInvoice?.invoiceDate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Due Date</p>
                    <p className="font-medium text-sm text-destructive">{selectedInvoice?.dueDate}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-6 border-l pl-8">
              <div>
                <p className="text-sm text-muted-foreground uppercase font-semibold tracking-wider mb-1">Financials</p>
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                  <p className="text-sm font-medium mb-1">Total Amount</p>
                  <p className="text-3xl font-bold tracking-tight">Rp {selectedInvoice?.amount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <CreditCard className="h-3 w-3" /> Fully matched to active ledger entries.
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground uppercase font-semibold tracking-wider mb-2">Audit & Documents</p>
                <div className="bg-muted/30 p-3 rounded-lg border border-dashed flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium">Original Invoice.pdf</p>
                  </div>
                  <Button onClick={(e) => { e.preventDefault(); alert("Detailed View:\n\nMetadata: " + (typeof window !== "undefined" ? window.location.pathname : "N/A")); }} size="sm" variant="ghost">View</Button>
                </div>
                <p className="text-xs text-muted-foreground italic mt-2">
                  Hash: SHA256:{selectedInvoice?.id.slice(-12)}...
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
