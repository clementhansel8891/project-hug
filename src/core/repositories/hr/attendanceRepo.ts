import type { AttendanceDevice, AttendancePolicy, AttendanceRecord, WorkplaceLocation, AttendanceEvent, AttendanceStatus } from "@/core/types/hr/attendance";
import { prisma } from "@/core/persistence/database/client";

/**
 * Mapping helper for Attendance Record
 */
const mapToRecord = (db: any): AttendanceRecord => ({
  id: db.id,
  tenantId: db.tenantId,
  employeeId: db.employeeId,
  date: db.date.toISOString().split('T')[0],
  shiftId: db.shiftId || "shift-default",
  policyId: db.policyId || "policy-default",
  status: db.status as AttendanceStatus,
  workDurationMinutes: db.workDurationMinutes,
  abnormalTags: (db.abnormalTags as string[]) || [],
  requiresAttention: db.requiresAttention,
  checkIn: db.checkIn ? (db.checkIn as any as AttendanceEvent) : undefined,
  checkOut: db.checkOut ? (db.checkOut as any as AttendanceEvent) : undefined,
  createdAt: db.createdAt.toISOString(),
  updatedAt: db.updatedAt.toISOString(),
} as AttendanceRecord);

export const attendanceRepo = {
  /**
   * Mock policy for now as it's not yet in DB
   */
  getPolicy(tenantId: string): AttendancePolicy {
    return {
      id: "policy-global",
      tenantId,
      name: "Standard Global Policy",
      gracePeriodMinutes: 15,
      lateThresholdMinutes: 60,
      requirePhotoProof: false,
      requireLocation: true,
      autoCheckout: true,
    };
  },

  /**
   * List locations from DB
   */
  async listLocations(tenantId: string): Promise<WorkplaceLocation[]> {
    const locations = await prisma.location.findMany({
      where: { tenantId: tenantId, deletedAt: null }
    });

    return (Array.isArray(locations) ? locations : []).map(l => ({
      id: l.id,
      tenantId: l.tenantId,
      name: l.name,
      address: l.address || "",
      coordinates: { lat: 0, lng: 0 }, // Defaults if not in DB
      geofenceRadius: 100
    }));
  },

  async getLocation(tenantId: string, locationId: string): Promise<WorkplaceLocation | undefined> {
    const loc = await prisma.location.findFirst({
      where: { id: locationId, tenantId: tenantId, deletedAt: null }
    });
    if (!loc) return undefined;
    
    return {
      id: loc.id,
      tenantId: loc.tenantId,
      name: loc.name,
      address: loc.address || "",
      coordinates: { lat: 0, lng: 0 },
      geofenceRadius: 100
    };
  },

  /**
   * Devices are mock for now
   */
  getDevice(tenantId: string, deviceId: string): AttendanceDevice | undefined {
    if (deviceId === "dev-mobile") {
      return {
        id: "dev-mobile",
        tenantId,
        name: "Estela Gea Mobile App",
        type: "mobile",
        isActive: true,
      };
    }
    return undefined;
  },

  /**
   * List all attendance records for a tenant
   */
  async list(tenantId: string): Promise<AttendanceRecord[]> {
    const records = await prisma.attendanceRecord.findMany({
      where: { tenantId: tenantId },
      orderBy: { date: 'desc' },
    });

    return (Array.isArray(records) ? records : []).map(mapToRecord);
  },

  /**
   * Get specific record for employee and date
   */
  async getRecord(tenantId: string, employeeId: string, date: string): Promise<AttendanceRecord | undefined> {
    const record = await prisma.attendanceRecord.findFirst({
      where: {
        tenantId: tenantId,
        employeeId,
        date: new Date(date),
      },
    });

    return record ? mapToRecord(record) : undefined;
  },

  /**
   * Save or Update an attendance record
   */
  async saveRecord(tenantId: string, record: AttendanceRecord): Promise<void> {
    await prisma.attendanceRecord.upsert({
      where: {
        id: record.id,
      },
      update: {
        status: record.status,
        checkIn: record.checkIn as any,
        checkOut: record.checkOut as any,
        workDurationMinutes: Number(record.workDurationMinutes),
        abnormalTags: record.abnormalTags as any,
        requiresAttention: record.requiresAttention,
        shiftId: record.shiftId,
        policyId: record.policyId,
      },
      create: {
        id: record.id,
        tenantId: tenantId,
        employeeId: record.employeeId,
        locationId: record.checkIn?.locationId || "loc-default",
        date: new Date(record.date),
        status: record.status,
        checkIn: record.checkIn as any,
        checkOut: record.checkOut as any,
        workDurationMinutes: Number(record.workDurationMinutes),
        abnormalTags: record.abnormalTags as any,
        requiresAttention: record.requiresAttention,
        shiftId: record.shiftId,
        policyId: record.policyId,
      },
    });
  },
};
