import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthRoutingController } from "./auth-routing.controller";
import { CompanyRegistrationController } from "./company-registration.controller";
import { CompanyRegistrationService } from "./company-registration.service";
import { ModuleStateGuard } from "./guards/module-state.guard";
import { BranchGatingGuard } from "./guards/branch-gating.guard";
import { PrismaService } from "../../persistence/prisma.service";
import { IAuthRepository } from "./repositories/auth.repository.interface";
import { AuthMockRepository } from "./repositories/auth.mock.repository";
import { AuthDbRepository } from "./repositories/auth.db.repository";
import { IProvisioningRepository } from "./repositories/provisioning.repository.interface";
import { ProvisioningMockRepository } from "./repositories/provisioning.mock.repository";
import { ProvisioningDbRepository } from "./repositories/provisioning.db.repository";
import { useDbPersistence } from "../../shared/persistence.mode";

@Module({
  controllers: [AuthController, AuthRoutingController, CompanyRegistrationController],
  providers: [
    AuthService,
    CompanyRegistrationService,
    ModuleStateGuard,
    BranchGatingGuard,
    PrismaService,
    {
      provide: IAuthRepository,
      useClass: useDbPersistence() ? AuthDbRepository : AuthMockRepository,
    },
    {
      provide: IProvisioningRepository,
      useClass: ProvisioningDbRepository,
    },
  ],
  exports: [AuthService, ModuleStateGuard, BranchGatingGuard], // Export in case other modules need to decode JWTs or enforce architectural gates
})
export class AuthModule {}
