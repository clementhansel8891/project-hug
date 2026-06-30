import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';

/**
 * GlobalValidationPipe
 *
 * Validates incoming DTOs using class-validator decorators.
 * Returns structured 400 errors with { message, errors: [{ field, message }] }
 * Handles unexpected errors with 500 response (generic message, logs stack trace server-side)
 *
 * Validates: Requirements 16.2, 16.3, 16.4
 */
@Injectable()
export class GlobalValidationPipe implements PipeTransform {
  private readonly logger = new Logger(GlobalValidationPipe.name);

  async transform(value: any, metadata: ArgumentMetadata) {
    const { metatype } = metadata;

    // Skip validation for primitives and types without class-validator decorators
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // A missing body/value (e.g. a request with no JSON body, or a multipart
    // request with only a file and no fields) arrives as undefined/null.
    // class-validator throws on a non-object, so normalize to an empty object:
    // required-field constraints then surface as a clean 400 instead of a 500.
    const toCheck = value === undefined || value === null ? {} : value;

    try {
      // Transform plain object to class instance
      const object = plainToInstance(metatype, toCheck, {
        enableImplicitConversion: true,
      });

      // Validate using class-validator
      const validationErrors = await validate(object, {
        whitelist: true,
        forbidNonWhitelisted: false,
        skipMissingProperties: false,
      });

      if (validationErrors.length > 0) {
        const errors = this.flattenValidationErrors(validationErrors);

        throw new BadRequestException({
          message: 'Validation failed',
          errors,
        });
      }

      // Return the transformed object (class instance with type conversions applied)
      return object;
    } catch (error) {
      // Re-throw HttpExceptions (including our own BadRequestException above)
      if (error instanceof HttpException) {
        throw error;
      }

      // Unexpected error: log stack trace server-side, return generic 500
      this.logger.error(
        `Unexpected validation error: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new HttpException(
        {
          message: 'Internal server error',
        },
        500,
      );
    }
  }

  /**
   * Recursively flatten validation errors into { field, message } pairs.
   * Supports nested object validation with dot-notation field names.
   */
  private flattenValidationErrors(
    errors: ValidationError[],
    parentPath = '',
  ): Array<{ field: string; message: string }> {
    const result: Array<{ field: string; message: string }> = [];

    for (const error of errors) {
      const fieldPath = parentPath
        ? `${parentPath}.${error.property}`
        : error.property;

      // Add constraint messages for this field
      if (error.constraints) {
        const messages = Object.values(error.constraints);
        for (const message of messages) {
          result.push({ field: fieldPath, message });
        }
      }

      // Recurse into nested validation errors (children)
      if (error.children && error.children.length > 0) {
        const nestedErrors = this.flattenValidationErrors(
          error.children,
          fieldPath,
        );
        result.push(...nestedErrors);
      }
    }

    return result;
  }

  /**
   * Check if the metatype requires validation.
   * Skips native JavaScript types that cannot have class-validator decorators.
   */
  private toValidate(metatype: Function): boolean {
    const nativeTypes: Function[] = [String, Boolean, Number, Array, Object];
    return !nativeTypes.includes(metatype);
  }
}
