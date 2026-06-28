import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { FilterBar } from "@/core/tools/FilterBar";
import { useSession } from "@/core/security/session";
import { documentService } from "@/core/services/hr/documentService";
import { legalService } from "@/core/services/hr/legalService";
import { workflowService } from "@/core/services/hr/workflowService";
import { EmptyState } from "@/components/shared/AsyncState";
import { CreateVaultDocumentModal } from "./modals";

export default function VaultSpace() {
  const session = useSession();
  const [search, setSearch] = useState("");
  const [version, setVersion] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"contract" | "export" | "attach">("contract");
  const [docTitle, setDocTitle] = useState("HR Document");
  const [docType, setDocType] = useState<"CONTRACT" | "VISA_FILE" | "POLICY" | "PAYROLL_EXPORT" | "KPI_REPORT">("CONTRACT");
  const [notes, setNotes] = useState("");

  const [documents, setDocuments] = useState<any[]>([]);
  const [compliance, setCompliance] = useState<{ contracts: any[]; pendingRenewals: number }>({ contracts: [], pendingRenewals: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const items = await documentService.listVaultItems(session.tenant_id, session);
        const filtered = search
          ? (Array.isArray(items) ? items : []).filter((item) => item.title.toLowerCase().includes(search.toLowerCase()))
          : items;
        setDocuments(filtered);

        const comp = await legalService.getComplianceCases(session.tenant_id, session);
        setCompliance(comp);
      } catch (error) {
        console.error("Failed to load vault data", error);
      }
    };
    fetchData();
  }, [session, search, version]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="VaultSpace"
        subtitle="Secure HR document vault and compliance-ready storage."
        primaryAction={
          <Button
            onClick={async () => {
              await documentService.createVaultItem(session.tenant_id, session, {
                title: "Employment Pack",
                type: "CONTRACT",
              });
              setVersion((prev) => prev + 1);
            }}
          >
            Create Folder
          </Button>
        }
        secondaryActions={<Input placeholder="Search vault" className="min-w-[200px]" value={search} onChange={(e) => setSearch(e.target.value)} />}
      />

      <WorkspacePanel title="WorkQueue" description="Document actions and approvals.">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setActionType("contract");
              setDocTitle("Employment Contract");
              setDocType("CONTRACT");
              setDialogOpen(true);
            }}
          >
            Generate Contract
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await documentService.exportVault(session.tenant_id, session);
            }}
          >
            Export Staff Report
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setActionType("attach");
              setDocTitle("HR Policy");
              setDocType("POLICY");
              setDialogOpen(true);
            }}
          >
            Attach Document
          </Button>
        </div>
      </WorkspacePanel>

      <WorkspacePanel title="Active Records" description="Document vault inventory.">
        <FilterBar searchValue={search} onSearchChange={setSearch} />
        <DataTableShell total={documents.length} page={1} pageSize={10}>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Document</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-0">
                    <EmptyState
                      title="No documents"
                      description="The document vault has no records for the current search scope."
                    />
                  </td>
                </tr>
              ) : (
                (Array.isArray(documents) ? documents : []).map((doc) => (
                <tr key={doc.id} className="border-t">
                  <td className="p-3 font-medium text-foreground">{doc.title}</td>
                  <td className="p-3 text-muted-foreground">{doc.type}</td>
                  <td className="p-3 text-muted-foreground">{doc.status}</td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </DataTableShell>
      </WorkspacePanel>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <WorkspacePanel title="Pending Approvals" description="Legal approvals for documents.">
          <div className="space-y-3 text-sm text-muted-foreground">
            {compliance.contracts.slice(0, 3).map((contract) => (
              <div key={contract.id} className="flex items-center justify-between rounded-lg border p-3">
                <span>{contract.title}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await workflowService.createRequest(session.tenant_id, session, {
                      entityType: "CONTRACT",
                      entityId: contract.id,
                      makerDept: session.department_id,
                      destinationDept: "LEGAL",
                      notes: "VaultSpace routing",
                    });
                  }}
                >
                  Send to FlowGate
                </Button>
              </div>
            ))}
          </div>
        </WorkspacePanel>

        <WorkspacePanel title="Insights" description="Vault health and compliance.">
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Total documents</span>
              <span className="font-semibold text-foreground">{documents.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Pending renewals</span>
              <span className="font-semibold text-foreground">{compliance.pendingRenewals}</span>
            </div>
          </div>
        </WorkspacePanel>
      </div>

      <CreateVaultDocumentModal
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => setVersion((prev) => prev + 1)}
      />
    </div>
  );
}
