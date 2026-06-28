import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../persistence/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface AuditLogParams {
  tenant_id: string;
  user_id: string;
  module: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata?: any;
  changes?: any;
  before_state?: any;
  after_state?: any;
  ip_address?: string;
  user_agent?: string;
  device_model?: string;
  severity?: 'INFO' | 'WARN' | 'CRITICAL';
  idempotency_key?: string;
  correlation_id?: string;
  event_reference_id?: string;
}

export interface AuditQueryDto {
  module?: string;
  action?: string;
  user_id?: string;
  entity_type?: string;
  entity_id?: string;
  severity?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditService implements OnModuleDestroy {
  private verificationInterval: any;
  private readonly metrics = {
    auditWriteLatency: [] as number[],
    auditFailureRate: 0,
    chainVerificationFailures: 0,
    anchorWriteFailures: 0,
  };
  private readonly backupDir = process.env.BACKUP_DIR || (process.env.NODE_ENV === 'production' ? '/data/backups' : path.join(process.cwd(), 'backups'));
  private readonly anchorLogPath = process.env.ANCHOR_LOG_PATH || (process.env.NODE_ENV === 'production' ? '/data/logs/external_audit_anchors.log' : path.join(process.cwd(), 'external_audit_anchors.log'));
  private readonly secondaryAnchorPath = path.join(this.backupDir, 'audit_anchors.log');

  constructor(private readonly prisma: PrismaService) {
    this.ensureBackupDir();
    this.startSelfVerificationJob();
  }

  onModuleDestroy() {
    if (this.verificationInterval) {
      clearInterval(this.verificationInterval);
    }
  }

  /**
   * Canonical audit-chain hash. MUST be byte-identical across write, verify, and
   * repair. correlation_id is included ONLY when present: JSON.stringify omits
   * `undefined` keys, which is exactly what the historical write path produced.
   * Serializing a null/absent correlation_id as `null` here would diverge from the
   * stored hashes and raise false "chain corruption". Key order is fixed:
   * tenant_id, user_id, action, entity_id, [correlation_id], previousHash.
   */
  private computeChainHash(
    fields: { tenant_id: string; user_id: string; action: string; entity_id: string; correlation_id?: string | null },
    previousHash: string,
  ): string {
    const payload: Record<string, unknown> = {
      tenant_id: fields.tenant_id,
      user_id: fields.user_id,
      action: fields.action,
      entity_id: fields.entity_id,
    };
    if (fields.correlation_id !== undefined && fields.correlation_id !== null) {
      payload.correlation_id = fields.correlation_id;
    }
    payload.previousHash = previousHash;
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private ensureBackupDir() {
    [path.dirname(this.anchorLogPath), path.dirname(this.secondaryAnchorPath)].forEach(dir => {
      if (!fs.existsSync(dir)) {
        console.log(`[AuditService] Creating directory: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  private startSelfVerificationJob() {
    // Run every 10 minutes
    this.verificationInterval = setInterval(async () => {
      console.log('[AuditService] Starting continuous self-verification...');
      try {
        const tenants = await this.prisma.audit_logs.findMany({
          distinct: ['tenant_id'],
          select: { tenant_id: true },
          take: 500
        });

        for (const { tenant_id: tenant_id } of (tenants as any[])) {
          // Verify last 200 records
          const result = await this.verifyChain(tenant_id); 
          if (!result.valid) {
            console.error(`[AUDIT_ELITE_CRITICAL] Chain corruption detected for tenant ${tenant_id}!`, result);
            this.metrics.chainVerificationFailures++;
          }
        }
      } catch (err) {
        console.error('[AuditService] Self-verification job failed:', err);
      }
    }, 600000); // 10 minutes
  }

  async log(params: AuditLogParams, injectedTx?: any) {
    const start_time = Date.now();
    const execute = async (tx: any) => {
      // 1. Fix 1: Transaction Isolation & Fix 2: Explicit Locking
      // Fetch last hash with FOR UPDATE to prevent race conditions in chain
      const lastLogs: any[] = await tx.$queryRaw`
        SELECT hash_chain FROM audit_logs 
        WHERE tenant_id = ${params.tenant_id} 
        ORDER BY created_at DESC 
        LIMIT 1 
        FOR UPDATE
      `;

      const previousHash = lastLogs.length > 0 ? lastLogs[0].hash_chain : 'GENESIS';

      // 2. Compute current hash (canonical — shared with verify/repair)
      const currentHash = this.computeChainHash(
        {
          tenant_id: params.tenant_id,
          user_id: params.user_id,
          action: params.action,
          entity_id: params.entity_id,
          correlation_id: params.correlation_id,
        },
        previousHash,
      );

      const result = await tx.audit_logs.create({
        data: {
          id: uuidv4(),
          updated_at: new Date(),
          tenant_id: params.tenant_id,
          user_id: params.user_id,
          module: params.module,
          action: params.action,
          entity_type: params.entity_type,
          entity_id: params.entity_id,
          metadata: params.metadata ?? {},
          changes: params.changes ?? {},
          before_state: params.before_state ?? undefined,
          after_state: params.after_state ?? undefined,
          source_module: params.module,
          ip_address: params.ip_address ?? undefined,
          user_agent: params.user_agent ?? undefined,
          device_model: params.device_model ?? undefined,
          severity: params.severity ?? 'INFO',
          idempotency_key: params.idempotency_key ?? undefined,
          correlation_id: params.correlation_id ?? undefined,
          event_reference_id: params.event_reference_id ?? undefined,
          hash_chain: currentHash,
          previous_hash: previousHash,
        },
      });

      // 3. Fix 5: Audit Anchoring (Every 100 records)
      const count = await tx.audit_logs.count({ where: { tenant_id: params.tenant_id } });
      if (count % 100 === 0) {
        const anchor = await tx.audit_hash_anchors.create({
          data: {
            id: uuidv4(),
            updated_at: new Date(),
            tenant_id: params.tenant_id,
            anchor_hash: currentHash,
            record_count: count,
            anchored_at: new Date(),
          },
        });
        
        // Step 2: External Anchor Publishing
        this.publishAnchorExternal(anchor);
        console.log(`[AuditService] Anchor recorded for tenant ${params.tenant_id} at record ${count}`);
      }

      // 4. Severity Model Escalation
      if (params.severity === 'CRITICAL') {
        console.error(`[AUDIT_CRITICAL] ${params.action} on ${params.entity_type}:${params.entity_id} by user ${params.user_id}`);
      }

      // Track Latency
      this.metrics.auditWriteLatency.push(Date.now() - start_time);
      if (this.metrics.auditWriteLatency.length > 1000) this.metrics.auditWriteLatency.shift();

      return result;
    };

    try {
      if (injectedTx) {
        return await execute(injectedTx);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        return await execute(tx);
      }, {
        isolationLevel: 'Serializable', // Fix 1: Isolation Guarantee
      });
    } catch (error: any) {
      this.metrics.auditFailureRate++;
      if (error.code === 'P2002') {
        console.warn(`[AuditService] Duplicate idempotency_key detected for ${params.idempotency_key}. Skipping.`);
        return null; 
      }

      console.error('[AuditService] Failed to create audit log:', error);
      return null;
    }
  }

  /**
   * Specialized logging for access to sensitive records (PII, Legal, Contracts).
   * Automatically escalates severity to WARN and flags in metadata.
   */
  async logSensitiveAccess(params: {
    tenant_id: string;
    user_id: string;
    module: string;
    entity_type: string;
    entity_id: string;
    metadata?: any;
  }) {
    return this.log({
      ...params,
      action: "SENSITIVE_ACCESS",
      severity: "WARN",
      metadata: {
        ...params.metadata,
        is_sensitive_access: true,
        access_timestamp: new Date().toISOString(),
      },
    });
  }


  async query(tenant_id: string, filters: AuditQueryDto) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where: any = { tenant_id };
    if (filters.module) where.module = filters.module;
    if (filters.action) where.action = filters.action;
    if (filters.user_id) where.user_id = filters.user_id;
    if (filters.entity_type) where.entity_type = filters.entity_type;
    if (filters.entity_id) where.entity_id = filters.entity_id;
    if (filters.severity) where.severity = filters.severity;

    if (filters.start_date || filters.end_date) {
      where.created_at = {};
      if (filters.start_date) where.created_at.gte = new Date(filters.start_date);
      if (filters.end_date) where.created_at.lte = new Date(filters.end_date);
    }

    const [data, total] = await Promise.all([
      this.prisma.audit_logs.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.audit_logs.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Query audit logs with standard paginated response envelope.
   */
  async queryPaginated(tenant_id: string, pagination: { page: number; pageSize: number }, filters: Omit<AuditQueryDto, 'page' | 'limit'> = {}) {
    const skip = (pagination.page - 1) * pagination.pageSize;

    const where: any = { tenant_id };
    if (filters.module) where.module = filters.module;
    if (filters.action) where.action = filters.action;
    if (filters.user_id) where.user_id = filters.user_id;
    if (filters.entity_type) where.entity_type = filters.entity_type;
    if (filters.entity_id) where.entity_id = filters.entity_id;
    if (filters.severity) where.severity = filters.severity;

    if (filters.start_date || filters.end_date) {
      where.created_at = {};
      if (filters.start_date) where.created_at.gte = new Date(filters.start_date);
      if (filters.end_date) where.created_at.lte = new Date(filters.end_date);
    }

    const [data, totalCount] = await Promise.all([
      this.prisma.audit_logs.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: pagination.pageSize,
      }),
      this.prisma.audit_logs.count({ where }),
    ]);

    return {
      data,
      totalCount,
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
    };
  }

  async getLogDetail(tenant_id: string, log_id: string) {
    const log = await this.prisma.audit_logs.findFirst({
      where: { id: log_id, tenant_id },
    });
    return log;
  }

  /**
   * Step 1: Audit Chain Verification API (Read-only)
   */
  async verifyChain(tenant_id: string, fromTimestamp?: Date) {
    const logs = await this.prisma.audit_logs.findMany({
      where: {
        tenant_id: tenant_id,
        created_at: fromTimestamp ? { gte: fromTimestamp } : undefined,
      },
      orderBy: { created_at: 'asc' },
      take: 10000
    });

    let lastHash = 'GENESIS';
    if (fromTimestamp) {
      const prevLog = await this.prisma.audit_logs.findFirst({
        where: { tenant_id: tenant_id, created_at: { lt: fromTimestamp } },
        orderBy: { created_at: 'desc' },
        select: { hash_chain: true },
      });
      lastHash = (prevLog as any)?.hash_chain || 'GENESIS';
    }

    let checkedRecords = 0;
    for (const log of logs) {
      checkedRecords++;
      const expectedPrevHash = lastHash;
      
      const recomputedHash = this.computeChainHash(
        {
          tenant_id: log.tenant_id,
          user_id: log.user_id,
          action: log.action,
          entity_id: log.entity_id,
          correlation_id: log.correlation_id,
        },
        expectedPrevHash,
      );

      if (log.previous_hash !== expectedPrevHash || log.hash_chain !== recomputedHash) {
        this.metrics.chainVerificationFailures++;
        return {
          valid: false,
          checkedRecords,
          firstInvalidRecord: {
            id: log.id,
            action: log.action,
            expectedPrevHash,
            actualPrevHash: log.previous_hash,
          },
          lastValidHash: expectedPrevHash,
        };
      }
      lastHash = log.hash_chain!;
    }

    return {
      valid: true,
      checkedRecords,
      lastValidHash: lastHash,
    };
  }

  /**
   * Step 2: External Anchor Publishing (Multi-Region Replication)
   */
  private publishAnchorExternal(anchor: any) {
    const entry = `${anchor.anchored_at.toISOString()} | ${anchor.tenant_id} | ${anchor.anchor_hash}\n`;
    
    // Primary local log
    try {
      fs.appendFileSync(this.anchorLogPath, entry);
    } catch (err) {
      console.error('[AuditService] Failed to publish anchor to primary storage:', err);
      this.metrics.anchorWriteFailures++;
    }

    // Secondary backup log (Simulated Replication)
    try {
      fs.appendFileSync(this.secondaryAnchorPath, entry);
    } catch (err) {
      console.error('[AuditService] Failed to replicate anchor to secondary storage:', err);
      this.metrics.anchorWriteFailures++;
    }
  }

  /**
   * Step 2: Public Anchor Publishing (Public Trust Layer)
   */
  async getPublicAnchors(limit: number = 20) {
    return this.prisma.audit_hash_anchors.findMany({
      orderBy: { anchored_at: 'desc' },
      take: limit,
      select: {
        tenant_id: true,
        anchor_hash: true,
        anchored_at: true,
        record_count: true,
      },
    });
  }

  /**
   * Get public anchors with standard paginated response envelope.
   */
  async getPublicAnchorsPaginated(pagination: { page: number; pageSize: number }) {
    const skip = (pagination.page - 1) * pagination.pageSize;

    const [data, totalCount] = await Promise.all([
      this.prisma.audit_hash_anchors.findMany({
        orderBy: { anchored_at: 'desc' },
        skip,
        take: pagination.pageSize,
        select: {
          tenant_id: true,
          anchor_hash: true,
          anchored_at: true,
          record_count: true,
        },
      }),
      this.prisma.audit_hash_anchors.count(),
    ]);

    return {
      data,
      totalCount,
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
    };
  }

  /**
   * Step 6: Lightweight Audit Write Metrics (p95)
   */
  getMetrics() {
    const latencies = [...this.metrics.auditWriteLatency].sort((a, b) => a - b);
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    
    // p95 calculation
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95Latency = latencies.length > 0 ? latencies[p95Index] : 0;

    return {
      ...this.metrics,
      avgWriteLatencyMs: avgLatency,
      p95WriteLatencyMs: p95Latency,
      timestamp: new Date().toISOString(),
    };
  }

  incrementRepairCount() {
    // Increment repair count in metrics
    (this.metrics as any).repairInvocationCount = ((this.metrics as any).repairInvocationCount || 0) + 1;
  }

  /**
   * Hardened Audit Chain Repair (Healer)
   * Recomputes the entire chain for a tenant based on existing record data.
   * Logs FULL repair metadata to dedicated audit_chain_repairs table.
   */
  async repairChain(params: {
    tenant_id: string;
    actor_id: string;
    reason: string;
    source_ip?: string;
    request_id?: string;
    permission_by?: string;
    permission_at?: Date;
  }) {
    const { tenant_id, actor_id, reason } = params;

    const logs = await this.prisma.audit_logs.findMany({
      where: { tenant_id },
      orderBy: { created_at: 'asc' },
      take: 10000
    });

    if (logs.length === 0) return { success: true, repairedCount: 0, totalRecords: 0 };

    // REQUIREMENT 1: Capture snapshot of affected records
    const snapshot = logs.map(l => ({
      id: l.id,
      h: l.hash_chain,
      ph: l.previous_hash
    }));

    const range_start_id = logs[0].id;
    const range_end_id = logs[logs.length - 1].id;
    const previousFinalHash = logs[logs.length - 1].hash_chain;

    let lastHash = 'GENESIS';
    let repairedCount = 0;

    await this.prisma.$transaction(async (tx: any) => {
      // REQUIREMENT 2: Persist Repair Signature BEFORE repair starts
      await tx.audit_chain_repairs.create({
        data: {
          id: uuidv4(),
          tenant_id,
          actor_id,
          previous_hash: previousFinalHash || 'UNKNOWN',
          new_hash: 'REPAIR_IN_PROGRESS', // Will be updated if possible or implied by logs
          reason,
          source_ip: params.source_ip,
          request_id: params.request_id,
          permission_by: params.permission_by,
          permission_at: params.permission_at,
          snapshot_json: snapshot,
          range_start_id,
          range_end_id,
          created_at: new Date(),
        },
      });

      for (const log of logs) {
        const newHash = this.computeChainHash(
          {
            tenant_id: log.tenant_id,
            user_id: log.user_id,
            action: log.action,
            entity_id: log.entity_id,
            correlation_id: log.correlation_id,
          },
          lastHash,
        );

        if (log.hash_chain !== newHash || log.previous_hash !== lastHash) {
          await tx.audit_logs.update({
            where: { id: log.id },
            data: {
              hash_chain: newHash,
              previous_hash: lastHash,
              updated_at: new Date(),
            },
          });
          repairedCount++;
        }
        lastHash = newHash;
      }

      // Log critical audit entry for the repair itself
      await this.log({
        tenant_id,
        user_id: actor_id,
        module: 'SYSTEM',
        action: 'AUDIT_CHAIN_REPAIR',
        entity_type: 'AUDIT_LOG',
        entity_id: 'CHAIN',
        severity: 'CRITICAL',
        metadata: {
          repaired_records: repairedCount,
          total_records: logs.length,
          reason,
          request_id: params.request_id,
        },
      }, tx);
    });

    this.incrementRepairCount();
    return { success: true, repairedCount, totalRecords: logs.length, newFinalHash: lastHash };
  }
}
