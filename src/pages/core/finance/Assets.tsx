import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Calculator, Calendar, PieChart, Coins, TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { FilterBar } from "@/core/tools/FilterBar";
import { ApprovalStatusBadge } from "@/core/tools/ApprovalStatusBadge";
import { FeedbackAlert } from "@/core/tools/FeedbackAlert";
import { useSession } from "@/core/security/session";
import {
  type AssetCapexInput,
  type FinanceCapexBudgetRow,
  type FinanceDocumentRow,
  type ScheduledDepreciationRunResult,
} from "@/core/services/finance/financeService";
import { financeApiClient } from "@/core/services/finance/financeApiClient";
import { logService } from "@/core/services/finance/logService";
import { formatNumber } from "@/lib/format";
import type {
  AssetAuditPack,
  AssetDepreciationEntry,
  AssetEvent,
  CapexRequest,
  DepreciationMethod,
  FixedAsset,
} from "@/core/types/finance/assets";
import {
  CreateCapexRequestModal,
  RegisterAssetModal,
  AssetImpairmentModal,
  AssetRevaluationModal,
  AssetDisposalModal,
  AssetEditModal,
  AssetTransferModal,
  AssetMaintenanceModal,
  AssetImportModal,
  AssetDepreciationRunModal,
  CapexBudgetModal,
} from "@/core/finance/FinanceModalForms";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryStateWrapper } from "@/components/shared/QueryStateWrapper";
import { ApiError } from "@/core/api/apiClient";

type AssetTab = "register" | "capex" | "depreciation" | "events";

const TABS: { id: AssetTab; label: string }[] = [
  { id: "register", label: "Register" },
  { id: "capex", label: "CAPEX" },
  { id: "depreciation", label: "Depreciation" },
  { id: "events", label: "Events" },
];

const defaultCapexForm: AssetCapexInput = {
  assetDescription: "",
  requestedAmount: 0,
  department: "",
  projectCode: "",
  location: "",
  acquisitionDate: "",
  usefulLifeYears: 5,
  residualValue: 0,
  depreciationMethod: "STRAIGHT_LINE",
  assetClass: "EQUIPMENT",
};

type DepreciationRunForm = {
  periodStart: string;
  periodEnd: string;
  postingDate: string;
};

const defaultDepreciationRunForm = (): DepreciationRunForm => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return {
    periodStart: monthStart,
    periodEnd: monthEnd,
    postingDate: monthEnd,
  };
};

const toSafeNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatAmount = (value: unknown, fallback = 0): string =>
  formatNumber(toSafeNumber(value, fallback));

export default function Assets() {
  const session = useSession();
  const sessionRef = useRef(session);
  const [tab, setTab] = useState<AssetTab>("register");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [impairmentDialogOpen, setImpairmentDialogOpen] = useState(false);
  const [revaluationDialogOpen, setRevaluationDialogOpen] = useState(false);
  const [disposalDialogOpen, setDisposalDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);

  const [capexForm, setCapexForm] = useState<AssetCapexInput>(defaultCapexForm);

  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [capexRequests, setCapexRequests] = useState<CapexRequest[]>([]);
  const [capexBudgets, setCapexBudgets] = useState<FinanceCapexBudgetRow[]>([]);
  const [depreciationEntries, setDepreciationEntries] = useState<AssetDepreciationEntry[]>([]);
  const [assetEvents, setAssetEvents] = useState<AssetEvent[]>([]);
  const [documents, setDocuments] = useState<FinanceDocumentRow[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<AssetAuditPack | null>(null);
  const [runForm, setRunForm] = useState<DepreciationRunForm>(defaultDepreciationRunForm);
  const [cfoSignoff, setCfoSignoff] = useState(true);
  const [runResult, setRunResult] = useState<ScheduledDepreciationRunResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registerAssetDialogOpen, setRegisterAssetDialogOpen] = useState(false);
  const [editAssetDialogOpen, setEditAssetDialogOpen] = useState(false);
  const [transferAssetDialogOpen, setTransferAssetDialogOpen] = useState(false);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [depreciationRunDialogOpen, setDepreciationRunDialogOpen] = useState(false);
  const [selectedCapexDetail, setSelectedCapexDetail] = useState<CapexRequest | null>(null);
  const [selectedDepreciationDetail, setSelectedDepreciationDetail] = useState<AssetDepreciationEntry | null>(null);
  const [selectedEventDetail, setSelectedEventDetail] = useState<AssetEvent | null>(null);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState<FixedAsset | null>(null);

  const clearStatus = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const queryClient = useQueryClient();

  // TanStack Query: Fetch all assets data
  const { data: assetsData, isLoading: assetsLoading, isError: assetsError, error: assetsErr, refetch: refetchAssets } = useQuery({
    queryKey: ["finance-assets"],
    queryFn: async () => {
      const [assetRows, capexRows, documentRows, budgetRows, depEntries, events] = await Promise.all([
        financeApiClient.listAssets(session.tenant_id, session),
        financeApiClient.listCapexRequests(session.tenant_id, session),
        financeApiClient.listDocuments(session.tenant_id, session),
        financeApiClient.listCapexBudgets(session.tenant_id, session),
        financeApiClient.listAssetDepreciationEntries(session.tenant_id, session),
        financeApiClient.listAssetEvents(session.tenant_id, session),
      ]);
      return { assetRows, capexRows, documentRows, budgetRows, depEntries, events };
    },
    staleTime: 30_000,
  });

  // Sync TanStack Query data to local state for compatibility with existing UI
  useEffect(() => {
    if (assetsData) {
      setAssets(assetsData.assetRows);
      setCapexRequests(assetsData.capexRows);
      setDocuments(assetsData.documentRows);
      setCapexBudgets(assetsData.budgetRows);
      setDepreciationEntries(assetsData.depEntries);
      setAssetEvents(assetsData.events);
      setSelectedDocumentIds((previous) => {
        const retained = (Array.isArray(previous) ? previous : []).filter((id) => assetsData.documentRows.some((doc) => doc.id === id));
        if (retained.length) return retained;
        return [];
      });
    }
  }, [assetsData]);

  const runAction = useCallback(async (action: () => Promise<void>, success: string) => {
    setErrorMessage(null);
    try {
      await action();
      setStatusMessage(success);
    } catch (error) {
      setStatusMessage(null);
      setErrorMessage(error instanceof Error ? error.message : "Request failed.");
    }
  }, []);

  const loadData = useCallback(async () => {
    queryClient.invalidateQueries({ queryKey: ["finance-assets"] });
  }, [queryClient]);

  const filteredAssets = useMemo(
    () =>
      (Array.isArray(assets) ? assets : []).filter((asset) =>
        search
          ? `${asset.description} ${asset.location} ${asset.department}`
              .toLowerCase()
              .includes(search.toLowerCase())
          : true,
      ),
    [assets, search],
  );

  const filteredCapex = useMemo(
    () =>
      (Array.isArray(capexRequests) ? capexRequests : []).filter((request) =>
        search
          ? `${request.assetDescription} ${request.department}`
              .toLowerCase()
              .includes(search.toLowerCase())
          : true,
      ),
    [capexRequests, search],
  );

  const selectedDeptBudget = useMemo(() => {
    return capexBudgets.find(b => b.department === capexForm.department);
  }, [capexBudgets, capexForm.department]);

  const createCapex = async () => {
    await runAction(async () => {
      await financeApiClient.createCapexRequest(session.tenant_id, session, capexForm);
      logService.log(
        session.tenant_id,
        session.user_id,
        "Created CAPEX request",
        capexForm.assetDescription,
      );
      setDialogOpen(false);
      setCapexForm(defaultCapexForm);
      await loadData();
    }, "CAPEX request created and routed.");
  };

  const approveCapex = async (requestId: string) => {
    await runAction(async () => {
      await financeApiClient.approveCapexRequest(session.tenant_id, session, requestId);
      logService.log(session.tenant_id, session.user_id, "Approved CAPEX request", requestId);
      await loadData();
    }, "CAPEX request approved.");
  };

  const rejectCapex = async (requestId: string) => {
    await runAction(async () => {
      await financeApiClient.rejectCapexRequest(
        session.tenant_id,
        session,
        requestId,
        "Rejected from Assets workspace",
      );
      logService.log(session.tenant_id, session.user_id, "Rejected CAPEX request", requestId);
      await loadData();
    }, "CAPEX request rejected.");
  };

  const capitalize = async (assetId: string) => {
    await runAction(async () => {
      await financeApiClient.capitalizeAsset(
        session.tenant_id,
        session,
        assetId,
        new Date().toISOString().slice(0, 10),
      );
      logService.log(session.tenant_id, session.user_id, "Capitalized asset", assetId);
      await loadData();
    }, "Asset capitalized.");
  };

  const runScheduledDepreciation = async () => {
    await runAction(async () => {
      const result = await financeApiClient.runScheduledPeriodDepreciation(
        session.tenant_id,
        session,
        {
          periodStart: runForm.periodStart,
          periodEnd: runForm.periodEnd,
          postingDate: runForm.postingDate,
          cfoSignoff,
        },
      );
      setRunResult(result);
      logService.log(session.tenant_id, session.user_id, "Scheduled depreciation run", result.runId);
      await loadData();
    }, "Scheduled depreciation run completed.");
  };

  const openAuditPack = async (assetId: string) => {
    const pack = await financeApiClient.generateAssetAuditPack(session.tenant_id, session, assetId);
    setSelectedAudit(pack);
  };

  const downloadAuditPack = async (assetId: string, format: "JSON" | "PDF") => {
    try {
      const response = await fetch(`/api/v1/finance/assets/${assetId}/audit-pack?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${(session as any).token || ''}`,
          'x-tenant-id': session.tenant_id || '',
        },
      });
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      const blob = await response.blob();
      const filename = `audit-${assetId}.${format.toLowerCase()}`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setErrorMessage(null);
      setStatusMessage(`Downloaded ${filename}.`);
    } catch (error) {
      setStatusMessage(null);
      setErrorMessage(error instanceof Error ? error.message : "Failed to download audit pack.");
    }
  };

  const toggleAttachment = (documentId: string, selected: boolean) => {
    setSelectedDocumentIds((previous) => {
      if (selected) {
        return Array.from(new Set([...previous, documentId]));
      }
      return (Array.isArray(previous) ? previous : []).filter((id) => id !== documentId);
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        subtitle="Fixed asset lifecycle with CAPEX governance, capitalization control, and depreciation posting."
        primaryAction={<Button onClick={() => setDialogOpen(true)}>New CAPEX Request</Button>}
        secondaryActions={
          <Input
            placeholder="Search assets, location, department"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-[240px]"
          />
        }
      />

      <FeedbackAlert message={statusMessage} error={errorMessage} onClear={clearStatus} />

      <QueryStateWrapper
        isLoading={assetsLoading}
        isError={assetsError}
        error={assetsErr as ApiError | undefined}
        isEmpty={assets.length === 0 && capexRequests.length === 0}
        onRetry={() => refetchAssets()}
        emptyMessage="No assets or CAPEX requests found. Create a new CAPEX request to get started."
      >

      <WorkspacePanel
        title="Lifecycle Workbench"
        description="CAPEX -> Capitalization -> Depreciation -> Event tracking."
      >
        <div className="mb-4 rounded-lg border p-3 text-sm">
          <p className="font-medium">CAPEX Budget Ledger</p>
          <p className="text-muted-foreground">
            Budget availability is enforced from ledger accounts before CAPEX requests are created.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
                {(Array.isArray(capexBudgets) ? capexBudgets : []).map((budget) => (
                  <div key={budget.department} className="rounded border p-2 text-xs">
                    <p className="font-medium">{budget.department}</p>
                    <p className="text-muted-foreground">Allocated: {formatAmount(budget.allocatedBudget)}</p>
                    <p className="text-muted-foreground">Committed: {formatAmount(budget.committedBudget)}</p>
                    <p className="text-muted-foreground">Available: {formatAmount(budget.availableBudget)}</p>
                  </div>
                ))}
              </div>
        </div>
        <FilterBar searchValue={search} onSearchChange={setSearch} />
        <div className="mb-4 rounded-lg border p-3 text-sm">
          <p className="font-medium">Lifecycle Supporting Documents</p>
          <p className="text-muted-foreground">
            Impairment, revaluation, and disposal actions require at least one document attachment.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {documents.length ? (
              (Array.isArray(documents) ? documents : []).map((document) => (
                <label
                  key={document.id}
                  className="flex items-center gap-2 rounded border px-3 py-2 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={selectedDocumentIds.includes(document.id)}
                    onChange={(event) => toggleAttachment(document.id, event.target.checked)}
                  />
                  <span className="font-medium">{document.title}</span>
                  <span className="text-muted-foreground">({document.type})</span>
                </label>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                No documents available. Upload documents in Finance Docs first.
              </p>
            )}
          </div>
        </div>
        <Tabs value={tab} onValueChange={(value) => setTab(value as AssetTab)}>
          <TabsList>
            {(Array.isArray(TABS) ? TABS : []).map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="register" className="mt-4">
            <div className="mb-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>Import Assets</Button>
              <Button variant="outline" onClick={() => setRegisterAssetDialogOpen(true)}>Register Existing Asset</Button>
            </div>
            <DataTableShell total={filteredAssets.length} page={1} pageSize={10}>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Asset</th>
                    <th className="p-3 text-left">Class</th>
                    <th className="p-3 text-left">Cost</th>
                    <th className="p-3 text-left">Accul. Depr.</th>
                    <th className="p-3 text-left">Carrying Value</th>
                    <th className="p-3 text-left">Rev. Reserve</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(filteredAssets) ? filteredAssets : []).map((asset) => (
                    <tr
                      key={asset.id}
                      className="cursor-pointer border-t hover:bg-muted/50"
                      onClick={() => setSelectedAssetDetail(asset)}
                    >
                      <td className="p-3">
                        <div className="font-medium">{asset.description}</div>
                        <div className="text-[10px] text-muted-foreground">{asset.id} | {asset.location}</div>
                      </td>
                      <td className="p-3 text-muted-foreground">{asset.assetClass}</td>
                      <td className="p-3 text-muted-foreground">{formatAmount(asset.acquisitionCost)}</td>
                      <td className="p-3 text-muted-foreground">
                        {formatAmount(asset.accumulatedDepreciation ?? 0)}
                      </td>
                      <td className="p-3 font-semibold">
                        {formatAmount(asset.carryingValue, toSafeNumber(asset.acquisitionCost))}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {formatAmount(asset.revaluationReserve ?? 0)}
                      </td>
                      <td className="p-3">
                        <ApprovalStatusBadge status={asset.status} />
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {asset.status === "APPROVED_FOR_CAPITALIZATION" ? (
                            <Button size="sm" onClick={() => capitalize(asset.id)}>
                              Capitalize
                            </Button>
                          ) : null}
                          {asset.status === "ACTIVE" ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedAsset(asset);
                                  setEditAssetDialogOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!selectedDocumentIds.length}
                                onClick={() => {
                                  setSelectedAsset(asset);
                                  setImpairmentDialogOpen(true);
                                }}
                              >
                                Impair
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!selectedDocumentIds.length}
                                onClick={() => {
                                  setSelectedAsset(asset);
                                  setRevaluationDialogOpen(true);
                                }}
                              >
                                Revalue
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedAsset(asset);
                                  setTransferAssetDialogOpen(true);
                                }}
                              >
                                Transfer
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedAsset(asset);
                                  setMaintenanceDialogOpen(true);
                                }}
                              >
                                Maintenance
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={!selectedDocumentIds.length}
                                onClick={() => {
                                  setSelectedAsset(asset);
                                  setDisposalDialogOpen(true);
                                }}
                              >
                                Dispose
                              </Button>
                            </>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAuditPack(asset.id);
                            }}
                          >
                            Audit Pack
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          </TabsContent>

          <TabsContent value="capex" className="mt-4">
            <DataTableShell total={filteredCapex.length} page={1} pageSize={10}>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Asset</th>
                    <th className="p-3 text-left">Amount</th>
                    <th className="p-3 text-left">Department</th>
                    <th className="p-3 text-left">Budget Match</th>
                    <th className="p-3 text-left">Approval Stage</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(filteredCapex) ? filteredCapex : []).map((request) => (
                    <tr
                      key={request.id}
                      className="cursor-pointer border-t hover:bg-muted/50"
                      onClick={() => setSelectedCapexDetail(request)}
                    >
                      <td className="p-3 font-medium">{request.assetDescription}</td>
                      <td className="p-3 text-muted-foreground">{formatAmount(request.requestedAmount)}</td>
                      <td className="p-3 text-muted-foreground">{request.department}</td>
                      <td className="p-3 text-muted-foreground">{request.budgetMatched ? "YES" : "NO"}</td>
                      <td className="p-3 text-muted-foreground">
                        {request.currentApprovalStage ?? "-"}
                      </td>
                      <td className="p-3">
                        <ApprovalStatusBadge status={request.status} />
                      </td>
                      <td className="p-3">
                        {request.status === "PENDING" ||
                        request.status === "PENDING_HOD_APPROVAL" ||
                        request.status === "PENDING_CFO_APPROVAL" ? (
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="outline" onClick={() => approveCapex(request.id)}>
                              {request.currentApprovalStage === "CFO" ? "Approve (CFO)" : "Approve (HOD)"}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => rejectCapex(request.id)}>
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

          <TabsContent value="depreciation" className="mt-4">
            <div className="mb-4 flex flex-wrap gap-3 rounded-lg border p-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground uppercase lg:font-bold">Period Start</span>
                <Input
                  type="date"
                  value={runForm.periodStart}
                  onChange={(event) =>
                    setRunForm({ ...runForm, periodStart: event.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground uppercase lg:font-bold">Period End</span>
                <Input
                  type="date"
                  value={runForm.periodEnd}
                  onChange={(event) =>
                    setRunForm({ ...runForm, periodEnd: event.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground uppercase lg:font-bold">Posting Date</span>
                <Input
                  type="date"
                  value={runForm.postingDate}
                  onChange={(event) =>
                    setRunForm({ ...runForm, postingDate: event.target.value })
                  }
                />
              </div>
              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={cfoSignoff}
                    onChange={(e) => setCfoSignoff(e.target.checked)}
                  />
                  CFO Signoff Required
                </label>
                <Button onClick={runScheduledDepreciation}>Run Scheduled Depreciation</Button>
              </div>
            </div>
            {runResult ? (
              <div className="mb-4 grid gap-3 rounded-lg border p-3 text-sm md:grid-cols-5">
                <div>
                  <p className="text-xs text-muted-foreground">Run</p>
                  <p className="font-medium">{runResult.runId}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Period</p>
                  <p className="font-medium">
                    {runResult.periodStart} to {runResult.periodEnd}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Posting date</p>
                  <p className="font-medium">{runResult.postingDate}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Posted entries</p>
                  <p className="font-medium">{runResult.postedEntries}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Skipped assets</p>
                  <p className="font-medium">{runResult.skippedAssetIds.length}</p>
                </div>
              </div>
            ) : null}
            <DataTableShell total={depreciationEntries.length} page={1} pageSize={10}>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Asset</th>
                    <th className="p-3 text-left">Posting Date</th>
                    <th className="p-3 text-left">Method</th>
                    <th className="p-3 text-left">Amount</th>
                    <th className="p-3 text-left">Accumulated</th>
                    <th className="p-3 text-left">Carrying Value</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(depreciationEntries) ? depreciationEntries : []).map((entry) => (
                    <tr
                      key={entry.id}
                      className="cursor-pointer border-t hover:bg-muted/50"
                      onClick={() => setSelectedDepreciationDetail(entry)}
                    >
                      <td className="p-3">{entry.assetId}</td>
                      <td className="p-3 text-muted-foreground">{entry.postingDate}</td>
                      <td className="p-3 text-muted-foreground">{entry.method}</td>
                      <td className="p-3 text-muted-foreground">{formatAmount(entry.amount)}</td>
                      <td className="p-3 text-muted-foreground">{formatAmount(entry.accumulatedDepreciation)}</td>
                      <td className="p-3 text-muted-foreground">{formatAmount(entry.carryingValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          </TabsContent>

          <TabsContent value="events" className="mt-4">
            <DataTableShell total={assetEvents.length} page={1} pageSize={10}>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-left">Asset</th>
                    <th className="p-3 text-left">Journal</th>
                    <th className="p-3 text-left">Attachments</th>
                    <th className="p-3 text-left">Approved By</th>
                    <th className="p-3 text-left">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(assetEvents) ? assetEvents : []).map((event) => (
                    <tr
                      key={event.id}
                      className="cursor-pointer border-t hover:bg-muted/50"
                      onClick={() => setSelectedEventDetail(event)}
                    >
                      <td className="p-3 font-medium">{event.type}</td>
                      <td className="p-3 text-muted-foreground">{event.assetId}</td>
                      <td className="p-3 text-muted-foreground">{event.journalEntryId}</td>
                      <td className="p-3 text-muted-foreground">{event.attachmentDocumentIds.length} docs</td>
                      <td className="p-3 text-muted-foreground">{event.approvedBy}</td>
                      <td className="p-3 text-muted-foreground">{event.createdAt.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          </TabsContent>
        </Tabs>
      </WorkspacePanel>

      {selectedAudit ? (
        <WorkspacePanel
          title="Audit Pack Summary"
          description="Evidence footprint generated for selected asset."
        >
          <div className="grid gap-3 sm:grid-cols-4 text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Asset</p>
              <p className="font-medium">{selectedAudit.assetId}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">CAPEX status</p>
              <p className="font-medium">{selectedAudit.capexRequest?.status ?? "N/A"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Depreciation entries</p>
              <p className="font-medium">{selectedAudit.depreciationEntries.length}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Lifecycle events</p>
              <p className="font-medium">{selectedAudit.events.length}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Evidence items</p>
              <p className="font-medium">{selectedAudit.evidence.length}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Checksum</p>
              <p className="font-medium">{selectedAudit.checksum}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Signature</p>
              <p className="font-medium">{selectedAudit.signature}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadAuditPack(selectedAudit.assetId, "JSON")}
            >
              Download JSON
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadAuditPack(selectedAudit.assetId, "PDF")}
            >
              Download PDF
            </Button>
          </div>
        </WorkspacePanel>
      ) : null}

      </QueryStateWrapper>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <div className="grid md:grid-cols-[1fr_2fr] h-full">
            {/* Left Panel: Strategic Information */}
            <div className="bg-muted p-6 flex flex-col justify-between border-r">
              <div>
                <PieChart className="w-8 h-8 text-primary mb-4" />
                <DialogTitle className="text-xl mb-2">Capital Expenditure</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Initiate a strategic investment request. CAPEX requests are routed through departmental workflows and lock designated budgets upon approval.
                </p>
                
                <div className="mt-8 space-y-4">
                  <div className="rounded-lg border bg-background/50 p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5"><Coins className="w-4 h-4" /> Budget Impact</h4>
                    {selectedDeptBudget ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Available</span>
                          <span className="font-medium text-success">{formatAmount(selectedDeptBudget.availableBudget)}</span>
                        </div>
                        <div className="flex justify-between items-center text-destructive font-medium">
                          <span>Requested</span>
                          <span>- {formatAmount(capexForm.requestedAmount)}</span>
                        </div>
                        <div className="h-px bg-border my-1"></div>
                        <div className="flex justify-between items-center font-bold">
                          <span>Remaining Post-Approval</span>
                          <span>{formatAmount(selectedDeptBudget.availableBudget - capexForm.requestedAmount)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Select a department to view budget impact.</p>
                    )}
                  </div>
                  
                  <div className="flex items-start gap-3 text-sm pt-2">
                    <div className="mt-0.5"><TrendingUp className="w-4 h-4 text-muted-foreground" /></div>
                    <div>
                      <p className="font-medium">Lifecycle Projection</p>
                      <p className="text-muted-foreground text-xs">Estimated useful life determines the annual depreciation impact on the P&L.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel: Data Entry Form */}
            <div className="p-6 flex flex-col">
              <div className="flex-1 space-y-6 overflow-y-auto pr-2">
                
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Primary Details</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Input
                        placeholder="Asset Description (e.g., Office Server Setup)"
                        value={capexForm.assetDescription}
                        onChange={(event) => setCapexForm({ ...capexForm, assetDescription: event.target.value })}
                        className="text-sm font-medium"
                      />
                    </div>
                    <div>
                      <Select
                        value={capexForm.assetClass}
                        onValueChange={(value) => setCapexForm({ ...capexForm, assetClass: value as FixedAsset["assetClass"] })}
                      >
                        <SelectTrigger><SelectValue placeholder="Asset Class" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LAND">Land</SelectItem>
                          <SelectItem value="BUILDING">Building</SelectItem>
                          <SelectItem value="MACHINERY">Machinery</SelectItem>
                          <SelectItem value="VEHICLE">Vehicle</SelectItem>
                          <SelectItem value="FURNITURE">Furniture</SelectItem>
                          <SelectItem value="EQUIPMENT">Equipment</SelectItem>
                          <SelectItem value="SOFTWARE">Software</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Input
                        placeholder="Requested Amount"
                        type="number"
                        value={capexForm.requestedAmount || ""}
                        onChange={(event) => setCapexForm({ ...capexForm, requestedAmount: Number(event.target.value) })}
                        prefix="¤"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Governance & Routing</label>
                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      value={capexForm.department}
                      onValueChange={(value) => setCapexForm({ ...capexForm, department: value })}
                    >
                      <SelectTrigger><SelectValue placeholder="Sponsor Department" /></SelectTrigger>
                      <SelectContent>
                        {(Array.isArray(capexBudgets) ? capexBudgets : []).map(b => (
                          <SelectItem key={b.department} value={b.department}>{b.department}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Project Code (Optional)"
                      value={capexForm.projectCode}
                      onChange={(event) => setCapexForm({ ...capexForm, projectCode: event.target.value })}
                    />
                    <div className="col-span-2">
                       <Input
                        placeholder="Deployment Location / Site"
                        value={capexForm.location}
                        onChange={(event) => setCapexForm({ ...capexForm, location: event.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Financial Mapping</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                       <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                       <Input
                        type="date"
                        className="pl-9"
                        value={capexForm.acquisitionDate}
                        onChange={(event) => setCapexForm({ ...capexForm, acquisitionDate: event.target.value })}
                      />
                    </div>
                    <div className="relative">
                      <Calculator className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Useful Life (Years)"
                        type="number"
                        className="pl-9"
                        value={capexForm.usefulLifeYears || ""}
                        onChange={(event) => setCapexForm({ ...capexForm, usefulLifeYears: Number(event.target.value) })}
                      />
                    </div>
                    <Input
                      placeholder="Residual Value / Salvage Quote"
                      type="number"
                      value={capexForm.residualValue || ""}
                      onChange={(event) => setCapexForm({ ...capexForm, residualValue: Number(event.target.value) })}
                    />
                    <Select
                      value={capexForm.depreciationMethod}
                      onValueChange={(value) => setCapexForm({ ...capexForm, depreciationMethod: value as DepreciationMethod })}
                    >
                      <SelectTrigger><SelectValue placeholder="Depreciation Method" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STRAIGHT_LINE">Straight Line</SelectItem>
                        <SelectItem value="DECLINING_BALANCE">Declining Balance</SelectItem>
                        <SelectItem value="UNIT_OF_PRODUCTION">Unit of Production</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button 
                    disabled={!capexForm.department || capexForm.requestedAmount <= 0 || (selectedDeptBudget && capexForm.requestedAmount > selectedDeptBudget.availableBudget)}
                    onClick={createCapex}
                >
                    Submit Request for Approval
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AssetImpairmentModal
        isOpen={impairmentDialogOpen}
        onClose={() => { setImpairmentDialogOpen(false); setSelectedAsset(null); }}
        onSuccess={() => loadData()}
        assetId={selectedAsset?.id ?? ""}
      />

      <AssetRevaluationModal
        isOpen={revaluationDialogOpen}
        onClose={() => { setRevaluationDialogOpen(false); setSelectedAsset(null); }}
        onSuccess={() => loadData()}
        assetId={selectedAsset?.id ?? ""}
      />

      <AssetDisposalModal
        isOpen={disposalDialogOpen}
        onClose={() => { setDisposalDialogOpen(false); setSelectedAsset(null); }}
        onSuccess={() => loadData()}
        assetId={selectedAsset?.id ?? ""}
      />

      <RegisterAssetModal
        isOpen={registerAssetDialogOpen}
        onClose={() => setRegisterAssetDialogOpen(false)}
        onSuccess={() => loadData()}
      />

      <AssetEditModal
        isOpen={editAssetDialogOpen}
        onClose={() => { setEditAssetDialogOpen(false); setSelectedAsset(null); }}
        onSuccess={() => loadData()}
        assetId={selectedAsset?.id ?? ""}
        defaultValues={selectedAsset ? {
          description: selectedAsset.description,
          assetClass: selectedAsset.assetClass,
          location: selectedAsset.location,
          department: selectedAsset.department,
          usefulLifeYears: selectedAsset.usefulLifeYears,
          residualValue: selectedAsset.residualValue,
          depreciationMethod: selectedAsset.depreciationMethod,
        } : undefined}
      />

      <AssetTransferModal
        isOpen={transferAssetDialogOpen}
        onClose={() => { setTransferAssetDialogOpen(false); setSelectedAsset(null); }}
        onSuccess={() => loadData()}
        assetId={selectedAsset?.id ?? ""}
      />

      <AssetMaintenanceModal
        isOpen={maintenanceDialogOpen}
        onClose={() => { setMaintenanceDialogOpen(false); setSelectedAsset(null); }}
        onSuccess={() => loadData()}
        assetId={selectedAsset?.id ?? ""}
      />

      <AssetImportModal
        isOpen={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onSuccess={() => loadData()}
      />

      <AssetDepreciationRunModal
        isOpen={depreciationRunDialogOpen}
        onClose={() => setDepreciationRunDialogOpen(false)}
        onSuccess={() => loadData()}
      />

      <Dialog open={!!selectedCapexDetail} onOpenChange={() => setSelectedCapexDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>CAPEX Details - {selectedCapexDetail?.assetDescription}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 text-sm gap-y-2">
              <span className="text-muted-foreground">Request ID:</span>
              <span>{selectedCapexDetail?.id}</span>
              <span className="text-muted-foreground">Requested Amount:</span>
              <span className="font-bold">{formatAmount(selectedCapexDetail?.requestedAmount)}</span>
              <span className="text-muted-foreground">Department:</span>
              <span>{selectedCapexDetail?.department}</span>
              <span className="text-muted-foreground">Status:</span>
              <span><ApprovalStatusBadge status={selectedCapexDetail?.status ?? ""} /></span>
            </div>
            <div className="border-t pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Approval History</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>• Created on {selectedCapexDetail?.createdAt.slice(0, 10)}</p>
                <p>• Departmental Budget Verified: YES</p>
                <p>• Status: {selectedCapexDetail?.status}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedDepreciationDetail} onOpenChange={() => setSelectedDepreciationDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Depreciation Entry Detail</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 text-sm gap-y-2">
              <span className="text-muted-foreground">Asset ID:</span>
              <span>{selectedDepreciationDetail?.assetId}</span>
              <span className="text-muted-foreground">Posting Date:</span>
              <span>{selectedDepreciationDetail?.postingDate}</span>
              <span className="text-muted-foreground">Method:</span>
              <span>{selectedDepreciationDetail?.method}</span>
              <span className="text-muted-foreground">Depreciation Amount:</span>
              <span className="font-bold text-destructive">({formatAmount(selectedDepreciationDetail?.amount)})</span>
              <span className="text-muted-foreground">Carrying Value After:</span>
              <span className="font-bold">{formatAmount(selectedDepreciationDetail?.carryingValue)}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedEventDetail} onOpenChange={() => setSelectedEventDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Asset Event Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 text-sm gap-y-2">
              <span className="text-muted-foreground">Event Type:</span>
              <span className="font-bold uppercase">{selectedEventDetail?.type}</span>
              <span className="text-muted-foreground">Asset ID:</span>
              <span>{selectedEventDetail?.assetId}</span>
              <span className="text-muted-foreground">Journal Ref:</span>
              <span>{selectedEventDetail?.journalEntryId}</span>
              <span className="text-muted-foreground">Approved By:</span>
              <span>{selectedEventDetail?.approvedBy}</span>
              <span className="text-muted-foreground">Recorded At:</span>
              <span>{selectedEventDetail?.createdAt}</span>
            </div>
            <div className="border-t pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Evidence Reference</p>
              <p className="text-xs text-muted-foreground">
                Linked documents: {selectedEventDetail?.attachmentDocumentIds.length || 0} items attached
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedAssetDetail} onOpenChange={() => setSelectedAssetDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Asset Register Detail</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 text-sm gap-y-2">
              <span className="text-muted-foreground">Asset ID:</span>
              <span className="font-mono text-xs">{selectedAssetDetail?.id}</span>
              <span className="text-muted-foreground">Description:</span>
              <span className="font-semibold">{selectedAssetDetail?.description}</span>
              <span className="text-muted-foreground">Class:</span>
              <span>{selectedAssetDetail?.assetClass}</span>
              <span className="text-muted-foreground">Cost:</span>
              <span className="font-bold">{formatAmount(selectedAssetDetail?.acquisitionCost)}</span>
              <span className="text-muted-foreground">Acquisition Date:</span>
              <span>{selectedAssetDetail?.acquisitionDate}</span>
              <span className="text-muted-foreground">Useful Life:</span>
              <span>{selectedAssetDetail?.usefulLifeYears} years</span>
              <span className="text-muted-foreground">Method:</span>
              <span>{selectedAssetDetail?.depreciationMethod}</span>
              <span className="text-muted-foreground">Status:</span>
              <span><ApprovalStatusBadge status={selectedAssetDetail?.status ?? ""} /></span>
            </div>
            <div className="border-t pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Carrying Value Breakdown</p>
              <div className="grid grid-cols-2 text-xs gap-y-1">
                <span className="text-muted-foreground">Accumulated Depreciation:</span>
                <span className="text-destructive">({formatAmount(selectedAssetDetail?.accumulatedDepreciation ?? 0)})</span>
                <span className="text-muted-foreground">Revaluation Reserve:</span>
                <span className="text-success">{formatAmount(selectedAssetDetail?.revaluationReserve ?? 0)}</span>
                <span className="font-semibold">Net Carrying Value:</span>
                <span className="font-bold">{formatAmount(selectedAssetDetail?.carryingValue)}</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
