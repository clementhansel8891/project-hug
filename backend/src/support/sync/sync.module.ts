import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { PrismaService } from '../../persistence/prisma.service';
import { SyncValidationService } from './sync-validation.service';
import { IdempotencyService } from './idempotency.service';
import { SyncEngineService } from './sync-engine.service';
import { ConflictResolverService } from './conflict-resolver.service';
import { InventoryLedgerService } from './inventory-ledger.service';

@Module({
  controllers: [SyncController],
  providers: [PrismaService, SyncValidationService, IdempotencyService, SyncEngineService, ConflictResolverService, InventoryLedgerService],
  exports: [SyncValidationService, IdempotencyService, SyncEngineService, ConflictResolverService, InventoryLedgerService],
})
export class SyncModule {}
