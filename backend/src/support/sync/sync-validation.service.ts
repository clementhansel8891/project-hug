import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { EventEmitter } from 'events';
import {
  OperationEnvelope,
  OperationType,
  EnvelopeStatus,
} from './types';
import { TenantContext } from '../../gateway/tenant-context.interface';

/**
 * Describes a single field-level validation error.
 */
export interface ValidationError {
  field: string;
  reason: string;
}

/**
 * Result of validating an Operation_Envelope.
 */
export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: ValidationError[] };

/** Valid operation types for structural validation */
const VALID_OPERATION_TYPES: OperationType[] = [
  'pos_transaction',
  'inventory_adjustment',
  'stock_movement',
  'stock_deduction',
  'price_update',
  'customer_update',
];

/** Valid envelope statuses */
const VALID_STATUSES: EnvelopeStatus[] = [
  'pending',
  'syncing',
  'acknowledged',
  'failed',
];

/** UUID v4 pattern */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** ISO 8601 date-time validation */
function isValidISO8601(value: string): boolean {
  const date = new Date(value);
  return !isNaN(date.getTime()) && value === date.toISOString() || isISO8601Format(value);
}

/**
 * Checks common ISO 8601 formats beyond strict toISOString() output.
 * Accepts: YYYY-MM-DDTHH:mm:ss.sssZ, YYYY-MM-DDTHH:mm:ssZ,
 *          YYYY-MM-DDTHH:mm:ss±HH:MM, etc.
 */
function isISO8601Format(value: string): boolean {
  const iso8601Regex =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
  if (!iso8601Regex.test(value)) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Sync Validation Service
 *
 * Validates each Operation_Envelope for structural integrity before processing.
 * Checks presence and type correctness of all required fields, and validates
 * tenant_id matches the authenticated session's tenant.
 *
 * Requirements: 3.2, 3.9, 10.2, 10.3
 */
@Injectable()
export class SyncValidationService {
  private readonly logger = new Logger(SyncValidationService.name);

  constructor(
    @Optional() @Inject('SYNC_EVENT_EMITTER') private readonly eventEmitter?: EventEmitter,
  ) {}

  /**
   * Validates an Operation_Envelope for structural integrity and tenant authorization.
   *
   * @param envelope - The envelope to validate (may be partial/malformed)
   * @param tenantContext - The authenticated session's tenant context
   * @returns ValidationResult indicating success or field-specific errors
   */
  validate(
    envelope: Record<string, unknown>,
    tenantContext: TenantContext,
  ): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate id (UUID v4)
    this.validateId(envelope, errors);

    // Validate idempotencyKey (non-empty string)
    this.validateIdempotencyKey(envelope, errors);

    // Validate tenantId (non-empty string)
    this.validateTenantId(envelope, errors);

    // Validate branchId (non-empty string)
    this.validateBranchId(envelope, errors);

    // Validate locationId (non-empty string)
    this.validateLocationId(envelope, errors);

    // Validate sequenceNumber (positive integer)
    this.validateSequenceNumber(envelope, errors);

    // Validate sessionId (non-empty string)
    this.validateSessionId(envelope, errors);

    // Validate timestamp (valid ISO 8601)
    this.validateTimestamp(envelope, errors);

    // Validate vectorClock (Record<string, number>)
    this.validateVectorClock(envelope, errors);

    // Validate operationType (one of allowed values)
    this.validateOperationType(envelope, errors);

    // Validate payload (non-null, non-empty object)
    this.validatePayload(envelope, errors);

    // Validate status (one of allowed values)
    this.validateStatus(envelope, errors);

    // Validate tenant_id matches authenticated session (security check)
    // Only validate if tenantId is present and structurally valid
    if (
      typeof envelope.tenantId === 'string' &&
      envelope.tenantId.trim().length > 0
    ) {
      this.validateTenantMatch(envelope.tenantId as string, tenantContext, errors);
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true };
  }

  private validateId(
    envelope: Record<string, unknown>,
    errors: ValidationError[],
  ): void {
    if (envelope.id === undefined || envelope.id === null) {
      errors.push({ field: 'id', reason: 'id is required' });
      return;
    }
    if (typeof envelope.id !== 'string') {
      errors.push({ field: 'id', reason: 'id must be a string' });
      return;
    }
    if (!UUID_V4_REGEX.test(envelope.id)) {
      errors.push({ field: 'id', reason: 'id must be a valid UUID v4' });
    }
  }

  private validateIdempotencyKey(
    envelope: Record<string, unknown>,
    errors: ValidationError[],
  ): void {
    if (envelope.idempotencyKey === undefined || envelope.idempotencyKey === null) {
      errors.push({ field: 'idempotencyKey', reason: 'idempotencyKey is required' });
      return;
    }
    if (typeof envelope.idempotencyKey !== 'string') {
      errors.push({ field: 'idempotencyKey', reason: 'idempotencyKey must be a string' });
      return;
    }
    if (envelope.idempotencyKey.trim().length === 0) {
      errors.push({ field: 'idempotencyKey', reason: 'idempotencyKey must not be empty' });
    }
  }

  private validateTenantId(
    envelope: Record<string, unknown>,
    errors: ValidationError[],
  ): void {
    if (envelope.tenantId === undefined || envelope.tenantId === null) {
      errors.push({ field: 'tenantId', reason: 'tenantId is required' });
      return;
    }
    if (typeof envelope.tenantId !== 'string') {
      errors.push({ field: 'tenantId', reason: 'tenantId must be a string' });
      return;
    }
    if (envelope.tenantId.trim().length === 0) {
      errors.push({ field: 'tenantId', reason: 'tenantId must not be empty' });
    }
  }

  private validateBranchId(
    envelope: Record<string, unknown>,
    errors: ValidationError[],
  ): void {
    if (envelope.branchId === undefined || envelope.branchId === null) {
      errors.push({ field: 'branchId', reason: 'branchId is required' });
      return;
    }
    if (typeof envelope.branchId !== 'string') {
      errors.push({ field: 'branchId', reason: 'branchId must be a string' });
      return;
    }
    if (envelope.branchId.trim().length === 0) {
      errors.push({ field: 'branchId', reason: 'branchId must not be empty' });
    }
  }

  private validateLocationId(
    envelope: Record<string, unknown>,
    errors: ValidationError[],
  ): void {
    if (envelope.locationId === undefined || envelope.locationId === null) {
      errors.push({ field: 'locationId', reason: 'locationId is required' });
      return;
    }
    if (typeof envelope.locationId !== 'string') {
      errors.push({ field: 'locationId', reason: 'locationId must be a string' });
      return;
    }
    if (envelope.locationId.trim().length === 0) {
      errors.push({ field: 'locationId', reason: 'locationId must not be empty' });
    }
  }

  private validateSequenceNumber(
    envelope: Record<string, unknown>,
    errors: ValidationError[],
  ): void {
    if (envelope.sequenceNumber === undefined || envelope.sequenceNumber === null) {
      errors.push({ field: 'sequenceNumber', reason: 'sequenceNumber is required' });
      return;
    }
    if (typeof envelope.sequenceNumber !== 'number') {
      errors.push({ field: 'sequenceNumber', reason: 'sequenceNumber must be a number' });
      return;
    }
    if (!Number.isInteger(envelope.sequenceNumber) || envelope.sequenceNumber < 1) {
      errors.push({
        field: 'sequenceNumber',
        reason: 'sequenceNumber must be a positive integer',
      });
    }
  }

  private validateSessionId(
    envelope: Record<string, unknown>,
    errors: ValidationError[],
  ): void {
    if (envelope.sessionId === undefined || envelope.sessionId === null) {
      errors.push({ field: 'sessionId', reason: 'sessionId is required' });
      return;
    }
    if (typeof envelope.sessionId !== 'string') {
      errors.push({ field: 'sessionId', reason: 'sessionId must be a string' });
      return;
    }
    if (envelope.sessionId.trim().length === 0) {
      errors.push({ field: 'sessionId', reason: 'sessionId must not be empty' });
    }
  }

  private validateTimestamp(
    envelope: Record<string, unknown>,
    errors: ValidationError[],
  ): void {
    if (envelope.timestamp === undefined || envelope.timestamp === null) {
      errors.push({ field: 'timestamp', reason: 'timestamp is required' });
      return;
    }
    if (typeof envelope.timestamp !== 'string') {
      errors.push({ field: 'timestamp', reason: 'timestamp must be a string' });
      return;
    }
    if (!isValidISO8601(envelope.timestamp)) {
      errors.push({
        field: 'timestamp',
        reason: 'timestamp must be a valid ISO 8601 date-time string',
      });
    }
  }

  private validateVectorClock(
    envelope: Record<string, unknown>,
    errors: ValidationError[],
  ): void {
    if (envelope.vectorClock === undefined || envelope.vectorClock === null) {
      errors.push({ field: 'vectorClock', reason: 'vectorClock is required' });
      return;
    }
    if (
      typeof envelope.vectorClock !== 'object' ||
      Array.isArray(envelope.vectorClock)
    ) {
      errors.push({ field: 'vectorClock', reason: 'vectorClock must be an object' });
      return;
    }
    const clock = envelope.vectorClock as Record<string, unknown>;
    for (const [key, value] of Object.entries(clock)) {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        errors.push({
          field: 'vectorClock',
          reason: `vectorClock values must be non-negative integers, invalid value for key "${key}"`,
        });
        return;
      }
    }
  }

  private validateOperationType(
    envelope: Record<string, unknown>,
    errors: ValidationError[],
  ): void {
    if (envelope.operationType === undefined || envelope.operationType === null) {
      errors.push({ field: 'operationType', reason: 'operationType is required' });
      return;
    }
    if (typeof envelope.operationType !== 'string') {
      errors.push({ field: 'operationType', reason: 'operationType must be a string' });
      return;
    }
    if (!VALID_OPERATION_TYPES.includes(envelope.operationType as OperationType)) {
      errors.push({
        field: 'operationType',
        reason: `operationType must be one of: ${VALID_OPERATION_TYPES.join(', ')}`,
      });
    }
  }

  private validatePayload(
    envelope: Record<string, unknown>,
    errors: ValidationError[],
  ): void {
    if (envelope.payload === undefined || envelope.payload === null) {
      errors.push({ field: 'payload', reason: 'payload is required' });
      return;
    }
    if (
      typeof envelope.payload !== 'object' ||
      Array.isArray(envelope.payload)
    ) {
      errors.push({ field: 'payload', reason: 'payload must be a non-null object' });
      return;
    }
    if (Object.keys(envelope.payload as object).length === 0) {
      errors.push({ field: 'payload', reason: 'payload must not be empty' });
    }
  }

  private validateStatus(
    envelope: Record<string, unknown>,
    errors: ValidationError[],
  ): void {
    if (envelope.status === undefined || envelope.status === null) {
      errors.push({ field: 'status', reason: 'status is required' });
      return;
    }
    if (typeof envelope.status !== 'string') {
      errors.push({ field: 'status', reason: 'status must be a string' });
      return;
    }
    if (!VALID_STATUSES.includes(envelope.status as EnvelopeStatus)) {
      errors.push({
        field: 'status',
        reason: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }
  }

  /**
   * Validates that the envelope's tenantId matches the authenticated session.
   * This is a security check per Requirements 10.2, 10.3.
   */
  private validateTenantMatch(
    envelopeTenantId: string,
    tenantContext: TenantContext,
    errors: ValidationError[],
  ): void {
    if (envelopeTenantId !== tenantContext.tenant_id) {
      this.logger.warn(
        `Tenant mismatch: envelope tenantId="${envelopeTenantId}" does not match ` +
          `authenticated tenant_id="${tenantContext.tenant_id}"`,
      );

      // Emit security event for tenant mismatch detection
      this.eventEmitter?.emit('security_tenant_mismatch', {
        envelopeTenantId,
        authenticatedTenantId: tenantContext.tenant_id,
        userId: tenantContext.user_id ?? 'unknown',
        timestamp: new Date().toISOString(),
      });

      errors.push({
        field: 'tenantId',
        reason:
          'tenantId does not match authenticated session tenant (security violation)',
      });
    }
  }
}
