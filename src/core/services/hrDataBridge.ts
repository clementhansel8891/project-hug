export type StaffRecord = {
  id: string;
  tenantId: string;
  fullName: string;
  departmentId: string;
  roleTitle: string;
  status: "active" | "on_leave" | "inactive";
};

export type PayrollCycle = {
  id: string;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "pending" | "approved" | "exported";
};

export type ComplianceContract = {
  id: string;
  tenantId: string;
  title: string;
  type: "internal" | "external";
  status: "draft" | "active" | "expired";
  expiryDate?: string;
};

type ModuleBridge = {
  getStaffList: (tenantId: string) => StaffRecord[];
  getStaffById: (tenantId: string, staffId: string) => StaffRecord | undefined;
  getPayrollCycles: (tenantId: string) => PayrollCycle[];
  getComplianceContracts: (tenantId: string) => ComplianceContract[];
};

let moduleProvider: ModuleBridge | null = null;

export function registerHrModuleProvider(provider: ModuleBridge) {
  moduleProvider = provider;
}

const mockStaff: StaffRecord[] = [
  {
    id: "staff-001",
    tenantId: "tenant-001",
    fullName: "Amelia Hart",
    departmentId: "dept-ops",
    roleTitle: "Regional Manager",
    status: "active",
  },
  {
    id: "staff-002",
    tenantId: "tenant-002",
    fullName: "Victor Lim",
    departmentId: "dept-fin",
    roleTitle: "Finance Controller",
    status: "active",
  },
];

export function getStaffList(tenantId: string): StaffRecord[] {
  if (moduleProvider) return moduleProvider.getStaffList(tenantId);
  // No mock fallback — return empty for real tenants
  return [];
}

export function getStaffById(tenantId: string, staffId: string): StaffRecord | undefined {
  if (moduleProvider) return moduleProvider.getStaffById(tenantId, staffId);
  return undefined;
}

export function getPayrollCycles(tenantId: string): PayrollCycle[] {
  if (moduleProvider) return moduleProvider.getPayrollCycles(tenantId);
  return [];
}

export function getComplianceContracts(tenantId: string): ComplianceContract[] {
  if (moduleProvider) return moduleProvider.getComplianceContracts(tenantId);
  return [];
}
