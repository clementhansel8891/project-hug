import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { TenantMiddleware } from "./gateway/tenant.middleware";
import { FinanceModule } from "./core/finance/finance.module";
import { HRModule } from "./core/hr/hr.module";
import { ITSettingsModule } from "./core/it-settings/it-settings.module";
import { ProcurementModule } from "./core/procurement/procurement.module";
import { InventoryModule } from "./core/inventory/inventory.module";
import { AdminModule } from "./core/admin/admin.module";
import { ITModule } from "./core/it/it.module";
import { SalesModule } from "./core/sales/sales.module";
import { MarketingModule } from "./core/marketing/marketing.module";
import { PaymentModule } from "./core/payment/payment.module";
import { RetailModule } from "./modules/retail/retail.module";
import { WarehouseModule } from "./modules/warehouse/warehouse.module";
import { IntelligenceModule } from "./support/intelligence/intelligence.module";
import { ExplorerModule } from "./core/explorer/explorer.module";
import { PersistenceModule } from "./persistence/persistence.module";
import { AuditModule } from "./shared/audit/audit.module";
import { AuthModule } from "./core/auth/auth.module";
import { LoggerModule } from './shared/logger/logger.module';
import { LicenseModule } from './shared/license/license.module';
import { CommsModule } from './shared/comms/comms.module';
import { EventsModule } from "./shared/events/events.module";
import { WorkflowModule } from "./shared/workflow/workflow.module";
import { AutomationModule } from "./shared/automation/automation.module";
import { CommandBusModule } from "./shared/command-bus/command-bus.module";
import { ComplianceEngineModule } from "./modules/compliance/compliance.module";
import { HealthController } from "./gateway/health.controller";
import { PricingModule } from "./core/pricing/pricing.module";
import { AgenticModule } from "./agentic/agentic.module";
import { WorkflowEngineModule } from "./core/workflow/workflow.module";
import { MaintenanceModule } from "./shared/maintenance/maintenance.module";
import { IotModule } from "./shared/iot/iot.module";
import { ReportingModule } from "./shared/reporting/reporting.module";
import { SettingsModule } from "./core/settings/settings.module";
import { IncentivesModule } from "./core/incentives/incentives.module";


import { APP_GUARD, APP_PIPE } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { ConfigModule } from "@nestjs/config";
import { validate } from "./config/env.validation";
import { EventEmitterModule } from "@nestjs/event-emitter";

import { JVReadOnlyGuard } from "./gateway/jv-read-only.guard";
import { GlobalValidationPipe } from "./shared/pipes/global-validation.pipe";
import { AppCacheModule } from "./shared/cache";

/**
 * App Module
 * Root application module for Zenvix Backend
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      validate,
      isGlobal: true,
    }),
    ...(process.env.VERCEL === "1" ? [] : [ScheduleModule.forRoot()]),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 300,
      },
    ]),
    EventEmitterModule.forRoot(),
    AppCacheModule,
    LoggerModule,
    LicenseModule,
    CommsModule,
    PersistenceModule,
    EventsModule,
    WorkflowModule,
    CommandBusModule,
    ComplianceEngineModule,
    AutomationModule,
    AuditModule,
    ReportingModule,
    FinanceModule,
    HRModule,
    ITSettingsModule,
    ProcurementModule,
    InventoryModule,
    AdminModule,
    ITModule,
    SalesModule,
    MarketingModule,
    PaymentModule,
    RetailModule,
    WarehouseModule,
    IntelligenceModule,
    ExplorerModule,
    AuthModule,
    PricingModule,
    AgenticModule,
    WorkflowEngineModule,
    MaintenanceModule,
    IotModule,
    SettingsModule,
    IncentivesModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_PIPE,
      useClass: GlobalValidationPipe,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JVReadOnlyGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        "auth/*path",
        "v1/auth/*path",
        "retail/public/*path",
        "v1/retail/public/*path",
        "retail/events",
        "v1/retail/events",
        "monitoring/*path",
        "v1/monitoring/*path",
        "inventory/images/*path",
        "v1/inventory/images/*path"
      )
      .forRoutes("*path");
  }
}
