import type {
  OperationEnvelope,
  EnvelopeStatus,
  OfflineStoreConfig,
  IntegrityReport,
  CacheReadResult,
  CacheMetadata,
  DeltaSyncOptions,
  DeltaSyncResult,
} from './types';

/**
 * Database schema version. Increment when object stores or indexes change.
 */
const DB_VERSION = 1;

/**
 * Prefix for all tenant-scoped IndexedDB databases.
 */
const DB_NAME_PREFIX = 'zenvix_offline_';

/**
 * IOfflineStore — public interface for the Offline Store service.
 */
export interface IOfflineStore {
  // Queue operations
  enqueue(
    operation: Omit<OperationEnvelope, 'id' | 'sequenceNumber' | 'status' | 'createdAt'>
  ): Promise<OperationEnvelope>;
  getBatch(limit: number): Promise<OperationEnvelope[]>;
  markStatus(ids: string[], status: EnvelopeStatus): Promise<void>;
  getPendingCount(): Promise<number>;

  // Read cache
  getProduct(productId: string): Promise<CacheReadResult>;
  getPrice(productId: string): Promise<CacheReadResult>;
  getCustomer(customerId: string): Promise<CacheReadResult>;
  updateCache(entity: string, records: Record<string, unknown>[]): Promise<void>;

  // Delta sync and cache management
  deltaSync(options: DeltaSyncOptions): Promise<DeltaSyncResult>;
  getCacheMetadata(key: string): Promise<CacheMetadata | null>;
  setCacheMetadata(key: string, value: unknown): Promise<void>;
  isCacheStale(): Promise<boolean>;
  getCacheAge(): Promise<{ isStale: boolean; lastSyncTimestamp: string | null; ageMs: number | null }>;

  // Lifecycle
  initialize(config: OfflineStoreConfig): Promise<void>;
  verifyIntegrity(): Promise<IntegrityReport>;
  purgeAcknowledged(beforeDate: Date): Promise<number>;
  close(): Promise<void>;
}

/**
 * OfflineStoreService — manages local persistence via IndexedDB, scoped per tenant.
 *
 * Responsibilities:
 * - Database initialization with tenant-scoped naming
 * - Object store and index creation
 * - Tenant switch handling (close previous, open new)
 * - Lifecycle methods (initialize / close)
 * - Operation enqueueing with monotonic sequence numbers
 * - Batch retrieval, status marking, and pending count
 */
export class OfflineStoreService implements IOfflineStore {
  private db: IDBDatabase | null = null;
  private config: OfflineStoreConfig | null = null;
  /** In-memory monotonic sequence counter for this session. Reset on initialize. */
  private sessionSequenceCounter: number = 0;

  /**
   * Returns the current database instance.
   * Throws if the store has not been initialized.
   */
  getDb(): IDBDatabase {
    if (!this.db) {
      throw new Error('OfflineStore not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Returns the current config.
   * Throws if the store has not been initialized.
   */
  getConfig(): OfflineStoreConfig {
    if (!this.config) {
      throw new Error('OfflineStore not initialized. Call initialize() first.');
    }
    return this.config;
  }

  /**
   * Builds the tenant-scoped database name.
   */
  private getDatabaseName(tenantId: string): string {
    return `${DB_NAME_PREFIX}${tenantId}`;
  }

  /**
   * Initialize the offline store for the given tenant configuration.
   * If a different tenant's DB is currently open, it will be closed first (tenant switch).
   */
  async initialize(config: OfflineStoreConfig): Promise<void> {
    // Validate offline_tolerance_threshold range (100–2000)
    if (
      config.offlineToleranceThreshold < 100 ||
      config.offlineToleranceThreshold > 2000
    ) {
      throw new Error(
        `offlineToleranceThreshold must be between 100 and 2000, got ${config.offlineToleranceThreshold}`
      );
    }

    // Handle tenant switch — close previous DB if open for a different tenant
    if (this.db && this.config && this.config.tenantId !== config.tenantId) {
      await this.close();
    }

    // If already initialized for the same tenant, skip re-opening
    if (this.db && this.config && this.config.tenantId === config.tenantId) {
      this.config = config;
      return;
    }

    this.config = config;
    this.db = await this.openDatabase(config.tenantId);

    // Recover last sequence number from metadata store for crash recovery
    await this.recoverSequenceCounter();
  }

  /**
   * Recover the last persisted sequence number from the metadata store.
   * This handles the case where the app crashed mid-session.
   */
  private async recoverSequenceCounter(): Promise<void> {
    const db = this.getDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');
      const request = store.get('lastSequenceNumber');

      request.onsuccess = () => {
        if (request.result && typeof request.result.value === 'number') {
          this.sessionSequenceCounter = request.result.value;
        } else {
          this.sessionSequenceCounter = 0;
        }
        resolve();
      };
      request.onerror = () => {
        // If we can't read, start fresh
        this.sessionSequenceCounter = 0;
        resolve();
      };
    });
  }

  /**
   * Opens (or creates) the IndexedDB database for the given tenant.
   * Creates all required object stores and indexes on version upgrade.
   */
  private openDatabase(tenantId: string): Promise<IDBDatabase> {
    const dbName = this.getDatabaseName(tenantId);

    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createObjectStores(db);
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        resolve(db);
      };

      request.onerror = (event) => {
        const error = (event.target as IDBOpenDBRequest).error;
        reject(new Error(`Failed to open IndexedDB "${dbName}": ${error?.message ?? 'Unknown error'}`));
      };

      request.onblocked = () => {
        reject(new Error(`IndexedDB "${dbName}" is blocked. Close other connections and retry.`));
      };
    });
  }

  /**
   * Creates all object stores and indexes during an upgrade transaction.
   */
  private createObjectStores(db: IDBDatabase): void {
    // ─── Operations store ───────────────────────────────────────────────
    if (!db.objectStoreNames.contains('operations')) {
      const operations = db.createObjectStore('operations', { keyPath: 'id' });
      operations.createIndex('by-status', 'status', { unique: false });
      operations.createIndex('by-sequence', ['sessionId', 'sequenceNumber'], { unique: false });
      operations.createIndex('by-idempotency', 'idempotencyKey', { unique: true });
    }

    // ─── Products store ─────────────────────────────────────────────────
    if (!db.objectStoreNames.contains('products')) {
      const products = db.createObjectStore('products', { keyPath: 'id' });
      products.createIndex('by-updated', 'updatedAt', { unique: false });
      products.createIndex('by-sku', 'sku', { unique: false });
    }

    // ─── Prices store ───────────────────────────────────────────────────
    if (!db.objectStoreNames.contains('prices')) {
      const prices = db.createObjectStore('prices', { keyPath: 'productId' });
      prices.createIndex('by-updated', 'updatedAt', { unique: false });
    }

    // ─── Customers store ────────────────────────────────────────────────
    if (!db.objectStoreNames.contains('customers')) {
      const customers = db.createObjectStore('customers', { keyPath: 'id' });
      customers.createIndex('by-accessed', 'lastAccessedAt', { unique: false });
    }

    // ─── Metadata store ─────────────────────────────────────────────────
    if (!db.objectStoreNames.contains('metadata')) {
      db.createObjectStore('metadata', { keyPath: 'key' });
    }
  }

  /**
   * Close the current database connection and reset internal state.
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.config = null;
    this.sessionSequenceCounter = 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Queue operations
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Enqueue an operation into the offline store.
   * Generates a UUID, assigns a monotonic sequence number, and persists with status 'pending'.
   * Enforces offline_tolerance_threshold and handles quota exceeded errors.
   */
  async enqueue(
    operation: Omit<OperationEnvelope, 'id' | 'sequenceNumber' | 'status' | 'createdAt'>
  ): Promise<OperationEnvelope> {
    const db = this.getDb();
    const config = this.getConfig();

    // Check threshold before persisting
    const pendingCount = await this.getPendingCount();
    if (pendingCount >= config.offlineToleranceThreshold) {
      throw new Error(
        `Offline queue is full: ${pendingCount} pending operations reached the threshold of ${config.offlineToleranceThreshold}. Only read-only operations are allowed.`
      );
    }

    // Assign monotonically increasing sequence number
    this.sessionSequenceCounter += 1;
    const sequenceNumber = this.sessionSequenceCounter;

    const envelope: OperationEnvelope = {
      ...operation,
      id: crypto.randomUUID(),
      sequenceNumber,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    // Persist to IndexedDB
    await this.persistEnvelope(db, envelope);

    // Persist last sequence number to metadata for crash recovery
    await this.persistSequenceNumber(db, sequenceNumber);

    return envelope;
  }

  /**
   * Persist an envelope to the 'operations' object store.
   * Throws a specific error on quota exceeded.
   */
  private persistEnvelope(db: IDBDatabase, envelope: OperationEnvelope): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('operations', 'readwrite');
      const store = tx.objectStore('operations');
      const request = store.add(envelope);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        const error = request.error;
        // Check for quota exceeded
        if (error && (error.name === 'QuotaExceededError' || error.message?.includes('quota'))) {
          reject(new Error('IndexedDB quota exceeded. Cannot persist new operations until sync completes or old operations are purged.'));
        } else {
          reject(new Error(`Failed to persist operation envelope: ${error?.message ?? 'Unknown error'}`));
        }
      };

      tx.onerror = () => {
        const error = tx.error;
        if (error && (error.name === 'QuotaExceededError' || error.message?.includes('quota'))) {
          reject(new Error('IndexedDB quota exceeded. Cannot persist new operations until sync completes or old operations are purged.'));
        } else {
          reject(new Error(`Transaction failed: ${error?.message ?? 'Unknown error'}`));
        }
      };
    });
  }

  /**
   * Persist the last sequence number to the metadata store for crash recovery.
   */
  private persistSequenceNumber(db: IDBDatabase, sequenceNumber: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('metadata', 'readwrite');
      const store = tx.objectStore('metadata');
      const request = store.put({
        key: 'lastSequenceNumber',
        value: sequenceNumber,
        updatedAt: new Date().toISOString(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => {
        // Non-critical — sequence number recovery is best-effort
        resolve();
      };
    });
  }

  /**
   * Return up to `limit` envelopes with status 'pending', ordered by sequenceNumber ascending.
   */
  async getBatch(limit: number): Promise<OperationEnvelope[]> {
    const db = this.getDb();

    return new Promise<OperationEnvelope[]>((resolve, reject) => {
      const tx = db.transaction('operations', 'readonly');
      const store = tx.objectStore('operations');
      const index = store.index('by-status');
      const request = index.openCursor(IDBKeyRange.only('pending'));
      const results: OperationEnvelope[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          results.push(cursor.value as OperationEnvelope);
          cursor.continue();
        } else {
          // Sort by sequenceNumber ascending, then take the first `limit` items
          results.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
          resolve(results.slice(0, limit));
        }
      };

      request.onerror = () => {
        reject(new Error(`Failed to get batch: ${request.error?.message ?? 'Unknown error'}`));
      };
    });
  }

  /**
   * Update the status of all envelopes with the given IDs.
   */
  async markStatus(ids: string[], status: EnvelopeStatus): Promise<void> {
    if (ids.length === 0) return;

    const db = this.getDb();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('operations', 'readwrite');
      const store = tx.objectStore('operations');
      let completed = 0;

      for (const id of ids) {
        const getRequest = store.get(id);
        getRequest.onsuccess = () => {
          const envelope = getRequest.result as OperationEnvelope | undefined;
          if (envelope) {
            envelope.status = status;
            store.put(envelope);
          }
          completed++;
          if (completed === ids.length) {
            // All updates queued — wait for transaction to complete
          }
        };
        getRequest.onerror = () => {
          completed++;
        };
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        reject(new Error(`Failed to mark status: ${tx.error?.message ?? 'Unknown error'}`));
      };
    });
  }

  /**
   * Count all operations with status 'pending' using the 'by-status' index.
   */
  async getPendingCount(): Promise<number> {
    const db = this.getDb();

    return new Promise<number>((resolve, reject) => {
      const tx = db.transaction('operations', 'readonly');
      const store = tx.objectStore('operations');
      const index = store.index('by-status');
      const request = index.count(IDBKeyRange.only('pending'));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        reject(new Error(`Failed to get pending count: ${request.error?.message ?? 'Unknown error'}`));
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Read cache — with read-your-writes consistency
  // ═══════════════════════════════════════════════════════════════════════

  /** Maximum number of customer records to keep in local cache (LRU). */
  private static readonly MAX_CUSTOMERS = 500;

  /**
   * Get a product from the local cache.
   * Implements read-your-writes: checks pending operations for local modifications first.
   * Returns cache-miss indication for records not in local cache.
   */
  async getProduct(productId: string): Promise<CacheReadResult> {
    const db = this.getDb();

    // Check pending operations for local modifications (read-your-writes)
    const localModification = await this.findLocalModification(db, productId, 'products');
    if (localModification) {
      const cacheAge = await this.getCacheAge();
      return {
        data: localModification,
        isLocalModification: true,
        isStale: cacheAge.isStale,
        lastSyncTimestamp: cacheAge.lastSyncTimestamp,
      };
    }

    // Read from cache store
    const record = await this.readFromStore<Record<string, unknown>>(db, 'products', productId);
    if (!record) {
      return {
        data: null,
        isLocalModification: false,
        isStale: false,
        lastSyncTimestamp: null,
      };
    }

    const cacheAge = await this.getCacheAge();
    return {
      data: record,
      isLocalModification: false,
      isStale: cacheAge.isStale,
      lastSyncTimestamp: cacheAge.lastSyncTimestamp,
    };
  }

  /**
   * Get a price record from the local cache.
   * Implements read-your-writes: checks pending operations for local modifications first.
   * Returns cache-miss indication for records not in local cache.
   */
  async getPrice(productId: string): Promise<CacheReadResult> {
    const db = this.getDb();

    // Check pending operations for local modifications (read-your-writes)
    const localModification = await this.findLocalModification(db, productId, 'prices');
    if (localModification) {
      const cacheAge = await this.getCacheAge();
      return {
        data: localModification,
        isLocalModification: true,
        isStale: cacheAge.isStale,
        lastSyncTimestamp: cacheAge.lastSyncTimestamp,
      };
    }

    // Read from cache store
    const record = await this.readFromStore<Record<string, unknown>>(db, 'prices', productId);
    if (!record) {
      return {
        data: null,
        isLocalModification: false,
        isStale: false,
        lastSyncTimestamp: null,
      };
    }

    const cacheAge = await this.getCacheAge();
    return {
      data: record,
      isLocalModification: false,
      isStale: cacheAge.isStale,
      lastSyncTimestamp: cacheAge.lastSyncTimestamp,
    };
  }

  /**
   * Get a customer record from the local cache.
   * Implements read-your-writes: checks pending operations for local modifications first.
   * Updates the lastAccessedAt timestamp for LRU tracking.
   * Returns cache-miss indication for records not in local cache.
   */
  async getCustomer(customerId: string): Promise<CacheReadResult> {
    const db = this.getDb();

    // Check pending operations for local modifications (read-your-writes)
    const localModification = await this.findLocalModification(db, customerId, 'customers');
    if (localModification) {
      const cacheAge = await this.getCacheAge();
      return {
        data: localModification,
        isLocalModification: true,
        isStale: cacheAge.isStale,
        lastSyncTimestamp: cacheAge.lastSyncTimestamp,
      };
    }

    // Read from cache store
    const record = await this.readFromStore<Record<string, unknown>>(db, 'customers', customerId);
    if (!record) {
      return {
        data: null,
        isLocalModification: false,
        isStale: false,
        lastSyncTimestamp: null,
      };
    }

    // Update lastAccessedAt for LRU tracking
    await this.updateCustomerAccessTime(db, customerId);

    const cacheAge = await this.getCacheAge();
    return {
      data: record,
      isLocalModification: false,
      isStale: cacheAge.isStale,
      lastSyncTimestamp: cacheAge.lastSyncTimestamp,
    };
  }

  /**
   * Update the cache for a given entity type (products, prices, customers).
   * For customers, enforces the 500 most recent limit via LRU eviction.
   * After acknowledgment from server, replaces local version with server-confirmed version.
   */
  async updateCache(entity: string, records: Record<string, unknown>[]): Promise<void> {
    if (records.length === 0) return;

    const db = this.getDb();
    const storeName = this.getStoreNameForEntity(entity);

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      for (const record of records) {
        // Ensure updatedAt is set for delta sync tracking
        if (!record.updatedAt) {
          record.updatedAt = new Date().toISOString();
        }
        // For customers, set lastAccessedAt for LRU
        if (entity === 'customers' && !record.lastAccessedAt) {
          record.lastAccessedAt = new Date().toISOString();
        }
        store.put(record);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error(`Failed to update cache for ${entity}: ${tx.error?.message ?? 'Unknown error'}`));
    });

    // For customers, enforce the 500-record LRU limit
    if (entity === 'customers') {
      await this.enforceCustomerLimit(db);
    }

    // Update the last sync timestamp metadata for this entity
    await this.setCacheMetadata(`lastSync_${entity}`, new Date().toISOString());
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Delta Sync
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Perform delta sync on startup — only fetches records changed since the last sync timestamp.
   * If the sync fails (network error), serves stale cache with age notification.
   */
  async deltaSync(options: DeltaSyncOptions): Promise<DeltaSyncResult> {
    const lastSyncMeta = await this.getCacheMetadata('lastSyncTimestamp');
    const lastSyncTimestamp = lastSyncMeta?.value as string | null ?? null;

    let productsUpdated = 0;
    let pricesUpdated = 0;
    let customersUpdated = 0;
    let syncError: string | undefined;

    try {
      // Fetch and update products
      if (options.fetchChangedProducts) {
        const changedProducts = await options.fetchChangedProducts(lastSyncTimestamp);
        if (changedProducts.length > 0) {
          await this.updateCache('products', changedProducts);
          productsUpdated = changedProducts.length;
        }
      }

      // Fetch and update prices
      if (options.fetchChangedPrices) {
        const changedPrices = await options.fetchChangedPrices(lastSyncTimestamp);
        if (changedPrices.length > 0) {
          await this.updateCache('prices', changedPrices);
          pricesUpdated = changedPrices.length;
        }
      }

      // Fetch and update customers
      if (options.fetchChangedCustomers) {
        const changedCustomers = await options.fetchChangedCustomers(lastSyncTimestamp);
        if (changedCustomers.length > 0) {
          await this.updateCache('customers', changedCustomers);
          customersUpdated = changedCustomers.length;
        }
      }

      // Update the global last sync timestamp
      const syncTimestamp = new Date().toISOString();
      await this.setCacheMetadata('lastSyncTimestamp', syncTimestamp);

      return {
        productsUpdated,
        pricesUpdated,
        customersUpdated,
        syncTimestamp,
        isStale: false,
      };
    } catch (error) {
      // Sync failed — serve stale cache with age notification
      syncError = error instanceof Error ? error.message : String(error);

      return {
        productsUpdated,
        pricesUpdated,
        customersUpdated,
        syncTimestamp: lastSyncTimestamp ?? '',
        isStale: true,
        error: syncError,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Cache Metadata
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get cache metadata by key (e.g., 'lastSyncTimestamp', 'cacheVersion').
   */
  async getCacheMetadata(key: string): Promise<CacheMetadata | null> {
    const db = this.getDb();
    return new Promise<CacheMetadata | null>((resolve, reject) => {
      const tx = db.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result ?? null);
      };
      request.onerror = () => {
        reject(new Error(`Failed to get cache metadata "${key}": ${request.error?.message ?? 'Unknown error'}`));
      };
    });
  }

  /**
   * Set cache metadata (e.g., last sync timestamp, record versions).
   */
  async setCacheMetadata(key: string, value: unknown): Promise<void> {
    const db = this.getDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('metadata', 'readwrite');
      const store = tx.objectStore('metadata');
      const request = store.put({
        key,
        value,
        updatedAt: new Date().toISOString(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => {
        reject(new Error(`Failed to set cache metadata "${key}": ${request.error?.message ?? 'Unknown error'}`));
      };
    });
  }

  /**
   * Check if the cache is stale (no successful sync has ever completed
   * or last sync was before current session start).
   */
  async isCacheStale(): Promise<boolean> {
    const meta = await this.getCacheMetadata('lastSyncTimestamp');
    return meta === null;
  }

  /**
   * Get cache age details — used for stale cache notification.
   */
  async getCacheAge(): Promise<{ isStale: boolean; lastSyncTimestamp: string | null; ageMs: number | null }> {
    const meta = await this.getCacheMetadata('lastSyncTimestamp');
    if (!meta || !meta.value) {
      return { isStale: true, lastSyncTimestamp: null, ageMs: null };
    }

    const lastSync = meta.value as string;
    const ageMs = Date.now() - new Date(lastSync).getTime();

    return {
      isStale: false,
      lastSyncTimestamp: lastSync,
      ageMs,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private helpers for read cache
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Find a locally modified version of a record by checking pending/syncing operations.
   * This implements read-your-writes consistency: if the user modified a record locally
   * and it hasn't been acknowledged by the server yet, return the local version.
   */
  private async findLocalModification(
    db: IDBDatabase,
    recordId: string,
    entityStore: string
  ): Promise<Record<string, unknown> | null> {
    return new Promise<Record<string, unknown> | null>((resolve, reject) => {
      const tx = db.transaction('operations', 'readonly');
      const store = tx.objectStore('operations');
      const index = store.index('by-status');

      // Check pending operations first, then syncing operations
      const pendingRequest = index.openCursor(IDBKeyRange.only('pending'));
      const modifications: OperationEnvelope[] = [];

      pendingRequest.onsuccess = () => {
        const cursor = pendingRequest.result;
        if (cursor) {
          const envelope = cursor.value as OperationEnvelope;
          if (this.envelopeModifiesRecord(envelope, recordId, entityStore)) {
            modifications.push(envelope);
          }
          cursor.continue();
        } else {
          // Also check 'syncing' status operations
          const syncingRequest = index.openCursor(IDBKeyRange.only('syncing'));
          syncingRequest.onsuccess = () => {
            const syncCursor = syncingRequest.result;
            if (syncCursor) {
              const envelope = syncCursor.value as OperationEnvelope;
              if (this.envelopeModifiesRecord(envelope, recordId, entityStore)) {
                modifications.push(envelope);
              }
              syncCursor.continue();
            } else {
              // Return the most recent local modification
              if (modifications.length === 0) {
                resolve(null);
              } else {
                // Sort by sequence number descending and return the latest payload
                modifications.sort((a, b) => b.sequenceNumber - a.sequenceNumber);
                const latest = modifications[0];
                resolve({
                  ...latest.payload,
                  id: recordId,
                  _localModification: true,
                  _envelopeId: latest.id,
                });
              }
            }
          };
          syncingRequest.onerror = () => resolve(null);
        }
      };

      pendingRequest.onerror = () => resolve(null);
    });
  }

  /**
   * Determine if an operation envelope modifies a specific record in a given entity store.
   */
  private envelopeModifiesRecord(
    envelope: OperationEnvelope,
    recordId: string,
    entityStore: string
  ): boolean {
    const payload = envelope.payload;

    // Map entity store to relevant operation types and payload fields
    switch (entityStore) {
      case 'products':
        if (
          envelope.operationType === 'inventory_adjustment' ||
          envelope.operationType === 'stock_movement' ||
          envelope.operationType === 'stock_deduction'
        ) {
          return payload.productId === recordId || payload.id === recordId;
        }
        return false;

      case 'prices':
        if (envelope.operationType === 'price_update') {
          return payload.productId === recordId || payload.id === recordId;
        }
        return false;

      case 'customers':
        if (envelope.operationType === 'customer_update') {
          return payload.customerId === recordId || payload.id === recordId;
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Read a record from an IndexedDB object store by key.
   */
  private readFromStore<T>(db: IDBDatabase, storeName: string, key: string): Promise<T | null> {
    return new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => {
        reject(new Error(`Failed to read from ${storeName}: ${request.error?.message ?? 'Unknown error'}`));
      };
    });
  }

  /**
   * Update the lastAccessedAt timestamp for a customer record (LRU tracking).
   */
  private updateCustomerAccessTime(db: IDBDatabase, customerId: string): Promise<void> {
    return new Promise<void>((resolve) => {
      const tx = db.transaction('customers', 'readwrite');
      const store = tx.objectStore('customers');
      const getRequest = store.get(customerId);

      getRequest.onsuccess = () => {
        const record = getRequest.result;
        if (record) {
          record.lastAccessedAt = new Date().toISOString();
          store.put(record);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // Non-critical — don't fail the read
    });
  }

  /**
   * Enforce the 500 most recent customer limit using LRU eviction.
   * Removes the least recently accessed customers when the count exceeds the limit.
   */
  private enforceCustomerLimit(db: IDBDatabase): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('customers', 'readwrite');
      const store = tx.objectStore('customers');
      const countRequest = store.count();

      countRequest.onsuccess = () => {
        const count = countRequest.result;
        if (count <= OfflineStoreService.MAX_CUSTOMERS) {
          resolve();
          return;
        }

        // Need to evict oldest (by lastAccessedAt) to get down to MAX_CUSTOMERS
        const numToEvict = count - OfflineStoreService.MAX_CUSTOMERS;
        const index = store.index('by-accessed');
        // Open cursor in ascending order (oldest first)
        const cursorRequest = index.openCursor();
        let evicted = 0;

        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (cursor && evicted < numToEvict) {
            cursor.delete();
            evicted++;
            cursor.continue();
          }
          // When cursor is null or we've evicted enough, transaction completes
        };

        cursorRequest.onerror = () => {
          // Non-critical — we'll try again next time
        };
      };

      countRequest.onerror = () => resolve();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // Non-critical
    });
  }

  /**
   * Map entity name to IndexedDB object store name.
   */
  private getStoreNameForEntity(entity: string): string {
    switch (entity) {
      case 'products':
        return 'products';
      case 'prices':
        return 'prices';
      case 'customers':
        return 'customers';
      default:
        throw new Error(`Unknown cache entity: ${entity}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Stub implementations — will be completed in subsequent tasks
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Verify integrity of all Operation_Envelopes on startup.
   *
   * Validates that each envelope has:
   * - A valid status (one of: pending, syncing, acknowledged, failed)
   * - A positive integer sequence number
   * - A non-empty idempotency key
   *
   * Categorizes entries as:
   * - valid: passes all checks
   * - corrupt: fails one or more checks and cannot be recovered
   * - recovered: was in an inconsistent state but could be corrected (e.g., missing status → set to 'pending')
   *
   * Quarantines corrupt entries without valid idempotency keys by moving them
   * to 'failed' status with a quarantine flag.
   *
   * Requirements: 9.1, 9.7
   */
  async verifyIntegrity(): Promise<IntegrityReport> {
    const db = this.getDb();

    return new Promise<IntegrityReport>((resolve, reject) => {
      const tx = db.transaction('operations', 'readwrite');
      const store = tx.objectStore('operations');
      const request = store.openCursor();

      let totalEnvelopes = 0;
      let validEnvelopes = 0;
      let corruptEnvelopes = 0;
      let recoveredEnvelopes = 0;
      let orphanedEntries = 0;

      const validStatuses = ['pending', 'syncing', 'acknowledged', 'failed'];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          totalEnvelopes++;
          const envelope = cursor.value as Record<string, unknown>;

          const hasValidStatus =
            typeof envelope.status === 'string' &&
            validStatuses.includes(envelope.status);
          const hasValidSequenceNumber =
            typeof envelope.sequenceNumber === 'number' &&
            Number.isInteger(envelope.sequenceNumber) &&
            envelope.sequenceNumber >= 1;
          const hasValidIdempotencyKey =
            typeof envelope.idempotencyKey === 'string' &&
            envelope.idempotencyKey.trim().length > 0;

          if (hasValidStatus && hasValidSequenceNumber && hasValidIdempotencyKey) {
            // Fully valid
            validEnvelopes++;
          } else if (!hasValidIdempotencyKey) {
            // Cannot recover without an idempotency key — quarantine
            corruptEnvelopes++;
            // Mark as quarantined by setting status to 'failed' with a flag
            envelope.status = 'failed';
            envelope._quarantined = true;
            envelope._quarantineReason = 'Missing or invalid idempotency key';
            cursor.update(envelope);
          } else {
            // Has valid idempotency key but other issues — attempt recovery
            let recovered = false;

            if (!hasValidStatus) {
              // Recover by setting status to 'pending'
              envelope.status = 'pending';
              recovered = true;
            }

            if (!hasValidSequenceNumber) {
              // If sequence number is missing/invalid, assign 0 to indicate needs resequencing
              // but this is still recoverable since we have the idempotency key
              envelope.sequenceNumber = 0;
              envelope._needsResequencing = true;
              recovered = true;
            }

            if (recovered) {
              recoveredEnvelopes++;
              cursor.update(envelope);
            } else {
              // Should not reach here, but count as corrupt
              corruptEnvelopes++;
            }
          }

          cursor.continue();
        }
        // When cursor is null, all entries have been processed
      };

      request.onerror = () => {
        reject(
          new Error(
            `Integrity verification failed: ${request.error?.message ?? 'Unknown error'}`,
          ),
        );
      };

      tx.oncomplete = () => {
        resolve({
          totalEnvelopes,
          validEnvelopes,
          corruptEnvelopes,
          recoveredEnvelopes,
          orphanedEntries,
        });
      };

      tx.onerror = () => {
        reject(
          new Error(
            `Integrity verification transaction failed: ${tx.error?.message ?? 'Unknown error'}`,
          ),
        );
      };
    });
  }

  /**
   * Purge acknowledged operations older than the given date.
   * Returns the number of entries purged.
   *
   * Requirements: 9.5
   */
  async purgeAcknowledged(beforeDate: Date): Promise<number> {
    const db = this.getDb();

    return new Promise<number>((resolve, reject) => {
      const tx = db.transaction('operations', 'readwrite');
      const store = tx.objectStore('operations');
      const index = store.index('by-status');
      const request = index.openCursor(IDBKeyRange.only('acknowledged'));
      let purgedCount = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const envelope = cursor.value as Record<string, unknown>;
          const createdAt = envelope.createdAt
            ? new Date(envelope.createdAt as string)
            : null;

          if (createdAt && createdAt < beforeDate) {
            cursor.delete();
            purgedCount++;
          }
          cursor.continue();
        }
      };

      request.onerror = () => {
        reject(
          new Error(
            `Purge failed: ${request.error?.message ?? 'Unknown error'}`,
          ),
        );
      };

      tx.oncomplete = () => resolve(purgedCount);
      tx.onerror = () => {
        reject(
          new Error(
            `Purge transaction failed: ${tx.error?.message ?? 'Unknown error'}`,
          ),
        );
      };
    });
  }
}
