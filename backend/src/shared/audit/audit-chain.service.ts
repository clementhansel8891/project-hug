import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../persistence/prisma.service';
import { AuditService } from './audit.service';
import { createHash } from 'crypto';

@Injectable()
export class AuditChainService {
  private readonly logger = new Logger(AuditChainService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Fix 2: Safe Repair Mode (MANDATORY)
   * Detects and repairs broken audit chains without silent overwrites.
   */
  async repairChain(
    tenant_id: string, 
    user_id: string, 
    approval: { approvedBy: string; reason: string },
    fromTimestamp?: Date
  ) {
    this.logger.log(`[AuditChainService] Starting chain repair for tenant ${tenant_id}. Requested by: ${user_id}, Approved by: ${approval.approvedBy}`);

    // Step 3: Repair Authorization Hardened Log
    await this.audit.log({
      tenant_id,
      user_id,
      module: 'SYSTEM',
      action: 'AUDIT_CHAIN_REPAIR_REQUEST',
      entity_type: 'AUDIT_CHAIN',
      entity_id: tenant_id,
      severity: 'WARN',
      metadata: { 
        ...approval,
        requestedTimestamp: new Date().toISOString(),
      },
    });

    this.audit.incrementRepairCount();

    const logs = await this.prisma.audit_logs.findMany({
      where: {
        tenant_id: tenant_id,
        created_at: fromTimestamp ? { gte: fromTimestamp } : undefined,
      },
      orderBy: { created_at: 'asc' },
      take: 10000
    });

    let corruptionDetected = false;
    let repairedCount = 0;
    let lastHash = 'GENESIS';

    // If starting from a point, find the hash of the entry just before it
    if (fromTimestamp) {
      const prevLog = await this.prisma.audit_logs.findFirst({
        where: {
          tenant_id: tenant_id,
          created_at: { lt: fromTimestamp },
        },
        orderBy: { created_at: 'desc' },
        select: { hash_chain: true },
      });
      lastHash = prevLog?.hash_chain || 'GENESIS';
    }

    const affectedRange = {
      startId: logs[0]?.id,
      endId: logs[logs.length - 1]?.id,
    };

    for (const log of logs) {
      const expectedPrevHash = lastHash;
      
      // Check for corruption
      if (log.previous_hash !== expectedPrevHash) {
        corruptionDetected = true;
        
        // Recompute the correct hash for this entry
        const logData = JSON.stringify({
          tenant_id: log.tenant_id,
          user_id: log.user_id,
          action: log.action,
          entity_id: log.entity_id,
          correlation_id: log.correlation_id,
          previousHash: expectedPrevHash,
        });
        const recomputedHash = createHash('sha256').update(logData).digest('hex');

        // Update with safe repair tracking
        await this.prisma.audit_logs.update({
          where: { id: log.id },
          data: {
            status: 'REPAIRED',
            original_hash: log.hash_chain,
            recomputed_hash: recomputedHash,
            previous_hash: expectedPrevHash,
            hash_chain: recomputedHash,
          },
        });

        this.logger.warn(`[AuditChainService] Repaired log ${log.id}. Found mismatch: ${log.previous_hash} !== ${expectedPrevHash}`);
        repairedCount++;
        lastHash = recomputedHash;
      } else {
        lastHash = log.hash_chain || 'CORRUPT_NULL';
      }
    }

    // Requirement: Audit event for repair
    await this.audit.log({
      tenant_id,
      user_id,
      module: 'SYSTEM',
      action: 'AUDIT_CHAIN_REPAIR',
      entity_type: 'AUDIT_CHAIN',
      entity_id: tenant_id,
      severity: 'CRITICAL', // Fix 2: Mandatory Critical Severity
      metadata: {
        affectedRange,
        repairedCount,
        corruptionDetected,
        triggeredBy: user_id,
      },
    });

    return {
      success: true,
      corruptionDetected,
      repairedCount,
      affectedRange,
    };
  }

  /**
   * Proactive Integrity Verification
   * Checks the hash chain for a tenant without modifying data.
   */
  async verifyIntegrity(tenant_id: string): Promise<{
    status: 'HEALTHY' | 'CORRUPT';
    totalLogs: number;
    brokenCount: number;
    firstBrokenId?: string;
    details: string;
  }> {
    this.logger.log(`[AuditChainService] Verifying integrity for tenant ${tenant_id}`);

    const logs = await this.prisma.audit_logs.findMany({
      where: { tenant_id },
      orderBy: { created_at: 'asc' },
      select: { id: true, previous_hash: true, hash_chain: true },
      take: 10000
    });

    if (logs.length === 0) {
      return { status: 'HEALTHY', totalLogs: 0, brokenCount: 0, details: 'No logs found' };
    }

    let brokenCount = 0;
    let firstBrokenId = undefined;
    let lastHash = 'GENESIS';

    for (const log of logs) {
      if (log.previous_hash !== lastHash) {
        brokenCount++;
        if (!firstBrokenId) firstBrokenId = log.id;
      }
      lastHash = log.hash_chain || 'NULL';
    }

    const status = brokenCount === 0 ? 'HEALTHY' : 'CORRUPT';
    
    return {
      status,
      totalLogs: logs.length,
      brokenCount,
      firstBrokenId,
      details: status === 'HEALTHY' 
        ? 'All audit links verified successfully.' 
        : `Detected ${brokenCount} broken links in the audit chain.`
    };
  }
}
