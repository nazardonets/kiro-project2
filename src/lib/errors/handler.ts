import { NextRequest, NextResponse } from 'next/server';

import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  InternalError,
  RateLimitError,
  ValidationError,
} from './errors';
import type { ApiErrorResponse } from './types';

/**
 * Type for Next.js App Router route handler functions.
 */
type RouteHandler = (
  request: NextRequest,
  context?: { params: Record<string, string> },
) => Promise<NextResponse>;

/**
 * Converts an AppError into a structured JSON response.
 */
function errorToResponse(error: AppError): NextResponse {
  if (error instanceof ValidationError) {
    const body: ApiErrorResponse = {
      code: 'VALIDATION_ERROR',
      message: error.message,
      fields: error.fields,
    };
    return NextResponse.json(body, { status: error.statusCode });
  }

  if (error instanceof AuthenticationError) {
    const body: ApiErrorResponse = {
      code: 'UNAUTHENTICATED',
      message: error.message,
      redirectTo: error.redirectTo,
    };
    return NextResponse.json(body, { status: error.statusCode });
  }

  if (error instanceof AuthorizationError) {
    const body: ApiErrorResponse = {
      code: 'FORBIDDEN',
      message: error.message,
    };
    return NextResponse.json(body, { status: error.statusCode });
  }

  if (error instanceof ConflictError) {
    const body: ApiErrorResponse = {
      code: 'CONFLICT',
      message: error.message,
      conflictingRecord: error.conflictingRecord,
    };
    return NextResponse.json(body, { status: error.statusCode });
  }

  if (error instanceof RateLimitError) {
    const body: ApiErrorResponse = {
      code: 'RATE_LIMITED',
      message: error.message,
      retryAfter: error.retryAfter,
    };
    return NextResponse.json(body, {
      status: error.statusCode,
      headers: {
        'Retry-After': String(error.retryAfter),
      },
    });
  }

  // InternalError or any other AppError subclass
  const body: ApiErrorResponse = {
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong. Please try again.',
  };
  return NextResponse.json(body, { status: error.statusCode });
}

/**
 * Higher-order function that wraps an API route handler with consistent error handling.
 *
 * Catches any thrown errors and converts them to appropriate JSON responses:
 * - AppError subclasses → structured error response with correct status code
 * - Unknown errors → 500 with generic message + server-side logging
 *
 * Usage:
 * ```ts
 * export const GET = withErrorHandling(async (request) => {
 *   const data = validateOrThrow(schema, input);
 *   // ... business logic
 *   return NextResponse.json({ data });
 * });
 * ```
 */
export function withErrorHandling(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: { params: Record<string, string> }) => {
    try {
      return await handler(request, context);
    } catch (error: unknown) {
      // Known application errors
      if (error instanceof AppError) {
        // Log internal errors server-side
        if (error instanceof InternalError && error.originalError) {
          console.error('[API Error]', {
            code: error.code,
            message: error.message,
            path: request.nextUrl.pathname,
            method: request.method,
            originalError: error.originalError,
          });
        }
        return errorToResponse(error);
      }

      // Unknown/unexpected errors — log and return generic 500
      console.error('[Unhandled API Error]', {
        path: request.nextUrl.pathname,
        method: request.method,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      const body: ApiErrorResponse = {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      };
      return NextResponse.json(body, { status: 500 });
    }
  };
}
