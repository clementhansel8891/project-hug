import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { FilterBar } from "@/core/tools/FilterBar";
import { useSession } from "@/core/security/session";
import { legalService } from "@/core/services/hr/legalService";
import { workflowService } from "@/core/services/hr/workflowService";
import { procurementService } from "@/core/services/procurement/procurementService";
import { buildTemplatePreview, contractTemplates } from "@/core/tools/docs/TemplateEngine";
import { DocumentViewer } from "@/core/tools/docs/DocumentViewer";
import type { ContractRecord, VisaRecord } from "@/core/hr/legal/contractTypes";
import type { LegalContractHandoff } from "@/core/types/procurement/procurement";
import { EmptyState } from "@/components/shared/AsyncState";
import { CreateLegalContractModal } from "./modals";

export default function LexBoard() {
  const session = useSession();
  const [version, setVersion] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(contractTemplates[0]?.id ?? "tpl-employment");
  const [search, setSearch] = useState("");
  
  const [compliance, setCompliance] = useState<{
    contracts: ContractRecord[];
    expiringVisas: VisaRecord[];
    pendingRenewals: number;
  }>({ contracts: [], expiringVisas: [], pendingRenewals: 0 });
  
  const [procurementHandoffs, setProcurementHandoffs] = useState<LegalContractHandoff[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [comp, handoffs] = await Promise.all([
          legalService.getComplianceCases(session.tenant_id, session),
          procurementService.listLegalHandoffs(session.tenant_id, session),
        ]);
        setCompliance(comp);
        setProcurementHandoffs(handoffs);
      } catch (err) {
        console.error("Failed to load lex board data", err);
      }
    };
    loadData();
  }, [session.tenant_id, session, version]);

  const filteredContracts = (Array.isArray(compliance.contracts) ? compliance.contracts : []).filter((contract) =>
    search ? contract.title.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="LexBoard"
        subtitle="Contract intelligence, visa tracking, and compliance routing."
        primaryAction={
          <Button onClick={() => setDialogOpen(true)}>Create Contract</Button>
        }
        secondaryActions={<Input placeholder="Search contracts" className="min-w-[200px]" value={search} onChange={(e) => setSearch(e.target.value)} />}
      />

      <WorkspacePanel title="WorkQueue" description="Legal actions that require follow-up.">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              const target = compliance.contracts[0];
              if (target) {
                await workflowService.createRequest(session.tenant_id, session, {
                  entityType: "CONTRACT",
                  entityId: target.id,
                  makerDept: session.department_id,
                  destinationDept: "LEGAL",
                  notes: "LexBoard routing",
                });
              }
            }}
          >
            Send to FlowGate
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const target = compliance.contracts[0];
              if (target) {
                await legalService.requestRenewal(session.tenant_id, session, target.id);
                setVersion((prev) => prev + 1);
              }
            }}
          >
            Request Renewal
          </Button>
        </div>
      </WorkspacePanel>

      <WorkspacePanel title="Active Records" description="Contracts and visa tracking.">
        <FilterBar searchValue={search} onSearchChange={setSearch} />
        <DataTableShell total={filteredContracts.length} page={1} pageSize={10}>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Contract</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-0">
                    <EmptyState
                      title="No contracts"
                      description="No contracts match the current search. Create a contract to populate this list."
                    />
                  </td>
                </tr>
              ) : (
                (Array.isArray(filteredContracts) ? filteredContracts : []).map((contract) => (
                <tr key={contract.id} className="border-t">
                  <td className="p-3">{contract.title}</td>
                  <td className="p-3 text-muted-foreground">{contract.type}</td>
                  <td className="p-3 text-muted-foreground">{contract.status}</td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </DataTableShell>
      </WorkspacePanel>

      <WorkspacePanel title="Procurement handoff queue" description="Contract ownership handoff routed from Procurement.">
        <div className="space-y-3 text-sm">
          {procurementHandoffs.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-muted-foreground">
              No procurement contract handoffs yet.
            </p>
          ) : (
            procurementHandoffs.slice(0, 6).map((handoff) => (
              <div key={handoff.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium text-foreground">{handoff.contractId}</p>
                  <p className="text-xs text-muted-foreground">
                    Requisition {handoff.requisitionId} | Status: {handoff.status}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={handoff.status !== "PENDING_LEGAL_ACK"}
                  onClick={async () => {
                    await procurementService.acknowledgeLegalHandoff(
                      session.tenant_id,
                      session,
                      handoff.id,
                    );
                    setVersion((prev) => prev + 1);
                  }}
                >
                  Acknowledge
                </Button>
              </div>
            ))
          )}
        </div>
      </WorkspacePanel>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <WorkspacePanel title="Pending Approvals" description="Legal workflow queue.">
          <div className="space-y-3 text-sm text-muted-foreground">
            {compliance.contracts.slice(0, 4).map((contract) => (
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
                      notes: "LexBoard approval",
                    });
                  }}
                >
                  Route
                </Button>
              </div>
            ))}
          </div>
        </WorkspacePanel>

        <WorkspacePanel title="Insights" description="Compliance risk indicators.">
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Expiring visas</span>
              <span className="font-semibold text-foreground">{compliance.expiringVisas.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Pending renewals</span>
              <span className="font-semibold text-foreground">{compliance.pendingRenewals}</span>
            </div>
          </div>
        </WorkspacePanel>
      </div>
      <CreateLegalContractModal
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        templates={contractTemplates.map((t) => ({ id: t.id, name: t.name }))}
        onSuccess={() => setVersion((prev) => prev + 1)}
      />
    </div>
  );
}
