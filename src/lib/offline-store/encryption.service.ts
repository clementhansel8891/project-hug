/**
 * Tenant-specific encryption service for offline store data.
 *
 * Uses Web Crypto API (available in browsers and Node.js 18+):
 * - Key derivation: PBKDF2 with SHA-256 (100,000 iterations)
 * - Encryption: AES-GCM with 256-bit key, random 12-byte IV
 *
 * Validates: Requirements 10.4, 10.5
 */

/**
 * Public interface for the encryption service.
 */
export interface IEncryptionService {
  deriveKey(authToken: string, tenantId: string): Promise<CryptoKey>;
  encrypt(data: Record<string, unknown>, key: CryptoKey): Promise<ArrayBuffer>;
  decrypt(encrypted: ArrayBuffer, key: CryptoKey): Promise<Record<string, unknown>>;
  isSessionValid(): boolean;
  lockSession(): void;
  unlockSession(): void;
}

/**
 * IV byte length for AES-GCM (96 bits / 12 bytes as recommended by NIST).
 */
const IV_LENGTH = 12;

/**
 * PBKDF2 iteration count for key derivation.
 */
const PBKDF2_ITERATIONS = 100_000;

/**
 * Resolves the Web Crypto subtle interface.
 * Works in both browser (window.crypto) and Node.js (globalThis.crypto).
 */
function getSubtle(): SubtleCrypto {
  const cryptoObj =
    typeof globalThis !== 'undefined' && globalThis.crypto
      ? globalThis.crypto
      : typeof window !== 'undefined' && window.crypto
        ? window.crypto
        : undefined;

  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error(
      'Web Crypto API is not available. Ensure you are running in a secure context (HTTPS) or Node.js 18+.'
    );
  }
  return cryptoObj.subtle;
}

/**
 * Returns a cryptographically random IV of the specified length.
 */
function getRandomIV(length: number): Uint8Array {
  const cryptoObj =
    typeof globalThis !== 'undefined' && globalThis.crypto
      ? globalThis.crypto
      : typeof window !== 'undefined' && window.crypto
        ? window.crypto
        : undefined;

  if (!cryptoObj) {
    throw new Error('crypto.getRandomValues is not available.');
  }
  return cryptoObj.getRandomValues(new Uint8Array(length));
}

/**
 * EncryptionService — handles tenant-specific AES-GCM encryption for offline data.
 *
 * Key features:
 * - Derives a unique AES-256 key per (authToken, tenantId) pair using PBKDF2
 * - Encrypts/decrypts Operation_Envelope payloads with AES-GCM
 * - Supports key rotation: does not cache old keys internally
 * - Restricts access when session is expired/locked
 */
export class EncryptionService implements IEncryptionService {
  private sessionValid = true;

  /**
   * Derives an AES-GCM 256-bit key from the authentication token and tenant ID.
   *
   * Uses PBKDF2 with:
   * - Input key material: UTF-8 encoding of `authToken + tenantId`
   * - Salt: SHA-256 hash of tenantId (deterministic per tenant)
   * - Iterations: 100,000
   * - Hash: SHA-256
   *
   * The resulting CryptoKey is extractable: false and usable for encrypt/decrypt.
   */
  async deriveKey(authToken: string, tenantId: string): Promise<CryptoKey> {
    const subtle = getSubtle();
    const encoder = new TextEncoder();

    // Import raw key material (authToken + tenantId combined)
    const keyMaterial = await subtle.importKey(
      'raw',
      encoder.encode(authToken + tenantId),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // Derive a deterministic salt from tenantId using SHA-256
    const salt = await subtle.digest('SHA-256', encoder.encode(tenantId));

    // Derive AES-GCM key using PBKDF2
    const derivedKey = await subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new Uint8Array(salt),
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return derivedKey;
  }

  /**
   * Encrypts a JSON-serializable payload using AES-GCM.
   *
   * Output format: [12-byte IV | ciphertext]
   * The IV is prepended to the ciphertext in the returned ArrayBuffer.
   *
   * Throws if the session is locked (expired/logged out).
   */
  async encrypt(data: Record<string, unknown>, key: CryptoKey): Promise<ArrayBuffer> {
    if (!this.sessionValid) {
      throw new Error(
        'Session expired. Re-authenticate before accessing encrypted data.'
      );
    }

    const subtle = getSubtle();
    const encoder = new TextEncoder();

    // Serialize payload to JSON bytes
    const plaintext = encoder.encode(JSON.stringify(data));

    // Generate a random 12-byte IV
    const iv = getRandomIV(IV_LENGTH);

    // Encrypt with AES-GCM
    const ciphertext = await subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintext
    );

    // Prepend IV to ciphertext: [IV (12 bytes) | ciphertext]
    const result = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(ciphertext), IV_LENGTH);

    return result.buffer;
  }

  /**
   * Decrypts an AES-GCM encrypted payload.
   *
   * Expects input format: [12-byte IV | ciphertext]
   * Returns the parsed JSON object.
   *
   * Throws if the session is locked (expired/logged out).
   * Throws if decryption fails (wrong key, tampered data).
   */
  async decrypt(encrypted: ArrayBuffer, key: CryptoKey): Promise<Record<string, unknown>> {
    if (!this.sessionValid) {
      throw new Error(
        'Session expired. Re-authenticate before accessing encrypted data.'
      );
    }

    const subtle = getSubtle();
    const decoder = new TextDecoder();

    const data = new Uint8Array(encrypted);

    if (data.byteLength <= IV_LENGTH) {
      throw new Error('Invalid encrypted data: too short to contain IV and ciphertext.');
    }

    // Extract IV (first 12 bytes)
    const iv = data.slice(0, IV_LENGTH);

    // Extract ciphertext (remainder)
    const ciphertext = data.slice(IV_LENGTH);

    // Decrypt with AES-GCM
    let plaintext: ArrayBuffer;
    try {
      plaintext = await subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );
    } catch {
      throw new Error(
        'Decryption failed. The key may be incorrect or the data may be corrupted.'
      );
    }

    // Parse JSON from decrypted bytes
    const json = decoder.decode(plaintext);
    return JSON.parse(json) as Record<string, unknown>;
  }

  /**
   * Checks whether the current session is valid (not expired/locked).
   * When false, encrypt/decrypt operations will be rejected.
   */
  isSessionValid(): boolean {
    return this.sessionValid;
  }

  /**
   * Locks the session (e.g., on logout or session expiry).
   * Encrypted data remains stored but cannot be accessed until re-authentication.
   */
  lockSession(): void {
    this.sessionValid = false;
  }

  /**
   * Unlocks the session after successful re-authentication.
   * Allows encrypt/decrypt operations to proceed again.
   */
  unlockSession(): void {
    this.sessionValid = true;
  }
}
