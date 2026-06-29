import type { ConnectivityConfig, ConnectivityStatus, SyncResult, SyncError } from './types';

/**
 * Offline store dependency interface — subset of IOfflineStore needed by the monitor.
 */
export interface OfflineStoreDependency {
  getBatch(limit: number): Promise<any[]>;
  markStatus(ids: string[], status: string): Promise<void>;
  getPendingCount(): Promise<number>;
  purgeAcknowledged(before: Date): Promise<number>;
}

/**
 * Sync endpoint function signature.
 * Accepts a batch of operations and returns the sync result.
 */
export type SyncEndpointFn = (batch: any[]) => Promise<SyncResult>;

/**
 * Public interface for the Connectivity Monitor service.
 */
export interface IConnectivityMonitor {
  initialize(config: ConnectivityConfig): void;
  start(): void;
  stop(): void;
  getStatus(): ConnectivityStatus;
  getPendingCount(): number;
  triggerSync(): Promise<SyncResult>;
  onStatusChange(callback: (status: ConnectivityStatus) => void): void;
  onSyncComplete(callback: (result: SyncResult) => void): void;
  onSyncError(callback: (error: SyncError) => void): void;
}

/**
 * Exponential backoff delays for sync retries: 5s, 10s, 20s.
 */
const BACKOFF_DELAYS_MS = [5000, 10000, 20000];

/**
 * Time window (ms) to initiate sync after connectivity is restored.
 */
const SYNC_RESTORE_DELAY_MS = 5000;

/**
 * Number of consecutive heartbeat failures required to declare offline.
 */
const OFFLINE_THRESHOLD = 2;

/**
 * Maximum consecutive sync retries before a batch is marked as permanently failed.
 */
const MAX_CONSECUTIVE_SYNC_RETRIES = 5;

/**
 * Retention period for acknowledged operations (7 days in ms).
 */
const ACKNOWLEDGED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * ConnectivityMonitorService implements a dual-signal state machine
 * (Navigator.onLine + heartbeat) with batch sync orchestration.
 */
export class ConnectivityMonitorService implements IConnectivityMonitor {
  private config: ConnectivityConfig | null = null;
  private status: ConnectivityStatus = 'offline';
  private pendingCount: number = 0;
  private navigatorOnline: boolean = false;
  private consecutiveHeartbeatFailures: number = 0;
  private consecutiveSyncRetries: number = 0;
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private syncTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private purgeIntervalId: ReturnType<typeof setInterval> | null = null;
  private statusChangeCallbacks: Array<(status: ConnectivityStatus) => void> = [];
  private syncCompleteCallbacks: Array<(result: SyncResult) => void> = [];
  private syncErrorCallbacks: Array<(error: SyncError) => void> = [];
  private isRunning: boolean = false;
  private isSyncing: boolean = false;

  // Dependencies
  private offlineStore: OfflineStoreDependency | null = null;
  private syncEndpoint: SyncEndpointFn | null = null;

  /**
   * Set the offline store dependency for batch retrieval and status updates.
   */
  setOfflineStore(store: OfflineStoreDependency): void {
    this.offlineStore = store;
  }

  /**
   * Set the sync endpoint function for uploading batches.
   */
  setSyncEndpoint(endpoint: SyncEndpointFn): void {
    this.syncEndpoint = endpoint;
  }

  /**
   * Initialize the monitor with the given configuration.
   * Validates heartbeat interval is within allowed range (5000-60000ms).
   */
  initialize(config: ConnectivityConfig): void {
    const heartbeatInterval = Math.max(5000, Math.min(60000, config.heartbeatInterval));
    this.config = { ...config, heartbeatInterval };
    this.navigatorOnline = this.getNavigatorOnline();
  }

  /**
   * Start the connectivity monitor: register browser events and begin heartbeat polling.
   */
  start(): void {
    if (!this.config) {
      throw new Error('ConnectivityMonitorService must be initialized before starting.');
    }

    this.isRunning = true;
    this.navigatorOnline = this.getNavigatorOnline();

    // Register browser online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnlineEvent);
      window.addEventListener('offline', this.handleOfflineEvent);
    }

    // Start heartbeat polling
    this.startHeartbeat();

    // Perform initial heartbeat to determine starting state
    this.performHeartbeatCheck();
  }

  /**
   * Stop the connectivity monitor: clear all intervals, timeouts, and event listeners.
   */
  stop(): void {
    this.isRunning = false;

    if (this.heartbeatIntervalId !== null) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }

    if (this.syncTimeoutId !== null) {
      clearTimeout(this.syncTimeoutId);
      this.syncTimeoutId = null;
    }

    if (this.purgeIntervalId !== null) {
      clearInterval(this.purgeIntervalId);
      this.purgeIntervalId = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnlineEvent);
      window.removeEventListener('offline', this.handleOfflineEvent);
    }
  }

  /**
   * Get the current connectivity status.
   */
  getStatus(): ConnectivityStatus {
    return this.status;
  }

  /**
   * Get the current count of pending (unsynced) operations.
   */
  getPendingCount(): number {
    return this.pendingCount;
  }

  /**
   * Trigger a manual sync cycle. Returns the result of the sync attempt.
   */
  async triggerSync(): Promise<SyncResult> {
    if (!this.offlineStore || !this.syncEndpoint || !this.config) {
      return { success: false, acknowledged: 0, failed: 0, errors: [] };
    }

    if (this.isSyncing) {
      return { success: false, acknowledged: 0, failed: 0, errors: [] };
    }

    this.isSyncing = true;
    this.setStatus('syncing');

    try {
      const result = await this.executeSyncBatch();
      return result;
    } finally {
      this.isSyncing = false;
      await this.updatePendingCount();
      this.resolveIdleStatus();
    }
  }

  /**
   * Register a callback for connectivity status changes.
   */
  onStatusChange(callback: (status: ConnectivityStatus) => void): void {
    this.statusChangeCallbacks.push(callback);
  }

  /**
   * Register a callback for successful sync completions.
   */
  onSyncComplete(callback: (result: SyncResult) => void): void {
    this.syncCompleteCallbacks.push(callback);
  }

  /**
   * Register a callback for sync errors.
   */
  onSyncError(callback: (error: SyncError) => void): void {
    this.syncErrorCallbacks.push(callback);
  }

  // ─── Private: Navigator.onLine access (override in tests) ────────────────────

  /**
   * Access Navigator.onLine via a getter that can be overridden in tests.
   */
  protected getNavigatorOnline(): boolean {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return false;
  }

  // ─── Private: Browser event handlers ─────────────────────────────────────────

  private handleOnlineEvent = (): void => {
    this.navigatorOnline = true;
    // Navigator says online, but we still need a successful heartbeat to declare ONLINE
    this.performHeartbeatCheck();
  };

  private handleOfflineEvent = (): void => {
    this.navigatorOnline = false;
    // Navigator offline alone doesn't trigger state change immediately;
    // the heartbeat will eventually fail and declare offline after threshold.
    // However, if we already have enough failures, transition now.
    if (this.consecutiveHeartbeatFailures >= OFFLINE_THRESHOLD) {
      this.setStatus('offline');
    }
  };

  // ─── Private: Heartbeat ──────────────────────────────────────────────────────

  private startHeartbeat(): void {
    if (this.heartbeatIntervalId !== null) {
      clearInterval(this.heartbeatIntervalId);
    }
    this.heartbeatIntervalId = setInterval(
      () => this.performHeartbeatCheck(),
      this.config!.heartbeatInterval
    );
  }

  private async performHeartbeatCheck(): Promise<void> {
    const success = await this.performHeartbeat();

    if (success) {
      this.consecutiveHeartbeatFailures = 0;
      this.handleConnectivityRestored();
    } else {
      this.consecutiveHeartbeatFailures++;
      if (this.consecutiveHeartbeatFailures >= OFFLINE_THRESHOLD) {
        this.setStatus('offline');
      }
    }
  }

  /**
   * Perform a single heartbeat check using fetch with AbortController for timeout.
   */
  private async performHeartbeat(): Promise<boolean> {
    if (!this.config) return false;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.heartbeatTimeout);

    try {
      const response = await fetch(this.config.heartbeatUrl, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);
      return response.ok;
    } catch {
      clearTimeout(timeout);
      return false;
    }
  }

  // ─── Private: Connectivity state transitions ─────────────────────────────────

  /**
   * Called when a heartbeat succeeds. Declares ONLINE only when
   * BOTH Navigator.onLine === true AND heartbeat succeeded.
   */
  private handleConnectivityRestored(): void {
    if (!this.navigatorOnline) {
      // Heartbeat succeeded but Navigator says offline — don't declare online
      return;
    }

    const wasOffline = this.status === 'offline';
    this.resolveIdleStatus();

    // Schedule sync within 5 seconds of restoration
    if (wasOffline && this.isRunning) {
      this.scheduleSyncAfterRestore();
    }
  }

  /**
   * Determine the correct idle status based on pending operations.
   */
  private resolveIdleStatus(): void {
    if (this.consecutiveHeartbeatFailures >= OFFLINE_THRESHOLD) {
      this.setStatus('offline');
    } else if (!this.navigatorOnline) {
      // Cannot declare online without navigator agreement
      return;
    } else if (this.isSyncing) {
      this.setStatus('syncing');
    } else if (this.pendingCount > 0) {
      this.setStatus('pending');
    } else {
      this.setStatus('online');
    }
  }

  // ─── Private: Status management ─────────────────────────────────────────────

  private setStatus(newStatus: ConnectivityStatus): void {
    if (this.status === newStatus) return;
    this.status = newStatus;
    this.notifyStatusChange(newStatus);
  }

  private notifyStatusChange(status: ConnectivityStatus): void {
    for (const callback of this.statusChangeCallbacks) {
      try {
        callback(status);
      } catch {
        // Swallow callback errors to prevent cascading failures
      }
    }
  }

  private notifySyncComplete(result: SyncResult): void {
    for (const callback of this.syncCompleteCallbacks) {
      try {
        callback(result);
      } catch {
        // Swallow callback errors
      }
    }
  }

  private notifySyncError(error: SyncError): void {
    for (const callback of this.syncErrorCallbacks) {
      try {
        callback(error);
      } catch {
        // Swallow callback errors
      }
    }
  }

  // ─── Private: Sync orchestration ────────────────────────────────────────────

  /**
   * Schedule a sync attempt within 5 seconds of connectivity restoration.
   */
  private scheduleSyncAfterRestore(): void {
    if (this.syncTimeoutId !== null) {
      clearTimeout(this.syncTimeoutId);
    }
    this.syncTimeoutId = setTimeout(() => {
      this.syncTimeoutId = null;
      if (this.isRunning && this.status !== 'offline') {
        this.triggerSync();
      }
    }, SYNC_RESTORE_DELAY_MS);
  }

  /**
   * Execute a single sync batch: fetch pending ops, upload, handle result.
   */
  private async executeSyncBatch(): Promise<SyncResult> {
    if (!this.offlineStore || !this.syncEndpoint || !this.config) {
      return { success: false, acknowledged: 0, failed: 0, errors: [] };
    }

    const batch = await this.offlineStore.getBatch(this.config.batchSize);

    if (batch.length === 0) {
      const result: SyncResult = { success: true, acknowledged: 0, failed: 0, errors: [] };
      this.consecutiveSyncRetries = 0;
      this.notifySyncComplete(result);
      return result;
    }

    const batchIds = batch.map((op: any) => op.id);

    // Mark batch as in-flight
    await this.offlineStore.markStatus(batchIds, 'in-flight');

    try {
      const result = await this.syncEndpoint(batch);

      if (result.success) {
        // Mark acknowledged
        await this.offlineStore.markStatus(batchIds, 'acknowledged');
        this.consecutiveSyncRetries = 0;
        this.notifySyncComplete(result);

        // Purge old acknowledged operations (older than 7 days)
        await this.purgeOldAcknowledged();

        return result;
      } else {
        // Partial or full failure
        return await this.handleSyncFailure(batchIds, result);
      }
    } catch (error) {
      // Network or unexpected error — treat as total batch failure
      const syncResult: SyncResult = {
        success: false,
        acknowledged: 0,
        failed: batch.length,
        errors: [],
      };
      return await this.handleSyncFailure(batchIds, syncResult);
    }
  }

  /**
   * Handle a failed sync attempt with exponential backoff retry logic.
   * - Retries with backoff: 5s, 10s, 20s
   * - After 5 consecutive retries, marks batch as failed and excludes from auto-sync
   */
  private async handleSyncFailure(batchIds: string[], result: SyncResult): Promise<SyncResult> {
    this.consecutiveSyncRetries++;

    // Notify errors
    for (const error of result.errors) {
      this.notifySyncError(error);
    }

    if (this.consecutiveSyncRetries >= MAX_CONSECUTIVE_SYNC_RETRIES) {
      // Mark batch as permanently failed, exclude from auto-sync
      if (this.offlineStore) {
        await this.offlineStore.markStatus(batchIds, 'failed');
      }
      this.consecutiveSyncRetries = 0;
      this.notifySyncComplete(result);
      return result;
    }

    // Reset operations to 'pending' for retry (mid-batch interruption recovery)
    if (this.offlineStore) {
      await this.offlineStore.markStatus(batchIds, 'pending');
    }

    // Retry with exponential backoff if still running and within max retries per config
    if (this.isRunning && this.status !== 'offline' && this.consecutiveSyncRetries <= this.config!.maxRetries) {
      const delayIndex = Math.min(this.consecutiveSyncRetries - 1, BACKOFF_DELAYS_MS.length - 1);
      const delay = BACKOFF_DELAYS_MS[delayIndex];

      await this.sleep(delay);

      // Check if still valid to retry
      if (this.isRunning && this.status !== 'offline') {
        return await this.executeSyncBatch();
      }
    }

    this.notifySyncComplete(result);
    return result;
  }

  /**
   * Purge acknowledged operations older than 7 days.
   */
  private async purgeOldAcknowledged(): Promise<void> {
    if (!this.offlineStore) return;

    const cutoffDate = new Date(Date.now() - ACKNOWLEDGED_RETENTION_MS);
    try {
      await this.offlineStore.purgeAcknowledged(cutoffDate);
    } catch {
      // Non-critical: silently ignore purge failures
    }
  }

  /**
   * Update the internal pending count from the offline store.
   */
  private async updatePendingCount(): Promise<void> {
    if (!this.offlineStore) return;

    try {
      this.pendingCount = await this.offlineStore.getPendingCount();
    } catch {
      // Non-critical: keep existing count
    }
  }

  // ─── Private: Utilities ──────────────────────────────────────────────────────

  /**
   * Promise-based sleep utility.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
