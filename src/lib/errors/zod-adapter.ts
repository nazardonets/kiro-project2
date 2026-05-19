import type { ZodError } from 'zod';

import { ValidationError } from './errors';
import type { ValidationErrorField } from './types';

/**
 * Mapping from Zod issue codes to human-readable constraint names.
 */
const ZOD_CODE_TO_CONSTRAINT: Record<string, string> = {
  too_small: 'min_length',
  too_big: 'max_length',
  invalid_type: 'type',
  invalid_string: 'pattern',
  invalid_enum_value: 'enum',
  custom: 'custom',
  invalid_union: 'union',
  invalid_date: 'date',
  invalid_literal: 'literal',
};

/**
 * Converts a ZodError into the application's ValidationError shape.
 *
 * Maps each Zod issue to a field-specific error with a human-readable
 * constraint name. When multiple issues exist for the same field,
 * the first issue takes precedence.
 *
 * @param zodError - The ZodError from a failed schema parse
 * @param message - Optional custom message (defaults to "Validation failed")
 * @returns A ValidationError instance ready to be thrown
 */
export function fromZodError(zodError: ZodError, message = 'Validation failed'): ValidationError {
  const fields: Record<string, ValidationErrorField> = {};

  for (const issue of zodError.issues) {
    const fieldPath = issue.path.length > 0 ? issue.path.join('.') : '_root';

    // Only keep the first error per field
    if (fields[fieldPath]) continue;

    let constraint = ZOD_CODE_TO_CONSTRAINT[issue.code] ?? issue.code;

    // Refine constraint based on Zod issue details
    if (issue.code === 'too_small') {
      constraint = 'min_length';
    } else if (issue.code === 'too_big') {
      constraint = 'max_length';
    } else if (issue.code === 'invalid_string') {
      // Zod v4 uses `validation` for string checks
      const validation = (issue as Record<string, unknown>).validation;
      if (validation === 'email') {
        constraint = 'email';
      } else if (validation === 'url') {
        constraint = 'url';
      } else if (validation === 'uuid') {
        constraint = 'uuid';
      } else if (validation === 'regex') {
        constraint = 'pattern';
      } else {
        constraint = 'pattern';
      }
    }

    fields[fieldPath] = {
      message: issue.message,
      constraint,
    };
  }

  return new ValidationError(message, fields);
}

/**
 * Validates input against a Zod schema and throws a ValidationError on failure.
 * Returns the parsed (typed) data on success.
 *
 * @param schema - A Zod schema with a `safeParse` method
 * @param data - The raw input data to validate
 * @param message - Optional custom error message
 * @returns The parsed and validated data
 * @throws ValidationError if validation fails
 */
export function validateOrThrow<T>(
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: ZodError } },
  data: unknown,
  message?: string,
): T {
  const result = schema.safeParse(data);
  if (!result.success && result.error) {
    throw fromZodError(result.error, message);
  }
  if (!result.success) {
    throw new ValidationError(message ?? 'Validation failed', {});
  }
  return result.data as T;
}
