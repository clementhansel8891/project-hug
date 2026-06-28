import { Module, Global } from '@nestjs/common';
import { PricingEngineService } from './pricing-engine.service';
import { PricingDbRepository } from './repositories/pricing.db.repository';
import { PricingMockRepository } from './repositories/pricing.mock.repository';
import { IPricingRepository } from './repositories/interfaces/pricing.repository.interface';
import { FinanceModule } from '../finance/finance.module';
import { PricingController } from './pricing.controller';
import { useDbPersistence } from '../../shared/persistence.mode';

@Global()
@Module({
  imports: [FinanceModule],
  controllers: [PricingController],
  providers: [
    PricingEngineService,
    {
      provide: 'IPricingRepository',
      useClass: useDbPersistence() ? PricingDbRepository : PricingMockRepository,
    },
  ],
  exports: [PricingEngineService],
})
export class PricingModule {}
