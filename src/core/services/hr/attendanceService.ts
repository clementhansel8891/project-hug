import { apiRequest } from "@/core/api/apiClient";
import type { SessionContext } from "@/core/security/session";
import type { AttendanceEvent, AttendanceRecord } from "@/core/types/hr/attendance";

export const attendanceService = {
  async getStats(tenantId: string, session: SessionContext) {
    // Calling backend to get attendance records and calculating stats
    // Or ideally backend provides a stats endpoint
    const today = new Date().toISOString().split("T")[0];
    const records = await apiRequest<AttendanceRecord[]>("/v1/hr/attendance", "GET", session);
    const todayRecords = (Array.isArray(records) ? records : []).filter(r => r.date === today);
    
    return {
      present: (Array.isArray(todayRecords) ? todayRecords : []).filter(r => !r.checkOut).length,
      late: (Array.isArray(todayRecords) ? todayRecords : []).filter(r => r.status === "late").length,
      absent: (Array.isArray(todayRecords) ? todayRecords : []).filter(r => r.status === "absent").length,
      onLeave: (Array.isArray(todayRecords) ? todayRecords : []).filter(r => r.status === "on_leave").length,
    };
  },

  async validateAccess(tenantId: string, locationId: string, deviceId: string, coordinates?: { lat: number; lng: number }) {
    // Validate that the location and device are valid for this tenant
    // In production this would check geofencing and device registration
    if (!locationId || !deviceId) return false;
    return true;
  },

  async clockIn(tenantId: string, actor: SessionContext, input: {
      locationId: string;
      deviceId: string;
      coordinates?: { lat: number; lng: number };
      verificationMethod: AttendanceEvent["verificationMethod"];
      reason?: string;
  }) {
    return apiRequest<AttendanceRecord>("/v1/hr/attendance/clock-in", "POST", actor, {
      employeeId: actor.user_id,
      reason: input.reason
    }, {
      locationId: input.locationId
    });
  },

  async clockOut(tenantId: string, actor: SessionContext, input: {
      locationId: string;
      deviceId: string;
      coordinates?: { lat: number; lng: number };
      verificationMethod: AttendanceEvent["verificationMethod"];
  }) {
    return apiRequest<AttendanceRecord>("/v1/hr/attendance/clock-out", "POST", actor, {
      employeeId: actor.user_id
    });
  },

  async generateAbnormalCase(tenantId: string, actor: SessionContext, record: AttendanceRecord) {
     console.log("Generating abnormal case for", record.id);
  },

  async listAttendance(tenantId: string, actor: SessionContext, startDate?: string, endDate?: string) {
    let query = "";
    if (startDate) query += `?startDate=${startDate}`;
    if (endDate) query += `&endDate=${endDate}`;
    
    // Note: Backend endpoint /hr/attendance currently returns records for the tenant
    // It might need employeeId filter if the UI expects it
    // The previous implementation used attendanceRepo.list(tenantId)
    return apiRequest<AttendanceRecord[]>(`/v1/hr/attendance${query}`, "GET", actor);
  }
};

