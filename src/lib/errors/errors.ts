import type { ValidationErrorField } from './types';

/**
 * Base class for all application errors.
 * Provides a consistent structure for error handling across API routes.
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * 400 - Validation errors with field-specific messages.
 * Matches the ValidationError shape from the design document.
 */
export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
  readonly fields: Record<string, ValidationErrorField>;

  constructor(message: string, fields: Record<string, ValidationErrorField>) {
    super(message);
    this.fields = fields;
  }
}

/**
 * 401 - Authentication errors (session expired or invalid).
 * Includes optional redirect path for client-side navigation.
 */
export class AuthenticationError extends AppError {
  readonly statusCode = 401;
  readonly code = 'UNAUTHENTICATED';
  readonly redirectTo: string;

  constructor(message = 'Session expired. Please log in again.', redirectTo = '/auth/login') {
    super(message);
    this.redirectTo = redirectTo;
  }
}

/**
 * 403 - Authorization errors with role-appropriate messages.
 * Used when a user lacks permission for a specific action.
 */
export class AuthorizationError extends AppError {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN';

  constructor(message = 'You do not have permission to perform this action.') {
    super(message);
  }

  /**
   * Factory for cycle data modification attempts by non-primary users.
   */
  static cycleDataModification(): AuthorizationError {
    return new AuthorizationError('Only the Primary_User can modify Cycle_Data.');
  }

  /**
   * Factory for admin-only resource access.
   */
  static adminOnly(): AuthorizationError {
    return new AuthorizationError('Only admin users can access this resource.');
  }

  /**
   * Factory for primary-user-only actions.
   */
  static primaryOnly(): AuthorizationError {
    return new AuthorizationError('Only the Primary_User can perform this action.');
  }
}

/**
 * 404 - Resource not found.
 */
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';

  constructor(message = 'The requested resource was not found.') {
    super(message);
  }
}

/**
 * 409 - Conflict errors, primarily for cycle overlap detection.
 * Includes details about the conflicting record when available.
 */
export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';
  readonly conflictingRecord?: {
    id: string;
    startDate: string;
    endDate: string;
  };

  constructor(
    message = 'A conflict was detected with an existing record.',
    conflictingRecord?: { id: string; startDate: string; endDate: string },
  ) {
    super(message);
    this.conflictingRecord = conflictingRecord;
  }

  /**
   * Factory for cycle overlap conflicts.
   */
  static cycleOverlap(conflictingRecord: {
    id: string;
    startDate: string;
    endDate: string;
  }): ConflictError {
    return new ConflictError(
      `Cycle dates overlap with an existing cycle (${conflictingRecord.startDate} – ${conflictingRecord.endDate}).`,
      conflictingRecord,
    );
  }
}

/**
 * 429 - Rate limit errors with retry-after information.
 */
export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly code = 'RATE_LIMITED';
  readonly retryAfter: number; // seconds

  constructor(retryAfter = 60, message?: string) {
    super(message ?? `Too many requests. Please try again in ${retryAfter} seconds.`);
    this.retryAfter = retryAfter;
  }
}

/**
 * 500 - Internal server errors.
 * The original error is preserved for server-side logging but not exposed to clients.
 */
export class InternalError extends AppError {
  readonly statusCode = 500;
  readonly code = 'INTERNAL_ERROR';
  readonly originalError?: unknown;

  constructor(message = 'Something went wrong. Please try again.', originalError?: unknown) {
    super(message);
    this.originalError = originalError;
  }
}
