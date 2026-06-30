import { Module } from "@nestjs/common";
import { useDbPersistence } from "../../shared/persistence.mode";
import { PrismaService } from "../../persistence/prisma.service";
import { ScopeModule } from "../../shared/scope/scope.module";
import { AtomicOperationModule } from "../shared/atomic/atomic-operation.module";
import { IncentivesModule } from "../incentives/incentives.module";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";
import { SalesDbRepository } from "./repositories/sales.db.repository";
import { SalesMockRepository } from "./repositories/sales.mock.repository";
import { ISalesRepository } from "./repositories/sales.repository.interface";

@Module({
  imports: [ScopeModule, AtomicOperationModule, IncentivesModule],
  controllers: [SalesController],
  providers: [
    PrismaService,
    SalesService,
    {
      provide: ISalesRepository,
      useClass: useDbPersistence() ? SalesDbRepository : SalesMockRepository,
    },
  ],
  exports: [SalesService],
})
export class SalesModule {}
