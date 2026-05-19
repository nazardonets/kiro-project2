// Error types
export type {
  ApiErrorResponse,
  AuthenticationErrorResponse,
  AuthorizationErrorResponse,
  ConflictErrorResponse,
  ErrorCode,
  InternalErrorResponse,
  RateLimitErrorResponse,
  ValidationErrorField,
  ValidationErrorResponse,
} from './types';

// Error classes
export {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  InternalError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from './errors';

// Zod integration
export { fromZodError, validateOrThrow } from './zod-adapter';

// Route handler wrapper
export { withErrorHandling } from './handler';
