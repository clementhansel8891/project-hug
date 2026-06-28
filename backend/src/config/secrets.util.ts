import * as fs from 'fs';
import * as path from 'path';

/**
 * Docker Secrets Utility
 * 
 * Reads secrets from Docker secrets files (/run/secrets/) with fallback to
 * environment variables. This eliminates the need for plaintext .env files
 * in production.
 * 
 * Priority order:
 * 1. Docker secret file (/run/secrets/<name>)
 * 2. Environment variable
 * 3. Default value
 * 
 * Usage:
 *   const dbPassword = readSecret('db_password', process.env.POSTGRES_PASSWORD, 'fallback');
 */

const SECRETS_DIR = '/run/secrets';

/**
 * Read a secret value from Docker secrets file, falling back to env var or default.
 */
export function readSecret(secretName: string, envFallback?: string, defaultValue?: string): string {
  // 1. Try Docker secrets file
  const secretPath = path.join(SECRETS_DIR, secretName);
  try {
    if (fs.existsSync(secretPath)) {
      return fs.readFileSync(secretPath, 'utf8').trim();
    }
  } catch {
    // File not accessible — continue to fallback
  }

  // 2. Try environment variable
  if (envFallback !== undefined && envFallback !== '') {
    return envFallback;
  }

  // 3. Use default
  if (defaultValue !== undefined) {
    return defaultValue;
  }

  throw new Error(
    `Secret "${secretName}" not found. Expected at ${secretPath} or as environment variable.`
  );
}

/**
 * Build a DATABASE_URL from individual secrets.
 * Useful when DB credentials are stored as separate secrets.
 */
export function buildDatabaseUrl(): string {
  const user = readSecret('db_user', process.env.POSTGRES_USER, 'zenvix');
  const password = readSecret('db_password', process.env.POSTGRES_PASSWORD, 'zenvix_dev_password');
  const host = process.env.DB_HOST || 'db';
  const port = process.env.DB_PORT || '5432';
  const db = process.env.POSTGRES_DB || 'zenvix_dev';

  // If DATABASE_URL is explicitly set (e.g., in .env for local dev), use it directly
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  return `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;
}

/**
 * Get JWT secret from Docker secrets or env.
 */
export function getJwtSecret(): string {
  return readSecret('jwt_secret', process.env.JWT_SECRET, 'dev-secret-key-do-not-use-in-prod');
}

/**
 * Get Stripe secret key from Docker secrets or env.
 */
export function getStripeSecretKey(): string {
  return readSecret('stripe_secret_key', process.env.STRIPE_SECRET_KEY, '');
}

/**
 * Get Stripe webhook secret from Docker secrets or env.
 */
export function getStripeWebhookSecret(): string {
  return readSecret('stripe_webhook_secret', process.env.STRIPE_WEBHOOK_SECRET, '');
}
