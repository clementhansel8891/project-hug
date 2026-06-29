-- FixReportJobsForeignKey
-- The sys_report_jobs.tenant_id FK was incorrectly referencing the companies
-- table instead of the tenants table. This migration corrects the constraint.

-- Drop the incorrect foreign key
ALTER TABLE "sys_report_jobs" DROP CONSTRAINT IF EXISTS "sys_report_jobs_tenant_id_fkey";

-- Add the correct foreign key referencing tenants
ALTER TABLE "sys_report_jobs" ADD CONSTRAINT "sys_report_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
