/**
 * Consistent error response types for all API routes.
 * Implements the ValidationError shape from the design document.
 */

// ─── Error Codes ─────────────────────────────────────────────────────────────

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

// ─── Validation Error Shape (from design doc) ────────────────────────────────

export interface ValidationErrorField {
  message: string;
  constraint: string; // e.g., "min_length", "max_length", "pattern"
}

export interface ValidationErrorResponse {
  code: 'VALIDATION_ERROR';
  message: string;
  fields: {
    [fieldName: string]: ValidationErrorField;
  };
}

// ─── Authentication Error ────────────────────────────────────────────────────

export interface AuthenticationErrorResponse {
  code: 'UNAUTHENTICATED';
  message: string;
  redirectTo?: string;
}

// ─── Authorization Error ─────────────────────────────────────────────────────

export interface AuthorizationErrorResponse {
  code: 'FORBIDDEN';
  message: string;
}

// ─── Conflict Error ──────────────────────────────────────────────────────────

export interface ConflictErrorResponse {
  code: 'CONFLICT';
  message: string;
  conflictingRecord?: {
    id: string;
    startDate: string;
    endDate: string;
  };
}

// ─── Rate Limit Error ────────────────────────────────────────────────────────

export interface RateLimitErrorResponse {
  code: 'RATE_LIMITED';
  message: string;
  retryAfter: number; // seconds
}

// ─── Internal Error ──────────────────────────────────────────────────────────

export interface InternalErrorResponse {
  code: 'INTERNAL_ERROR';
  message: string;
}

// ─── Union of all error responses ────────────────────────────────────────────

export type ApiErrorResponse =
  | ValidationErrorResponse
  | AuthenticationErrorResponse
  | AuthorizationErrorResponse
  | ConflictErrorResponse
  | RateLimitErrorResponse
  | InternalErrorResponse;
