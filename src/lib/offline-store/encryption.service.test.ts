/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EncryptionService } from './encryption.service';
import type { IEncryptionService } from './encryption.service';

/**
 * Unit tests for EncryptionService.
 * Validates: Requirements 10.4, 10.5
 *
 * Uses Node.js built-in crypto.subtle (Node 18+).
 */
describe('EncryptionService', () => {
  let service: IEncryptionService;

  beforeEach(() => {
    service = new EncryptionService();
  });

  describe('deriveKey', () => {
    it('should derive a CryptoKey from authToken and tenantId', async () => {
      const key = await service.deriveKey('token-abc-123', 'tenant-001');
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
      expect(key.usages).toContain('encrypt');
      expect(key.usages).toContain('decrypt');
    });

    it('should produce the same key for the same inputs (deterministic)', async () => {
      const key1 = await service.deriveKey('my-token', 'tenant-A');
      const key2 = await service.deriveKey('my-token', 'tenant-A');

      // Encrypt with key1, decrypt with key2 — should succeed if keys are identical
      const payload = { test: 'determinism-check', value: 42 };
      const encrypted = await service.encrypt(payload, key1);
      const decrypted = await service.decrypt(encrypted, key2);
      expect(decrypted).toEqual(payload);
    });

    it('should produce different keys for different tenantIds', async () => {
      const key1 = await service.deriveKey('same-token', 'tenant-A');
      const key2 = await service.deriveKey('same-token', 'tenant-B');

      const payload = { secret: 'data' };
      const encrypted = await service.encrypt(payload, key1);

      // Decrypting with a different tenant's key should fail
      await expect(service.decrypt(encrypted, key2)).rejects.toThrow();
    });

    it('should produce different keys for different authTokens', async () => {
      const key1 = await service.deriveKey('token-old', 'tenant-X');
      const key2 = await service.deriveKey('token-new', 'tenant-X');

      const payload = { amount: 100.50 };
      const encrypted = await service.encrypt(payload, key1);

      // Decrypting with a key derived from a different token should fail
      await expect(service.decrypt(encrypted, key2)).rejects.toThrow();
    });
  });

  describe('encrypt / decrypt round-trip', () => {
    it('should encrypt and decrypt a simple payload', async () => {
      const key = await service.deriveKey('auth-token-test', 'tenant-123');
      const payload = { productId: 'prod-001', quantity: 5, price: 29.99 };

      const encrypted = await service.encrypt(payload, key);
      expect(encrypted).toBeInstanceOf(ArrayBuffer);
      expect(encrypted.byteLength).toBeGreaterThan(12); // At least IV + some ciphertext

      const decrypted = await service.decrypt(encrypted, key);
      expect(decrypted).toEqual(payload);
    });

    it('should handle empty object payload', async () => {
      const key = await service.deriveKey('token', 'tenant');
      const payload = {};

      const encrypted = await service.encrypt(payload, key);
      const decrypted = await service.decrypt(encrypted, key);
      expect(decrypted).toEqual(payload);
    });

    it('should handle complex nested payload', async () => {
      const key = await service.deriveKey('complex-token', 'tenant-complex');
      const payload = {
        id: 'op-123',
        items: [
          { sku: 'A001', qty: 2, price: 10.0 },
          { sku: 'B002', qty: 1, price: 25.5 },
        ],
        metadata: { cashier: 'user-456', register: 3 },
        timestamp: '2024-01-15T10:30:00.000Z',
        total: 45.5,
        null_field: null,
        flag: true,
      };

      const encrypted = await service.encrypt(payload, key);
      const decrypted = await service.decrypt(encrypted, key);
      expect(decrypted).toEqual(payload);
    });

    it('should produce different ciphertexts for the same plaintext (random IV)', async () => {
      const key = await service.deriveKey('token-iv', 'tenant-iv');
      const payload = { data: 'same-content' };

      const encrypted1 = await service.encrypt(payload, key);
      const encrypted2 = await service.encrypt(payload, key);

      // Different IVs should produce different ciphertexts
      const bytes1 = new Uint8Array(encrypted1);
      const bytes2 = new Uint8Array(encrypted2);
      const areEqual =
        bytes1.length === bytes2.length &&
        bytes1.every((b, i) => b === bytes2[i]);
      expect(areEqual).toBe(false);

      // Both should still decrypt correctly
      expect(await service.decrypt(encrypted1, key)).toEqual(payload);
      expect(await service.decrypt(encrypted2, key)).toEqual(payload);
    });

    it('should fail to decrypt tampered ciphertext', async () => {
      const key = await service.deriveKey('token-tamper', 'tenant-tamper');
      const payload = { sensitive: 'information' };

      const encrypted = await service.encrypt(payload, key);
      const tampered = new Uint8Array(encrypted);
      // Flip a byte in the ciphertext area (after the 12-byte IV)
      tampered[15] = tampered[15] ^ 0xff;

      await expect(service.decrypt(tampered.buffer, key)).rejects.toThrow();
    });

    it('should fail to decrypt with too-short input', async () => {
      const key = await service.deriveKey('token', 'tenant');
      const shortData = new Uint8Array(10).buffer; // Less than IV_LENGTH (12)

      await expect(service.decrypt(shortData, key)).rejects.toThrow(
        'Invalid encrypted data: too short'
      );
    });
  });

  describe('key rotation', () => {
    it('should support deriving a new key on token refresh', async () => {
      const oldKey = await service.deriveKey('old-refresh-token', 'tenant-rotate');
      const newKey = await service.deriveKey('new-refresh-token', 'tenant-rotate');

      const payload = { transaction: 'sale', amount: 100 };

      // Encrypt with old key
      const encryptedWithOld = await service.encrypt(payload, oldKey);

      // Old key still decrypts its own data
      expect(await service.decrypt(encryptedWithOld, oldKey)).toEqual(payload);

      // New key cannot decrypt old data (key rotation = no backward compat)
      await expect(service.decrypt(encryptedWithOld, newKey)).rejects.toThrow();

      // New key works for new data
      const encryptedWithNew = await service.encrypt(payload, newKey);
      expect(await service.decrypt(encryptedWithNew, newKey)).toEqual(payload);
    });

    it('should not cache old keys internally', async () => {
      // The service derives keys on demand — no internal key cache
      // Calling deriveKey multiple times with different tokens works independently
      const key1 = await service.deriveKey('token-v1', 'tenant-1');
      const key2 = await service.deriveKey('token-v2', 'tenant-1');
      const key3 = await service.deriveKey('token-v3', 'tenant-1');

      const payload = { version: 'test' };

      // Each key independently encrypts/decrypts
      const e1 = await service.encrypt(payload, key1);
      const e2 = await service.encrypt(payload, key2);
      const e3 = await service.encrypt(payload, key3);

      expect(await service.decrypt(e1, key1)).toEqual(payload);
      expect(await service.decrypt(e2, key2)).toEqual(payload);
      expect(await service.decrypt(e3, key3)).toEqual(payload);

      // Cross-key decryption should fail
      await expect(service.decrypt(e1, key2)).rejects.toThrow();
      await expect(service.decrypt(e2, key3)).rejects.toThrow();
    });
  });

  describe('session restriction', () => {
    it('should start with a valid session by default', () => {
      expect(service.isSessionValid()).toBe(true);
    });

    it('should block encrypt when session is locked', async () => {
      const key = await service.deriveKey('token', 'tenant');
      service.lockSession();

      await expect(
        service.encrypt({ data: 'test' }, key)
      ).rejects.toThrow('Session expired');
    });

    it('should block decrypt when session is locked', async () => {
      const key = await service.deriveKey('token', 'tenant');
      const payload = { data: 'before-lock' };
      const encrypted = await service.encrypt(payload, key);

      service.lockSession();

      await expect(service.decrypt(encrypted, key)).rejects.toThrow(
        'Session expired'
      );
    });

    it('should allow operations again after unlockSession', async () => {
      const key = await service.deriveKey('token-unlock', 'tenant-unlock');
      const payload = { restored: true };

      // Lock then unlock
      service.lockSession();
      expect(service.isSessionValid()).toBe(false);

      service.unlockSession();
      expect(service.isSessionValid()).toBe(true);

      // Operations should work again
      const encrypted = await service.encrypt(payload, key);
      const decrypted = await service.decrypt(encrypted, key);
      expect(decrypted).toEqual(payload);
    });

    it('should retain encrypted data across lock/unlock (re-auth scenario)', async () => {
      const key = await service.deriveKey('auth-token-session', 'tenant-session');
      const payload = { pendingSync: true, items: [1, 2, 3] };

      // Encrypt before session expiry
      const encrypted = await service.encrypt(payload, key);

      // Session expires
      service.lockSession();

      // Cannot access
      await expect(service.decrypt(encrypted, key)).rejects.toThrow('Session expired');

      // Re-authenticate (unlock)
      service.unlockSession();

      // Derive key again (same token) and decrypt
      const reKey = await service.deriveKey('auth-token-session', 'tenant-session');
      const decrypted = await service.decrypt(encrypted, reKey);
      expect(decrypted).toEqual(payload);
    });
  });
});
