-- CreateTable
CREATE TABLE "marketing_omnichannel_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT,
    "channel" TEXT NOT NULL,
    "auto_reply" BOOLEAN NOT NULL DEFAULT false,
    "auto_reply_message" TEXT,
    "assign_to" TEXT NOT NULL DEFAULT 'MANUAL',
    "max_concurrent_chats" INTEGER NOT NULL DEFAULT 10,
    "business_hours_only" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_omnichannel_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketing_omnichannel_configs_tenant_id_channel_key" ON "marketing_omnichannel_configs"("tenant_id", "channel");

-- CreateIndex
CREATE INDEX "marketing_omnichannel_configs_tenant_id_idx" ON "marketing_omnichannel_configs"("tenant_id");

-- AddForeignKey
ALTER TABLE "marketing_omnichannel_configs" ADD CONSTRAINT "marketing_omnichannel_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
