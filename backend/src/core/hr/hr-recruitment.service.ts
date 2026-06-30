import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../persistence/prisma.service";
import { IHRRepository } from "./repositories/hr.repository.interface";
import { AuditService } from "../../shared/audit/audit.service";
import { 
  JobRequisition, 
  Candidate, 
  Interview, 
  TalentLead 
} from "./entities/hr.entity";
import { Prisma } from "@prisma/client";
import { CreateRequisitionDto } from "./dto";

@Injectable()
export class HrRecruitmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hrRepository: IHRRepository,
    private readonly auditService: AuditService,
  ) {}

  async getRequisitions(tenant_id: string, status?: string): Promise<JobRequisition[]> {
    return this.hrRepository.getRequisitions(tenant_id, status);
  }

  async createRequisition(tenant_id: string, data: CreateRequisitionDto, user_id?: string): Promise<JobRequisition> {
    const event_reference_id = `EVT-HR-REQ-NEW-${Date.now()}`;
    return this.prisma.$transaction(async (tx: any) => {
      const requisition = await this.hrRepository.createRequisition(tenant_id, data, tx);
      await this.auditService.log({
        tenant_id, user_id: user_id || "SYSTEM", module: "HR", action: "CREATE_REQUISITION", entity_type: "REQUISITION", entity_id: requisition.id, after_state: requisition, event_reference_id,
      }, tx);
      return requisition;
    });
  }

  async getCandidates(tenant_id: string, status?: string): Promise<Candidate[]> {
    return this.hrRepository.getCandidates(tenant_id, status);
  }

  /** Ordered recruitment pipeline used by `advanceCandidate`. */
  private static readonly PIPELINE = [
    "sourcing",
    "applied",
    "screening",
    "interview",
    "offer",
    "hired",
  ];

  /**
   * Advance a candidate to the next pipeline stage (AdvanceCandidateModal).
   * Rejects advancing a terminal (hired/rejected) candidate with a 400.
   */
  async advanceCandidate(tenant_id: string, candidateId: string, notes?: string, user_id?: string) {
    const candidate = await this.prisma.candidates.findFirst({
      where: { id: candidateId, tenant_id, deleted_at: null },
    });
    if (!candidate) {
      throw new NotFoundException("Candidate not found");
    }
    const current = String(candidate.status || "applied").toLowerCase();
    if (current === "rejected" || current === "hired") {
      throw new BadRequestException(`Candidate is already ${current}; cannot advance`);
    }
    const idx = HrRecruitmentService.PIPELINE.indexOf(current);
    const next = idx >= 0 && idx < HrRecruitmentService.PIPELINE.length - 1
      ? HrRecruitmentService.PIPELINE[idx + 1]
      : "offer";

    const event_reference_id = `EVT-HR-CAND-ADV-${Date.now()}`;
    return this.prisma.$transaction(async (tx: any) => {
      const updated = await tx.candidates.update({
        where: { id: candidateId },
        data: {
          status: next,
          metadata: { ...((candidate.metadata as any) || {}), lastAdvanceNotes: notes },
          updated_at: new Date(),
        },
      });
      await this.auditService.log({
        tenant_id, user_id: user_id || "SYSTEM", module: "HR", action: "ADVANCE_CANDIDATE",
        entity_type: "CANDIDATE", entity_id: candidateId, after_state: updated, event_reference_id,
        metadata: { from: current, to: next, notes },
      }, tx);
      return updated;
    });
  }

  /**
   * Reject a candidate's application (RejectCandidateModal), recording the
   * reason. Idempotent: an already-rejected candidate is returned unchanged.
   */
  async rejectCandidate(tenant_id: string, candidateId: string, reason: string, user_id?: string) {
    const candidate = await this.prisma.candidates.findFirst({
      where: { id: candidateId, tenant_id, deleted_at: null },
    });
    if (!candidate) {
      throw new NotFoundException("Candidate not found");
    }
    if (String(candidate.status).toLowerCase() === "rejected") {
      return candidate;
    }
    const event_reference_id = `EVT-HR-CAND-REJ-${Date.now()}`;
    return this.prisma.$transaction(async (tx: any) => {
      const updated = await tx.candidates.update({
        where: { id: candidateId },
        data: {
          status: "rejected",
          metadata: { ...((candidate.metadata as any) || {}), rejectionReason: reason },
          updated_at: new Date(),
        },
      });
      await this.auditService.log({
        tenant_id, user_id: user_id || "SYSTEM", module: "HR", action: "REJECT_CANDIDATE",
        entity_type: "CANDIDATE", entity_id: candidateId, after_state: updated, event_reference_id,
        metadata: { reason },
      }, tx);
      return updated;
    });
  }

  async createCandidate(tenant_id: string, data: any, user_id?: string): Promise<Candidate> {
    // Req 11.1: persist the candidate within the caller's scope; the repository
    // binds the record to `tenant_id` (sourced from the verified context, not the
    // client). The repo write and audit log run inside a single transaction so the
    // record and its audit trail commit or roll back together (consistent with
    // `createRequisition`).
    const event_reference_id = `EVT-HR-CAND-NEW-${Date.now()}`;
    return this.prisma.$transaction(async (tx: any) => {
      const candidate = await this.hrRepository.createCandidate(tenant_id, data, tx);
      await this.auditService.log({
        tenant_id, user_id: user_id || "SYSTEM", module: "HR", action: "CREATE_CANDIDATE", entity_type: "CANDIDATE", entity_id: candidate.id, after_state: candidate, event_reference_id,
      }, tx);
      return candidate;
    });
  }

  async hireCandidate(tenant_id: string, candidateId: string, data: any, user_id?: string) {
    // Req 11.2: hiring creates the corresponding employee within the SAME
    // `tenant_id` inside an Atomic_Operation. The repository performs the multi-row
    // write (candidate -> hired, user/company provisioning, employee + initial
    // contract + outbox event) and the audit log runs inside the SAME transaction,
    // so they commit or roll back together (Req 4.1/4.4). The repo participates in
    // the supplied `tx` rather than opening a nested transaction. SERIALIZABLE
    // isolation preserves the no-double-hire guarantee under concurrency.
    const event_reference_id = `EVT-HR-EMP-HIRE-${Date.now()}`;
    return this.prisma.$transaction(async (tx: any) => {
      const employee = await this.hrRepository.hireCandidate(tenant_id, candidateId, data || {}, tx);
      await this.auditService.log({
        tenant_id,
        user_id: user_id || data?.actor_id || "SYSTEM",
        module: "HR",
        action: "HIRE",
        entity_type: "EMPLOYEE",
        entity_id: employee.id,
        after_state: employee,
        event_reference_id,
        metadata: { candidateId },
      }, tx);
      return employee;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  async getInterviews(tenant_id: string, candidateId?: string): Promise<Interview[]> {
    return this.hrRepository.getInterviews(tenant_id, candidateId);
  }

  async scheduleInterview(tenant_id: string, data: any, user_id?: string): Promise<Interview> {
    // Req 11.1: persist the interview within the caller's scope; wrap the repo
    // write and audit log in a single transaction (consistent with
    // `createRequisition`) so neither persists without the other.
    const event_reference_id = `EVT-HR-INT-NEW-${Date.now()}`;
    return this.prisma.$transaction(async (tx: any) => {
      const interview = await this.hrRepository.scheduleInterview(tenant_id, data, tx);
      await this.auditService.log({
        tenant_id, user_id: user_id || "SYSTEM", module: "HR", action: "SCHEDULE_INTERVIEW", entity_type: "INTERVIEW", entity_id: interview.id, after_state: interview, event_reference_id,
      }, tx);
      return interview;
    });
  }

  async getTalentLeads(tenant_id: string, status?: string): Promise<TalentLead[]> {
    return this.hrRepository.getTalentLeads(tenant_id, status);
  }

  async convertLeadToCandidate(tenant_id: string, lead_id: string, requisitionId: string, user_id?: string): Promise<Candidate> {
    return this.hrRepository.createCandidate(tenant_id, { lead_id, requisitionId });
  }
}
