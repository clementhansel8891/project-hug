import { apiRequest } from "@/core/api/apiClient";
import type { SessionContext } from "@/core/security/session";

export const reportingService = {
  /**
   * Request a new report generation job
   */
  async generateReport(session: SessionContext, params: { report_type: string; format: string; payload?: any }) {
    return apiRequest<{ success: boolean; job_id: string }>('/v1/reporting/generate', 'POST', session, params);
  },

  /**
   * Poll for report job status
   */
  async getJobStatus(session: SessionContext, jobId: string) {
    return apiRequest<{ id: string; status: string; progress: number; error?: string }>('/v1/reporting/' + jobId + '/status', 'GET', session);
  },

  /**
   * Trigger direct browser download for a completed report
   */
  async downloadReport(session: SessionContext, jobId: string) {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const url = `${baseUrl}/v1/reporting/${jobId}/download`;
    
    // Using window.open for "true download" experience with correct headers handled by backend
    window.open(url, '_blank');
  }
};
