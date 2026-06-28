import { v4 as uuidv4 } from 'uuid';
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../persistence/prisma.service';
import { validateEventPayload } from './event.registry';

export interface DomainEvent {
  event_type: string;
  tenant_id: string;
  entity_id: string;
  entity_type: string;
  source_module: string;
  payload: any;
  user_id?: string;
  correlation_id?: string;
  idempotency_key?: string;
  aggregate_id?: string;
  event_reference_id?: string;
  status?: string;
  processing_started_at?: Date;
  version?: number;
  created_at?: Date;
  id?: string;
  tx?: Prisma.TransactionClient;
}

export interface EventSubscription {
  event_type: string;
  handlerName: string;
  callback: (event: DomainEvent) => Promise<void> | void;
}

@Injectable()
export class EventBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private subscriptions: EventSubscription[] = [];
  private workerInterval: any;
  private readonly isDebugMode = process.env.EVENT_DEBUG_MODE === 'true';

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Start retry worker (sweeper)
    this.workerInterval = setInterval(() => this.sweepPendingEvents(), 10000); // 10s sweep
  }

  onModuleDestroy() {
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
    }
  }

  /**
   * Worker method to process pending/failed events.
   * Enforces sequential execution order per aggregate_id.
   */
  private async sweepPendingEvents() {
    try {
      const now = new Date();
      // Find deliveries that are PENDING or (FAILED and ready to retry)
      const pendingDeliveries = await this.prisma.event_deliveries.findMany({
        where: {
          OR: [
            { status: 'PENDING' },
            { 
              status: 'FAILED', 
              attempts: { lt: 5 },
              next_retry_at: { lte: now } 
            }
          ]
        },
        take: 100, // Process in batches
        include: { domain_events: true }, // Include DomainEvent to read aggregate_id
        orderBy: { created_at: 'asc' } // Preserve strict chronological ordering
      });

      // Group by aggregate_id (or NULL) to enforce strict sequential processing per-aggregate
      const aggregateGroups = new Map<string, typeof pendingDeliveries>();
      for (const d of pendingDeliveries as any[]) {
        const key = d.event_id.aggregate_id || `NO_AGGREGATE_${d.id}`; // If no aggregate, they run freely
        if (!aggregateGroups.has(key)) aggregateGroups.set(key, []);
        aggregateGroups.get(key)!.push(d);
      }

      // Process aggregates concurrently, but within the SAME aggregate, sequentially
      await Promise.all(
        Array.from(aggregateGroups.entries() as any).map(async ([_groupKey, groupDeliveries]: [any, any[]]) => {
          for (const delivery of groupDeliveries) {
            const sub = this.subscriptions.find(s => s.handlerName === delivery.handler_name);
            if (!sub) continue; 
            await this.executeHandler(delivery.domain_events.id, delivery.domain_events as any, sub);
          }
        })
      );

      // --- NEW: Stuck Event Recovery ---
      const timeoutThreshold = new Date(Date.now() - 60000); // 60 seconds
      const stuckEvents = await this.prisma.domain_events.findMany({
        where: {
          status: 'PROCESSING',
          processing_started_at: { lt: timeoutThreshold }
        },
        include: { event_deliveries: true },
        take: 100
      });

      for (const event of stuckEvents) {
        this.logger.warn(`Recovering stuck event ${event.id} (stuck in PROCESSING since ${event.processing_started_at})`);
        // We move it to FAILED to allow the standard retry logic to pick up the deliveries
        await this.prisma.$transaction(async (tx: any) => {
          await tx.domain_events.update({
            where: { id: event.id },
            data: { status: 'FAILED' }
          });
          // Also fail any deliveries that are still in PROCESSING for this event
          await tx.event_deliveries.updateMany({
            where: { event_id: event.id, status: 'PROCESSING', tenant_id: event.tenant_id },
            data: { status: 'FAILED', last_error: 'PROCESSING_TIMEOUT_RECOVERY' }
          });
        });
      }

    } catch (err) {
      this.logger.error(`SWEEP_FAILED: ${err.message}`);
      this.logTrace('SWEEP_FAILED', { event_type: 'SYSTEM_SWEEP', tenant_id: 'SYSTEM' } as any, 'SYSTEM', undefined, { error: err.message });
    }
  }

  /**
   * Structured JSON Logger for full platform traceability.
   */
  private logTrace(status: string, event: DomainEvent, actor: string, durationMs?: number, metadata?: any) {
    const trace = {
      timestamp: new Date().toISOString(),
      status,
      eventId: event.id || 'N/A',
      event_type: event.event_type,
      correlation_id: event.correlation_id || 'N/A',
      aggregate_id: event.aggregate_id || 'N/A',
      tenant_id: event.tenant_id,
      actor,
      durationMs,
      ...metadata,
    };

    if (this.isDebugMode) {
      trace.payload = event.payload;
    }

    this.logger.log(`[EVENT_TRACE] ${JSON.stringify(trace)}`);
  }

  /**
   * Subscribe to specific domain events.
   * @param event_type type of event to listen to (e.g. 'PO_RECEIVED')
   * @param handlerName unique identifier for this listener (for idempotency and retries)
   * @param callback function to execute
   */
  subscribe(event_type: string, handlerName: string, callback: (event: DomainEvent) => Promise<void> | void) {
    this.subscriptions.push({ event_type, handlerName, callback });
    this.logger.log(`Registered listener [${handlerName}] for event [${event_type}]`);
    return () => {
      this.subscriptions = this.subscriptions.filter(s => s.handlerName !== handlerName);
    };
  }

  /**
   * Publish a domain event using the Outbox pattern.
   * Persists to DomainEvent and prepares EventDelivery records atomically.
   */
  async publish(event: DomainEvent, injectedTx?: Prisma.TransactionClient) {
    // 0. Default trace fields
    event.correlation_id = event.correlation_id || `corr_${Math.random().toString(36).substr(2, 9)}`;
    event.idempotency_key = event.idempotency_key || `idem_${Math.random().toString(36).substr(2, 9)}`;

    this.logTrace('PUBLISH_STARTED', event, event.source_module);

    try {
      // 0. Validate Schema Contract
      validateEventPayload(event.event_type, event.version ?? 1, event.payload);

      const matchingSubs = this.subscriptions.filter(s => s.event_type === event.event_type || s.event_type === '*');

      const execute = async (tx: any) => {
        // 1. Check idempotency if a key was provided
        if (event.idempotency_key) {
          const existing = await tx.domain_events.findUnique({
            where: {
              tenant_id_idempotency_key: {
                tenant_id: event.tenant_id,
                idempotency_key: event.idempotency_key,
              }
            }
          });
          if (existing) {
            this.logTrace('PUBLISH_SKIPPED_IDEMPOTENT', event, event.source_module);
            return existing;
          }
        }

        // 2. Persist event to the Event Store
        const domainEventRecord = await tx.domain_events.create({
          data: {
        id: uuidv4(),
        updated_at: new Date(),
            tenant_id: event.tenant_id,
            event_type: event.event_type,
            source_module: event.source_module,
            entity_type: event.entity_type,
            entity_id: event.entity_id,
            payload: event.payload as any,
            user_id: event.user_id ?? null,
            idempotency_key: event.idempotency_key ?? null,
            correlation_id: event.correlation_id ?? null,
            aggregate_id: event.aggregate_id ?? null,
            event_reference_id: event.event_reference_id ?? null,
            status: 'PENDING',
            version: event.version ?? 1,
          },
        });

        // 3. Create EventDelivery rows for all matched subscriptions
        if (matchingSubs.length > 0) {
          await tx.event_deliveries.createMany({
            data: matchingSubs.map(sub => ({
              tenant_id: event.tenant_id,
              event_id: domainEventRecord.id,
              handler_name: sub.handlerName,
              status: 'PENDING',
              attempts: 0,
            })),
            skipDuplicates: true,
          });
        }

        return domainEventRecord;
      };

      // We perform DomainEvent insertion and EventDelivery tracking in one transaction
      const record = injectedTx 
        ? await execute(injectedTx)
        : await this.prisma.$transaction(async (tx: any) => await execute(tx));

      // 4. Attach generated ID for immediate listener execution wrapper
      (event as any).id = record.id;
      
      // Fire execution asynchronously without awaiting its complete retry cycle
      if (matchingSubs.length > 0) {
        this.processEventDeliveries(record.id, event, matchingSubs).catch(err => {
          this.logTrace('INITIAL_DELIVERY_TRIGGER_FAILED', record as any, 'SYSTEM', undefined, { error: err.message });
        });
      }

      return record;
    } catch (error) {
      this.logTrace('PUBLISH_FAILED', event, event.source_module, undefined, { error: error.message });
      throw error;
    }
  }

  /**
   * Immediately attempts execution of an event for its listeners
   */
  private async processEventDeliveries(eventId: string, event: DomainEvent, subscriptions: EventSubscription[]) {
    // Process sequentially by aggregate if they share the identical event
    for (const sub of subscriptions) {
      await this.executeHandler(eventId, event, sub);
    }
  }

  /**
   * Wraps handler execution with atomic status updates, retry tracking, and exponential backoff.
   * Executes business logic inside an active Prisma $transaction.
   */
  async executeHandler(eventId: string, event: DomainEvent, sub: EventSubscription) {
    let delivery: any = null;
    let start_time = Date.now();

    try {
      // 1. Lock delivery
      delivery = await this.prisma.event_deliveries.update({
        where: {
          tenant_id_event_id_handler_name: { tenant_id: event.tenant_id, event_id: eventId, handler_name: sub.handlerName }
        },
        data: { status: 'PROCESSING' }
      });

      // 2. Mark parent DomainEvent as PROCESSING
      await this.prisma.domain_events.update({
        where: { id: eventId },
        data: { status: 'PROCESSING', processing_started_at: new Date() }
      });

      start_time = Date.now();

      // 3. Open a dedicated TX Wrapper for execution atomicity
      // 2. Start trace
      this.logTrace('HANDLER_STARTED', event, sub.handlerName);

      try {
        // 3. Mark processing started to allow recovery from stuck states
        await this.prisma.domain_events.update({
          where: { id: eventId },
          data: { status: 'PROCESSING', processing_started_at: new Date() }
        });

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('HANDLER_TIMEOUT')), 30000)
        );

        await Promise.race([
          this.prisma.$transaction(async (tx: any) => {
            const transactionalEvent: DomainEvent = { ...event, tx };
            await sub.callback(transactionalEvent);
            await tx.event_deliveries.update({
              where: { id: delivery.id },
              data: { status: 'PROCESSED', updated_at: new Date() }
            });
          }, { timeout: 15000 }),
          timeoutPromise
        ]);

        const durationMs = Date.now() - start_time;
        this.logTrace('HANDLER_SUCCESS', event, sub.handlerName, durationMs, { retryCount: delivery.attempts });
        
        // 4. Evaluate and collapse parent state 
        await this.resolveDomainEventIfComplete(eventId);

      } catch (innerError) {
        throw innerError; // Rethrow to be caught by the outer catch
      }

    } catch (error) {
      const durationMs = Date.now() - start_time;
      const retryAttempts = delivery?.attempts ?? 0;
      this.logTrace('HANDLER_FAILED', event, sub.handlerName, durationMs, { retryCount: retryAttempts, error: error.message });
      
      // Failure / Retry logic
      this.logger.error(`Error in event listener [${sub.handlerName}]: ${error.message}`);
      
      const currentDelivery = await this.prisma.event_deliveries.findUnique({
        where: { tenant_id_event_id_handler_name: { tenant_id: event.tenant_id, event_id: eventId, handler_name: sub.handlerName } }
      });

      if (currentDelivery) {
        const newAttempts = currentDelivery.attempts + 1;
        const maxRetries = 5;
        
        if (newAttempts >= maxRetries) {
          // Dead Letter Queue
          await this.prisma.event_deliveries.update({
            where: { id: currentDelivery.id },
            data: { status: 'DLQ', attempts: newAttempts, last_error: error.message, updated_at: new Date() }
          });
          // Also mark parent parent FAILED permanently 
          await this.prisma.domain_events.update({ where: { id: eventId }, data: { status: 'FAILED' }});
          this.logger.error(`Event ${eventId} for [${sub.handlerName}] moved to DEAD LETTER QUEUE (DLQ).`);

          // Emit internal failure event for Workflow Engine
          await this.publish({
            tenant_id: event.tenant_id,
            event_type: 'WORKFLOW_STEP_FAILED',
            entity_id: eventId,
            entity_type: 'EVENT_DELIVERY',
            source_module: 'EVENT_BUS',
            payload: {
              originalEventType: event.event_type,
              handlerName: sub.handlerName,
              error: error.message,
              correlation_id: event.correlation_id,
            },
            correlation_id: event.correlation_id || 'root',
          });
        } else {
          // Retry with exponential backoff (2^attempts * 5 seconds)
          const backoffSeconds = Math.pow(2, newAttempts) * 5;
          const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000);
          
          await this.prisma.event_deliveries.update({
            where: { id: delivery.id },
            data: { status: 'FAILED', attempts: newAttempts, last_error: error.message, next_retry_at: nextRetryAt, updated_at: new Date() }
          });
          this.logger.warn(`Event ${eventId} for [${sub.handlerName}] failed. Retry ${newAttempts}/${maxRetries} scheduled at ${nextRetryAt.toISOString()}`);
        }
      }
    }
  }

  /**
   * If all listeners successfully process, mark overall status PROCESSED.
   */
  private async resolveDomainEventIfComplete(eventId: string) {
    const remainingDeliveries = await this.prisma.event_deliveries.count({
      where: { event_id: eventId, status: { not: 'PROCESSED' } }
    });
    if (remainingDeliveries === 0) {
      await this.prisma.domain_events.update({
        where: { id: eventId },
        data: { status: 'PROCESSED' }
      });
    }
  }

  /**
   * GET_STUCK_EVENTS_COUNT
   * Identify events that are effectively orphans or deadlocked in PROCESSING
   */
  async getStuckEventsCount(tenant_id: string) {
    const timeoutThreshold = new Date(Date.now() - 60000); // 60 seconds
    const processing = await this.prisma.domain_events.count({
      where: { 
        tenant_id, 
        status: 'PROCESSING',
        processing_started_at: { lt: timeoutThreshold }
      }
    });
    const failed = await this.prisma.domain_events.count({
      where: { tenant_id, status: 'FAILED' }
    });
    return { processing, failed };
  }

  /**
   * Safe replay capability for failed events.
   * Enforces tenant isolation.
   */
  async replayEvent(tenant_id: string, eventId: string, force: boolean = false) {
    const event = await this.prisma.domain_events.findUnique({ 
      where: { id: eventId, tenant_id } 
    });
    if (!event) throw new Error(`Event ${eventId} not found for tenant ${tenant_id}`);

    if (event.status === 'PROCESSED' && !force) {
      this.logger.warn(`Event ${eventId} is already PROCESSED. Skipping replay unless forced.`);
      return;
    }

    this.logger.log(`Replaying event ${eventId} (${event.event_type})`);

    await this.prisma.$transaction(async (tx: any) => {
      // 1. Reset parent status
      await tx.domain_events.update({
        where: { id: eventId },
        data: { status: 'PENDING', processing_started_at: null }
      });

      // 2. Reset all deliveries to PENDING
      await tx.event_deliveries.updateMany({
        where: { event_id: eventId },
        data: { status: 'PENDING', attempts: 0, last_error: null, next_retry_at: null }
      });
    });
  }

  /**
   * Visibility: Query failed events (DLQ) for a specific tenant.
   */
  async getFailedSnapshot(tenant_id: string) {
    return this.prisma.domain_events.findMany({
      where: { tenant_id, status: 'FAILED' },
      include: { event_deliveries: { where: { status: 'DLQ' } } },
      orderBy: { created_at: 'desc' },
      take: 50
    });
  }

  /**
   * Visibility: Query deliveries for an event
   */
  async getEventDeliveries(eventId: string) {
    return this.prisma.event_deliveries.findMany({
      where: { event_id: eventId },
      orderBy: { created_at: 'asc' },
      take: 200
    });
  }

  // PLATFORM INSPECTION HELPERS
  async getEventChain(correlation_id: string) {
    const events = await this.prisma.domain_events.findMany({
      where: { correlation_id: correlation_id },
      include: { event_deliveries: true },
      orderBy: { created_at: 'asc' }
    });

    return events.map((e: any) => ({
      eventId: e.id,
      event_type: e.event_type,
      status: e.status,
      created_at: e.created_at,
      deliveries: e.event_deliveries.map((d: any) => ({
        handler: d.handler_name,
        status: d.status,
        attempts: d.attempts,
        last_error: d.last_error
      }))
    }));
  }
}
