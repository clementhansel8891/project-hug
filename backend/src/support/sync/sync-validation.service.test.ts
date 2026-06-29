import { describe, it, expect, beforeEach } from 'vitest';
import { SyncValidationService, ValidationResult } from './sync-validation.service';
import { TenantContext } from '../../gateway/tenant-context.interface';

describe('SyncValidationService', () => {
  let service: SyncValidationService;
  let tenantContext: TenantContext;

  beforeEach(() => {
    service = new SyncValidationService();
    tenantContext = {
      tenant_id: 'tenant-001',
      company_id: 'company-001',
      branch_id: 'branch-001',
      location_id: 'location-001',
    };
  });

  function validEnvelope(): Record<string, unknown> {
    return {
      id: '550e8400-e29b-41d4-a716-446655440000',
      idempotencyKey: 'idem-key-12345',
      tenantId: 'tenant-001',
      branchId: 'branch-001',
      locationId: 'location-001',
      sequenceNumber: 1,
      sessionId: 'session-abc',
      timestamp: '2024-01-15T10:30:00.000Z',
      vectorClock: { 'location-001': 1 },
      operationType: 'pos_transaction',
      payload: { amount: 100, productId: 'prod-1' },
      status: 'pending',
    };
  }

  describe('valid envelope', () => {
    it('accepts a fully valid envelope', () => {
      const result = service.validate(validEnvelope(), tenantContext);
      expect(result).toEqual({ valid: true });
    });

    it('accepts envelope with empty vectorClock (no entries)', () => {
      const envelope = validEnvelope();
      envelope.vectorClock = {};
      const result = service.validate(envelope, tenantContext);
      expect(result).toEqual({ valid: true });
    });

    it('accepts all valid operation types', () => {
      const types = [
        'pos_transaction',
        'inventory_adjustment',
        'stock_movement',
        'stock_deduction',
        'price_update',
        'customer_update',
      ];
      for (const type of types) {
        const envelope = validEnvelope();
        envelope.operationType = type;
        const result = service.validate(envelope, tenantContext);
        expect(result).toEqual({ valid: true });
      }
    });

    it('accepts all valid statuses', () => {
      const statuses = ['pending', 'syncing', 'acknowledged', 'failed'];
      for (const status of statuses) {
        const envelope = validEnvelope();
        envelope.status = status;
        const result = service.validate(envelope, tenantContext);
        expect(result).toEqual({ valid: true });
      }
    });
  });

  describe('id validation', () => {
    it('rejects missing id', () => {
      const envelope = validEnvelope();
      delete envelope.id;
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'id',
          reason: 'id is required',
        });
      }
    });

    it('rejects non-string id', () => {
      const envelope = validEnvelope();
      envelope.id = 123;
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'id',
          reason: 'id must be a string',
        });
      }
    });

    it('rejects non-UUID v4 id', () => {
      const envelope = validEnvelope();
      envelope.id = 'not-a-uuid';
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'id',
          reason: 'id must be a valid UUID v4',
        });
      }
    });
  });

  describe('idempotencyKey validation', () => {
    it('rejects missing idempotencyKey', () => {
      const envelope = validEnvelope();
      delete envelope.idempotencyKey;
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'idempotencyKey',
          reason: 'idempotencyKey is required',
        });
      }
    });

    it('rejects empty idempotencyKey', () => {
      const envelope = validEnvelope();
      envelope.idempotencyKey = '   ';
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'idempotencyKey',
          reason: 'idempotencyKey must not be empty',
        });
      }
    });
  });

  describe('tenantId validation', () => {
    it('rejects missing tenantId', () => {
      const envelope = validEnvelope();
      delete envelope.tenantId;
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'tenantId',
          reason: 'tenantId is required',
        });
      }
    });

    it('rejects non-string tenantId', () => {
      const envelope = validEnvelope();
      envelope.tenantId = 42;
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'tenantId',
          reason: 'tenantId must be a string',
        });
      }
    });

    it('rejects empty tenantId', () => {
      const envelope = validEnvelope();
      envelope.tenantId = '';
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'tenantId',
          reason: 'tenantId must not be empty',
        });
      }
    });
  });

  describe('branchId validation', () => {
    it('rejects missing branchId', () => {
      const envelope = validEnvelope();
      delete envelope.branchId;
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'branchId',
          reason: 'branchId is required',
        });
      }
    });
  });

  describe('locationId validation', () => {
    it('rejects missing locationId', () => {
      const envelope = validEnvelope();
      delete envelope.locationId;
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'locationId',
          reason: 'locationId is required',
        });
      }
    });
  });

  describe('sequenceNumber validation', () => {
    it('rejects missing sequenceNumber', () => {
      const envelope = validEnvelope();
      delete envelope.sequenceNumber;
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'sequenceNumber',
          reason: 'sequenceNumber is required',
        });
      }
    });

    it('rejects non-number sequenceNumber', () => {
      const envelope = validEnvelope();
      envelope.sequenceNumber = 'abc';
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'sequenceNumber',
          reason: 'sequenceNumber must be a number',
        });
      }
    });

    it('rejects zero sequenceNumber', () => {
      const envelope = validEnvelope();
      envelope.sequenceNumber = 0;
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'sequenceNumber',
          reason: 'sequenceNumber must be a positive integer',
        });
      }
    });

    it('rejects negative sequenceNumber', () => {
      const envelope = validEnvelope();
      envelope.sequenceNumber = -5;
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'sequenceNumber',
          reason: 'sequenceNumber must be a positive integer',
        });
      }
    });

    it('rejects fractional sequenceNumber', () => {
      const envelope = validEnvelope();
      envelope.sequenceNumber = 1.5;
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'sequenceNumber',
          reason: 'sequenceNumber must be a positive integer',
        });
      }
    });
  });

  describe('sessionId validation', () => {
    it('rejects missing sessionId', () => {
      const envelope = validEnvelope();
      delete envelope.sessionId;
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'sessionId',
          reason: 'sessionId is required',
        });
      }
    });
  });

  describe('timestamp validation', () => {
    it('rejects missing timestamp', () => {
      const envelope = validEnvelope();
      delete envelope.timestamp;
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'timestamp',
          reason: 'timestamp is required',
        });
      }
    });

    it('rejects non-string timestamp', () => {
      const envelope = validEnvelope();
      envelope.timestamp = 12345;
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'timestamp',
          reason: 'timestamp must be a string',
        });
      }
    });

    it('rejects invalid timestamp format', () => {
      const envelope = validEnvelope();
      envelope.timestamp = 'not-a-date';
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'timestamp',
          reason: 'timestamp must be a valid ISO 8601 date-time string',
        });
      }
    });

    it('accepts valid ISO 8601 timestamps with timezone offset', () => {
      const envelope = validEnvelope();
      envelope.timestamp = '2024-01-15T10:30:00+07:00';
      const result = service.validate(envelope, tenantContext);
      expect(result).toEqual({ valid: true });
    });
  });

  describe('vectorClock validation', () => {
    it('rejects missing vectorClock', () => {
      const envelope = validEnvelope();
      delete envelope.vectorClock;
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'vectorClock',
          reason: 'vectorClock is required',
        });
      }
    });

    it('rejects array vectorClock', () => {
      const envelope = validEnvelope();
      envelope.vectorClock = [1, 2, 3];
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'vectorClock',
          reason: 'vectorClock must be an object',
        });
      }
    });

    it('rejects vectorClock with non-integer values', () => {
      const envelope = validEnvelope();
      envelope.vectorClock = { 'loc-1': 1.5 };
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.field === 'vectorClock')).toBe(true);
      }
    });

    it('rejects vectorClock with negative values', () => {
      const envelope = validEnvelope();
      envelope.vectorClock = { 'loc-1': -1 };
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.field === 'vectorClock')).toBe(true);
      }
    });
  });

  describe('operationType validation', () => {
    it('rejects missing operationType', () => {
      const envelope = validEnvelope();
      delete envelope.operationType;
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'operationType',
          reason: 'operationType is required',
        });
      }
    });

    it('rejects invalid operationType', () => {
      const envelope = validEnvelope();
      envelope.operationType = 'invalid_op';
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.field === 'operationType')).toBe(true);
      }
    });
  });

  describe('payload validation', () => {
    it('rejects missing payload', () => {
      const envelope = validEnvelope();
      delete envelope.payload;
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'payload',
          reason: 'payload is required',
        });
      }
    });

    it('rejects null payload', () => {
      const envelope = validEnvelope();
      envelope.payload = null;
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'payload',
          reason: 'payload is required',
        });
      }
    });

    it('rejects empty payload object', () => {
      const envelope = validEnvelope();
      envelope.payload = {};
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'payload',
          reason: 'payload must not be empty',
        });
      }
    });

    it('rejects array payload', () => {
      const envelope = validEnvelope();
      envelope.payload = [1, 2, 3];
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'payload',
          reason: 'payload must be a non-null object',
        });
      }
    });
  });

  describe('status validation', () => {
    it('rejects missing status', () => {
      const envelope = validEnvelope();
      delete envelope.status;
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'status',
          reason: 'status is required',
        });
      }
    });

    it('rejects invalid status value', () => {
      const envelope = validEnvelope();
      envelope.status = 'unknown';
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.field === 'status')).toBe(true);
      }
    });
  });

  describe('tenant match validation (security)', () => {
    it('rejects envelope with mismatched tenantId', () => {
      const envelope = validEnvelope();
      envelope.tenantId = 'different-tenant';
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          field: 'tenantId',
          reason:
            'tenantId does not match authenticated session tenant (security violation)',
        });
      }
    });

    it('accepts envelope with matching tenantId', () => {
      const envelope = validEnvelope();
      envelope.tenantId = 'tenant-001';
      const result = service.validate(envelope, tenantContext);
      expect(result).toEqual({ valid: true });
    });
  });

  describe('multiple errors', () => {
    it('returns all errors for a completely empty envelope', () => {
      const result = service.validate({}, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        // Should have errors for all required fields
        const fields = result.errors.map((e) => e.field);
        expect(fields).toContain('id');
        expect(fields).toContain('idempotencyKey');
        expect(fields).toContain('tenantId');
        expect(fields).toContain('branchId');
        expect(fields).toContain('locationId');
        expect(fields).toContain('sequenceNumber');
        expect(fields).toContain('sessionId');
        expect(fields).toContain('timestamp');
        expect(fields).toContain('vectorClock');
        expect(fields).toContain('operationType');
        expect(fields).toContain('payload');
        expect(fields).toContain('status');
      }
    });

    it('returns multiple errors when several fields are invalid', () => {
      const envelope = validEnvelope();
      envelope.sequenceNumber = -1;
      envelope.timestamp = 'bad';
      envelope.payload = {};
      const result = service.validate(envelope, tenantContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThanOrEqual(3);
      }
    });
  });
});
