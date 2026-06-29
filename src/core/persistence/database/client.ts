/**
 * ============================================================
 * ESTELA GEA PRISMA CLIENT SINGLETON
 * 
 * Ensures only one Prisma Client instance exists across the app
 * Prevents connection pool exhaustion in development
 * ============================================================
 */

import { PrismaClient } from '@prisma/client';

/**
 * Global augmentation for Prisma Client
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma Client Singleton
 * 
 * In development, we reuse the same instance to prevent
 * connection pool exhaustion during hot reloads
 */
export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Graceful shutdown handler
 * Call this when the application is shutting down
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log('📂 Database connection closed');
}

/**
 * Health check for database connection
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}
