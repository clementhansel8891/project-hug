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
import { FeedbackAlert } from "@/core/tools/FeedbackAlert";
import { useSession } from "@/core/security/session";
import { recruitmentService, type CandidateRecord } from "@/core/services/hr/recruitmentService";
import { EmptyState } from "@/components/shared/AsyncState";
import { CreateRequisitionModal, ScheduleInterviewModal, AdvanceCandidateModal, RejectCandidateModal } from "./modals";

export default function TalentFlow() {
  const session = useSession();
  const [version, setVersion] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [requisitionTitle, setRequisitionTitle] = useState("Operations Lead");
  const [openings, setOpenings] = useState("1");
  const [actionCandidateId, setActionCandidateId] = useState("");
  const [notes, setNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [search, setSearch] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [candidateProfile, setCandidateProfile] = useState<any | null>(null);
  const [stages, setStages] = useState<readonly string[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [cands, stgs] = await Promise.all([
          recruitmentService.listCandidates(session.tenant_id, session),
          recruitmentService.getPipelineStages(),
        ]);
        setCandidates(cands);
        setStages(stgs);
      } catch (err) {
        console.error("Failed to load talent flow data", err);
      }
    };
    loadData();
  }, [session.tenant_id, session, version]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!selectedCandidateId || !profileOpen) {
        setCandidateProfile(null);
        return;
      }
      try {
        const profile = await recruitmentService.getCandidateProfile(session.tenant_id, session, selectedCandidateId);
        setCandidateProfile(profile);
      } catch (err) {
        console.error("Failed to load candidate profile", err);
      }
    };
    loadProfile();
  }, [session.tenant_id, session, selectedCandidateId, profileOpen]);

  const selectedCandidateData = useMemo(() => {
    if (!selectedCandidateId) return null;
    return candidates.find(c => c.id === selectedCandidateId) || null;
  }, [candidates, selectedCandidateId]);

  const filteredCandidates = (Array.isArray(candidates) ? candidates : []).filter((candidate) =>
    search ? candidate.name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  const clearStatus = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleAdvance = () => {
    if (!selectedCandidateId) return;
    try {
      recruitmentService.advanceCandidate(session.tenant_id, session, selectedCandidateId);
      setStatusMessage("Candidate advanced to next stage.");
      setProfileOpen(false);
      setVersion(v => v + 1);
    } catch (err) {
      setErrorMessage("Failed to advance candidate.");
    }
  };

  const handleReject = () => {
    if (!selectedCandidateId) return;
    if (!rejectReason) {
      setErrorMessage("Please provide a reason for rejection.");
      return;
    }
    try {
      recruitmentService.rejectCandidate(session.tenant_id, session, selectedCandidateId, rejectReason);
      setStatusMessage("Candidate application rejected.");
      setRejectOpen(false);
      setProfileOpen(false);
      setRejectReason("");
      setVersion(v => v + 1);
    } catch (err) {
      setErrorMessage("Failed to reject candidate.");
    }
  };

  const handleHire = async () => {
    if (!selectedCandidateId) return;
    try {
      await recruitmentService.hireCandidate(session.tenant_id, session, selectedCandidateId);
      setStatusMessage("Candidate successfully hired and transitioned to PeopleCore.");
      setProfileOpen(false);
      setVersion(v => v + 1);
    } catch (err) {
      setErrorMessage("Failed to hire candidate.");
    }
  };

  return (
    <div className="space-y-6">
      <FeedbackAlert message={statusMessage} error={errorMessage} onClear={clearStatus} />
      <PageHeader
        title="TalentFlow"
        subtitle="ATS pipeline with FlowGate approval routing."
        primaryAction={
          <Button
            onClick={() => {
              setDialogOpen(true);
            }}
          >
            Create Requisition
          </Button>
        }
        secondaryActions={<Input placeholder="Search candidates" className="min-w-[200px]" value={search} onChange={(e) => setSearch(e.target.value)} />}
      />

      <WorkspacePanel title="WorkQueue" description="Recruitment actions.">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const target = candidates[0];
              if (target) {
                recruitmentService.routeCandidate(session.tenant_id, session, target.id);
                setStatusMessage("Candidate routed to FlowGate.");
                setVersion((prev) => prev + 1);
              }
            }}
          >
            Send to FlowGate
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setActionCandidateId(candidates[0]?.id ?? "");
              setActionOpen(true);
            }}
          >
            Schedule Interview
          </Button>
        </div>
      </WorkspacePanel>

      <WorkspacePanel title="Active Records" description="Candidate pipeline. Click a card to see profile.">
        <FilterBar searchValue={search} onSearchChange={setSearch} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {(Array.isArray(stages) ? stages : []).map((stage) => (
            <div key={stage} className={`rounded-lg border bg-card p-3 ${stage === "rejected" ? "border-destructive/20 bg-destructive" : ""}`}>
              <p className={`text-sm font-semibold capitalize ${stage === "rejected" ? "text-destructive" : "text-foreground"}`}>{stage}</p>
              <div className="mt-3 space-y-2">
                {(Array.isArray(filteredCandidates) ? filteredCandidates : []).filter((candidate) => candidate.stage === stage)
                  .map((candidate) => (
                    <div 
                      key={candidate.id} 
                      className="rounded-md border p-2 text-xs cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setSelectedCandidateId(candidate.id);
                        setProfileOpen(true);
                      }}
                    >
                      <p className="text-sm font-medium text-foreground">{candidate.name}</p>
                      <p className="text-muted-foreground">{candidate.role}</p>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </WorkspacePanel>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <WorkspacePanel title="Pending Approvals" description="Requisitions awaiting approval.">
          <DataTableShell total={candidates.length} page={1} pageSize={5}>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Candidate</th>
                  <th className="p-3 text-left">Role</th>
                  <th className="p-3 text-left">Stage</th>
                </tr>
              </thead>
              <tbody>
                {filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-0">
                      <EmptyState
                        title="No candidates"
                        description="No candidates match the current search. Create a requisition to start sourcing."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.slice(0, 5).map((candidate) => (
                  <tr 
                    key={candidate.id} 
                    className="border-t cursor-pointer hover:bg-muted/30"
                    onClick={() => {
                      setSelectedCandidateId(candidate.id);
                      setProfileOpen(true);
                    }}
                  >
                    <td className="p-3">{candidate.name}</td>
                    <td className="p-3 text-muted-foreground">{candidate.role}</td>
                    <td className="p-3 text-muted-foreground capitalize">{candidate.stage}</td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </DataTableShell>
        </WorkspacePanel>

        <WorkspacePanel title="Insights" description="Recruitment flow analytics.">
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Total candidates</span>
              <span className="font-semibold text-foreground">{candidates.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Offers in flight</span>
              <span className="font-semibold text-foreground">
                {(Array.isArray(candidates) ? candidates : []).filter((candidate) => candidate.stage === "offer").length}
              </span>
            </div>
          </div>
        </WorkspacePanel>
      </div>

      <CreateRequisitionModal
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        departments={[{ id: session.department_id, name: session.department_id }]}
        defaultDepartmentId={session.department_id}
        onSuccess={() => setVersion((prev) => prev + 1)}
      />

      <ScheduleInterviewModal
        isOpen={actionOpen}
        onClose={() => setActionOpen(false)}
        candidates={candidates.map((c) => ({ id: c.id, name: c.name }))}
        defaultCandidateId={actionCandidateId}
        onSuccess={() => setVersion((prev) => prev + 1)}
      />

      {/* Candidate Profile Modal */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Candidate Profile</DialogTitle>
          </DialogHeader>
          {selectedCandidateData && candidateProfile && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-lg font-bold">{selectedCandidateData.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedCandidateData.role}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                    selectedCandidateData.stage === "rejected" 
                      ? "bg-destructive text-destructive" 
                      : "bg-primary text-primary"
                  }`}>
                    {selectedCandidateData.stage}
                  </span>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
                <p><strong>Email:</strong> {candidateProfile.email}</p>
                <p><strong>Education:</strong> {candidateProfile.education}</p>
                <p><strong>Experience:</strong> {candidateProfile.experience}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Uploaded Documents</p>
                <div className="space-y-2">
                  {(Array.isArray(candidateProfile.documents) ? candidateProfile.documents : []).map(doc => (
                    <div key={doc.id} className="flex items-center justify-between border rounded-md p-2 text-sm bg-card">
                      <span>{doc.name} ({doc.size})</span>
                      <Button onClick={(e) => { e.preventDefault(); alert("Detailed View:\n\nMetadata: " + (typeof window !== "undefined" ? window.location.pathname : "N/A")); }} variant="ghost" size="sm" className="text-primary hover:text-primary">View</Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 border-t pt-4">
                <Button className="flex-1" onClick={() => setAdvanceOpen(true)}>
                  Move to Next Stage
                </Button>
                {selectedCandidateData.stage === "offer" && (
                  <Button className="flex-1 bg-success hover:bg-success" onClick={handleHire}>
                    Hire Candidate
                  </Button>
                )}
                <Button variant="destructive" onClick={() => setRejectOpen(true)}>
                  Reject Applicant
                </Button>
                <Button variant="outline" onClick={() => setProfileOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rejection Modal */}
      <RejectCandidateModal
        isOpen={rejectOpen}
        onClose={() => setRejectOpen(false)}
        candidates={candidates.map((c) => ({ id: c.id, name: c.name }))}
        defaultCandidateId={selectedCandidateId}
        onSuccess={() => {
          setProfileOpen(false);
          setVersion((prev) => prev + 1);
        }}
      />

      {/* Advance Modal */}
      <AdvanceCandidateModal
        isOpen={advanceOpen}
        onClose={() => setAdvanceOpen(false)}
        candidates={candidates.map((c) => ({ id: c.id, name: c.name }))}
        defaultCandidateId={selectedCandidateId}
        onSuccess={() => {
          setProfileOpen(false);
          setVersion((prev) => prev + 1);
        }}
      />
    </div>
  );
}
