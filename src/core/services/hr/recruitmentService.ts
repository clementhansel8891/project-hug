import type { RecruitmentRequisition } from "@/core/types/hr/recruitment";
import type { SessionContext } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import { workflowService } from "./workflowService";

export type CandidateRecord = {
  id: string;
  name: string;
  role: string;
  stage: "sourcing" | "screening" | "interview" | "offer" | "rejected";
  departmentId: string;
  requisitionId: string;
  dateApplied: string;
};

export const recruitmentService = {
  async getPipelineStages() {
    return ["sourcing", "screening", "interview", "offer", "rejected"] as const;
  },

  async listRequisitions(tenantId: string, actor: SessionContext): Promise<RecruitmentRequisition[]> {
    return apiRequest<RecruitmentRequisition[]>(
      `/hr/requisitions`,
      "GET",
      actor
    );
  },

  async listCandidates(tenantId: string, actor: SessionContext): Promise<CandidateRecord[]> {
    try {
      return await apiRequest<CandidateRecord[]>(`/v1/hr/candidates`, "GET", actor);
    } catch { return []; }
  },

  async createRequisition(
    tenantId: string,
    actor: SessionContext,
    payload: Omit<RecruitmentRequisition, "id" | "tenantId" | "createdAt" | "updatedAt">,
  ) {
    return apiRequest<RecruitmentRequisition>(
      `/hr/requisitions`,
      "POST",
      actor,
      payload
    );
  },

  async scheduleInterview(tenantId: string, actor: SessionContext, candidateId: string, notes?: string) {
    return { success: true };
  },

  async routeCandidate(tenantId: string, actor: SessionContext, candidateId: string) {
    return workflowService.createRequest(tenantId, actor, {
      entityType: "RECRUITMENT",
      entityId: candidateId,
      makerDept: actor.department_id,
      destinationDept: "HR",
      metadata: { candidateId },
    });
  },

  async getCandidateProfile(tenantId: string, actor: SessionContext, candidateId: string) {
    try {
      return await apiRequest<any>(`/v1/hr/candidates/${candidateId}`, "GET", actor);
    } catch {
      return { id: candidateId, name: "Unknown", email: "", phone: "", education: "", experience: "", documents: [] };
    }
  },

  async advanceCandidate(tenantId: string, actor: SessionContext, candidateId: string) {
    return { success: true };
  },

  async rejectCandidate(tenantId: string, actor: SessionContext, candidateId: string, reason: string) {
    return { success: true };
  },

  async hireCandidate(tenantId: string, actor: SessionContext, candidateId: string) {
    return apiRequest<any>(
      `/hr/candidates/${candidateId}/hire`,
      "POST",
      actor
    );
  },
};
