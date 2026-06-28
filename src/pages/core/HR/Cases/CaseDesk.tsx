import { useCallback, useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { FilterBar } from "@/core/tools/FilterBar";
import { useSession } from "@/core/security/session";
import { caseService } from "@/core/services/hr/caseService";
import { useBackgroundRefresh } from "@/core/runtime/events/useBackgroundRefresh";
import { EmptyState } from "@/components/shared/AsyncState";
import { CreateCaseModal, ResolveCaseModal } from "../modals";

export default function CaseDesk() {
  const session = useSession();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [version, setVersion] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [actionType, setActionType] = useState<"assign" | "escalate">("assign");
  const [selectedCase, setSelectedCase] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [notes, setNotes] = useState("");
  const refresh = useCallback(() => setVersion((prev) => prev + 1), []);
  useBackgroundRefresh(refresh, 20000);

  const [cases, setCases] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const items = await caseService.listCases(session.tenant_id, session);
        setCases(items);
      } catch (err) {
        console.error("Failed to load cases", err);
      }
    };
    loadData();
  }, [session.tenant_id, session, version]);
  const filtered = (Array.isArray(cases) ? cases : []).filter((item) =>
    search ? item.title.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="CaseDesk"
        subtitle="HR case management for disputes, corrections, and escalations."
        primaryAction={
          <Button onClick={() => setCreateOpen(true)}>
            New Case
          </Button>
        }
        secondaryActions={<Input placeholder="Search cases" value={search} onChange={(e) => setSearch(e.target.value)} />}
      />

      <WorkspacePanel title="WorkQueue" description="Case actions and escalations.">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setActionType("assign");
              setSelectedCase(cases[0]?.id ?? "");
              setOwnerId(session.user_id);
              setDialogOpen(true);
            }}
          >
            Assign Owner
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setActionType("escalate");
              setSelectedCase(cases[0]?.id ?? "");
              setDialogOpen(true);
            }}
          >
            Escalate
          </Button>
          <Button
            variant="outline"
            onClick={() => setResolveOpen(true)}
          >
            Resolve Case
          </Button>
        </div>
      </WorkspacePanel>

      <WorkspacePanel title="Active Records" description="Cases requiring attention.">
        <FilterBar searchValue={search} onSearchChange={setSearch} />
        <DataTableShell total={filtered.length} page={1} pageSize={10}>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Case</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Priority</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-0">
                    <EmptyState
                      title="No cases"
                      description="No HR cases match the current search. Create a case to start tracking."
                    />
                  </td>
                </tr>
              ) : (
                (Array.isArray(filtered) ? filtered : []).map((item) => (
                <tr
                  key={item.id}
                  className="border-t cursor-pointer hover:bg-muted/30"
                  onClick={() => navigate(`/core/hr/cases/${item.id}`)}
                >
                  <td className="p-3 font-medium text-foreground">{item.title}</td>
                  <td className="p-3 text-muted-foreground">{item.type}</td>
                  <td className="p-3 text-muted-foreground">{item.status}</td>
                  <td className="p-3 text-muted-foreground">{item.priority}</td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </DataTableShell>
      </WorkspacePanel>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Case Action</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={selectedCase} onValueChange={setSelectedCase}>
              <SelectTrigger>
                <SelectValue placeholder="Select case" />
              </SelectTrigger>
              <SelectContent>
                {(Array.isArray(cases) ? cases : []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {actionType === "assign" ? (
              <Input value={ownerId} onChange={(e) => setOwnerId(e.target.value)} placeholder="Owner ID" />
            ) : (
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Escalation notes" />
            )}
            <Button
              onClick={() => {
                if (!selectedCase) return;
                if (actionType === "assign") {
                  caseService.assignOwner(session.tenant_id, session, selectedCase, ownerId || session.user_id);
                } else {
                  caseService.escalateCase(session.tenant_id, session, selectedCase, notes);
                }
                setDialogOpen(false);
                setNotes("");
                refresh();
              }}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CreateCaseModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => refresh()}
      />

      <ResolveCaseModal
        isOpen={resolveOpen}
        onClose={() => setResolveOpen(false)}
        cases={cases.map((c: any) => ({ id: c.id, title: c.title }))}
        defaultCaseId={cases[0]?.id ?? ""}
        onSuccess={() => refresh()}
      />
    </div>
  );
}
