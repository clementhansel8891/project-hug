import { Module, forwardRef } from "@nestjs/common";
import { AdminModule } from "../../core/admin/admin.module";
import { InventoryModule } from "../../core/inventory/inventory.module";
import { EventsModule } from "../../shared/events/events.module";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { MarketingModule } from "../../core/marketing/marketing.module";
import { SalesModule } from "../../core/sales/sales.module";
import { RetailController } from "./retail.controller";
import { RetailInfrastructureController } from "./retail-infrastructure.controller";
import { RetailOperationsController } from "./retail-operations.controller";
import { RetailPublicGatewayController } from "./retail-public.gateway.controller";
import { RetailPublicAuthController } from "./retail-public-auth.controller";
import { RetailPublicCustomerController } from "./retail-public-customer.controller";
import { RetailEventsController } from "./retail-events.controller";
import { RetailGovernanceController } from "./retail-governance.controller";
import { EcommerceHubController } from "./ecommerce-hub.controller";
import { RetailService } from "./retail.service";
import { RetailInfrastructureService } from "./retail-infrastructure.service";
import { RetailGatewayService } from "./retail-gateway.service";
import { RetailPublicAuthService } from "./retail-public-auth.service";
import { RetailPublicCustomerService } from "./retail-public-customer.service";
import { RetailEventsService } from "./retail-events.service";
import { EcommerceHubService } from "./ecommerce-hub.service";
import { RetailPrintService } from "./retail-print.service";
import { RetailExportService } from "./retail-export.service";
import { IRetailRepository } from "./repositories/retail.repository.interface";
import { RetailMockRepository } from "./repositories/retail.mock.repository";
import { RetailDbRepository } from "./repositories/retail.db.repository";
import { IRetailInfrastructureRepository } from "./repositories/retail-infrastructure.repository.interface";
import { RetailInfrastructureDbRepository } from "./repositories/retail-infrastructure.db.repository";
import { IEcommerceHubRepository } from "./repositories/ecommerce-hub.repository.interface";
import { EcommerceHubDbRepository } from "./repositories/ecommerce-hub.db.repository";
import { ChannelCredentialsGuard } from "./guards/channel-credentials.guard";
import { CustomerAuthGuard } from "./guards/customer-auth.guard";
import { EcommerceConnectorGuard } from "./guards/ecommerce-connector.guard";
import { AuditModule } from "../../shared/audit/audit.module";
import { RetailSeeder } from "./seeders/retail.seeder";
import { RetailCoreListener } from "./listeners/retail-core.listener";

import { PersistenceModule } from "../../persistence/persistence.module";
import { FinanceModule } from "../../core/finance/finance.module";
import { PaymentModule } from "../../core/payment/payment.module";
import { CommsModule } from "../../shared/comms/comms.module";

@Module({
  imports: [
    PersistenceModule,
    AdminModule,
    forwardRef(() => InventoryModule),
    FinanceModule,
    PaymentModule,
    EventsModule,
    AuditModule,
    CommsModule,
    EventEmitterModule,
    MarketingModule,
    SalesModule,
  ],
  controllers: [
    RetailController,
    RetailInfrastructureController,
    RetailOperationsController,
    RetailGovernanceController,
    RetailPublicGatewayController,
    RetailPublicAuthController,
    RetailPublicCustomerController,
    RetailEventsController,
    EcommerceHubController,
  ],
  providers: [
    RetailService,
    RetailInfrastructureService,
    RetailGatewayService,
    RetailPublicAuthService,
    RetailPublicCustomerService,
    RetailEventsService,
    ChannelCredentialsGuard,
    CustomerAuthGuard,
    EcommerceConnectorGuard,
    EcommerceHubService,
    RetailPrintService,
    RetailExportService,
    RetailSeeder,
    RetailCoreListener,
    {
      provide: IRetailRepository,
      useClass: RetailDbRepository,
    },
    {
      provide: IRetailInfrastructureRepository,
      useClass: RetailInfrastructureDbRepository,
    },
    {
      provide: IEcommerceHubRepository,
      useClass: EcommerceHubDbRepository,
    },
  ],
  exports: [RetailService, RetailInfrastructureService, RetailPrintService, RetailSeeder],
})
export class RetailModule {}
