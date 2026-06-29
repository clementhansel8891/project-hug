-- AddITTicketing: IT Service Management (tickets, incidents, SLA config)

-- CreateTable
CREATE TABLE "it_tickets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignee_id" TEXT,
    "reporter_id" TEXT,
    "escalation_level" INTEGER NOT NULL DEFAULT 0,
    "escalated_to" TEXT,
    "escalation_reason" TEXT,
    "resolution_notes" TEXT,
    "resolution_category" TEXT,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "it_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_incidents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "affected_systems" TEXT NOT NULL,
    "discovered_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "it_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_sla_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT,
    "priority" TEXT NOT NULL,
    "response_time_minutes" INTEGER NOT NULL,
    "resolution_time_minutes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "it_sla_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "it_tickets_tenant_id_idx" ON "it_tickets"("tenant_id");
CREATE INDEX "it_tickets_company_id_idx" ON "it_tickets"("company_id");
CREATE INDEX "it_tickets_status_idx" ON "it_tickets"("status");
CREATE INDEX "it_incidents_tenant_id_idx" ON "it_incidents"("tenant_id");
CREATE INDEX "it_incidents_company_id_idx" ON "it_incidents"("company_id");
CREATE INDEX "it_incidents_severity_idx" ON "it_incidents"("severity");
CREATE INDEX "it_sla_configs_tenant_id_idx" ON "it_sla_configs"("tenant_id");
CREATE UNIQUE INDEX "it_sla_configs_tenant_id_priority_key" ON "it_sla_configs"("tenant_id", "priority");

-- AddForeignKey
ALTER TABLE "it_tickets" ADD CONSTRAINT "it_tickets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "it_incidents" ADD CONSTRAINT "it_incidents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "it_sla_configs" ADD CONSTRAINT "it_sla_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
