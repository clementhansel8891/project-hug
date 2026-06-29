/**
 * Property-Based Tests for Offline Sync Security — Encryption
 *
 * Feature: offline-sync, Property 19: Encryption Round-Trip
 *
 * Uses fast-check (fc.assert / fc.property) with vitest.
 * Each property runs a minimum of 100 iterations.
 *
 * **Validates: Requirements 10.4**
 *
 * Correctness Properties:
 *   Property 19: Encryption Round-Trip
 *   - For any Operation_Envelope payload and a tenant-specific encryption key derived
 *     from an authentication token, encrypting then decrypting the payload with the same
 *     key SHALL produce an object identical to the original, and decrypting with a
 *     different tenant's key SHALL fail with a decryption error.
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { EncryptionService } from '@/lib/offline-store/encryption.service';

// ---------------------------------------------------------------------------
// Arbitraries — generators for encryption test inputs
// ---------------------------------------------------------------------------

/**
 * Generates non-empty strings suitable for auth tokens.
 */
const authTokenArb = () =>
  fc.string({ minLength: 1, maxLength: 128 }).filter((s) => s.trim().length > 0);

/**
 * Generates non-empty tenant IDs (simulating UUID-like or slug identifiers).
 */
const tenantIdArb = () =>
  fc.string({ minLength: 1, maxLength: 64 }).filter((s) => s.trim().length > 0);

/**
 * Generates arbitrary JSON-serializable payloads (objects with string/number/boolean/null/nested).
 */
const jsonPayloadArb = (): fc.Arbitrary<Record<string, unknown>> =>
  fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z_]\w*$/.test(s)),
    fc.oneof(
      fc.string({ maxLength: 50 }),
      fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e10, max: 1e10 }),
      fc.boolean(),
      fc.constant(null),
      fc.array(fc.oneof(fc.string({ maxLength: 20 }), fc.integer(), fc.boolean()), { maxLength: 5 }),
      fc.dictionary(
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z_]\w*$/.test(s)),
        fc.oneof(fc.string({ maxLength: 20 }), fc.integer(), fc.boolean(), fc.constant(null)),
        { minKeys: 0, maxKeys: 3 }
      )
    ),
    { minKeys: 1, maxKeys: 10 }
  );

/**
 * Generates two distinct tenant IDs guaranteed to be different.
 */
const distinctTenantIds = () =>
  fc.tuple(tenantIdArb(), tenantIdArb()).filter(([a, b]) => a !== b);

/**
 * Generates two distinct auth tokens guaranteed to be different.
 */
const distinctAuthTokens = () =>
  fc.tuple(authTokenArb(), authTokenArb()).filter(([a, b]) => a !== b);

// ---------------------------------------------------------------------------
// Tests — Property 19: Encryption Round-Trip
// ---------------------------------------------------------------------------

describe('Property 19: Encryption Round-Trip', () => {
  const service = new EncryptionService();

  test('encrypt then decrypt with same key produces identical payload', async () => {
    await fc.assert(
      fc.asyncProperty(
        authTokenArb(),
        tenantIdArb(),
        jsonPayloadArb(),
        async (token, tenantId, payload) => {
          const key = await service.deriveKey(token, tenantId);
          const encrypted = await service.encrypt(payload, key);
          const decrypted = await service.decrypt(encrypted, key);

          // The decrypted result must be deeply equal to the original payload
          expect(decrypted).toEqual(payload);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('encrypt with tenant A key, decrypt with tenant B key fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        authTokenArb(),
        distinctTenantIds(),
        jsonPayloadArb(),
        async (token, [tenantA, tenantB], payload) => {
          const keyA = await service.deriveKey(token, tenantA);
          const keyB = await service.deriveKey(token, tenantB);

          const encrypted = await service.encrypt(payload, keyA);

          // Decrypting with a different tenant's key must throw
          await expect(service.decrypt(encrypted, keyB)).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('encrypt with token A key, decrypt with token B key fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        distinctAuthTokens(),
        tenantIdArb(),
        jsonPayloadArb(),
        async ([tokenA, tokenB], tenantId, payload) => {
          const keyA = await service.deriveKey(tokenA, tenantId);
          const keyB = await service.deriveKey(tokenB, tenantId);

          const encrypted = await service.encrypt(payload, keyA);

          // Decrypting with a key derived from a different auth token must throw
          await expect(service.decrypt(encrypted, keyB)).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});
