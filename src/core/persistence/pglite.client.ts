import { PGlite } from "@electric-sql/pglite";
import schemaSql from "./local-schema.sql?raw";

/**
 * Estela Gea PGLite Client
 * Provides local-first persistence using IndexedDB.
 */
class PGLiteClient {
  private static instance: PGlite | null = null;
  private static isInitialized = false;

  public static async getInstance(): Promise<PGlite> {
    if (!this.instance) {
      this.instance = new PGlite("idb://estelagea-local-db");
      await this.instance.waitReady;
    }
    return this.instance;
  }

  /**
   * Initialize the local database schema
   */
  public static async boot(): Promise<void> {
    // if (this.isInitialized) return;

    try {
      const db = await this.getInstance();
      
      // Execute schema migrations
      console.log("[PGLite] Initializing local schema...");
      await db.exec(schemaSql);
      
      this.isInitialized = true;
      console.log("[PGLite] Local database ready.");
    } catch (error) {
      console.error("[PGLite] Failed to boot local database:", error);
      throw error;
    }
  }

  /**
   * Run operations within a transaction
   */
  public static async transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    const db = await this.getInstance();
    return db.transaction(callback);
  }

  /**
   * Helper to run queries with logging
   */
  public static async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const db = await this.getInstance();
    const result = await db.query(sql, params);
    return result.rows as T[];
  }
}

export const db = PGLiteClient;
export default PGLiteClient;
