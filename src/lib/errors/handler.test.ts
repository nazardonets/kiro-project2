import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  InternalError,
  RateLimitError,
  ValidationError,
} from './errors';
import { withErrorHandling } from './handler';

function createMockRequest(path = '/api/test', method = 'GET'): NextRequest {
  return new NextRequest(new URL(path, 'http://localhost:3000'), { method });
}

describe('withErrorHandling', () => {
  it('passes through successful responses unchanged', async () => {
    const handler = withErrorHandling(async () => {
      return NextResponse.json({ data: 'success' }, { status: 200 });
    });

    const response = await handler(createMockRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toBe('success');
  });

  it('handles ValidationError with 400 and field details', async () => {
    const handler = withErrorHandling(async () => {
      throw new ValidationError('Invalid input', {
        email: { message: 'Email is required', constraint: 'min_length' },
      });
    });

    const response = await handler(createMockRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('Invalid input');
    expect(body.fields.email.message).toBe('Email is required');
    expect(body.fields.email.constraint).toBe('min_length');
  });

  it('handles AuthenticationError with 401 and redirect', async () => {
    const handler = withErrorHandling(async () => {
      throw new AuthenticationError();
    });

    const response = await handler(createMockRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe('UNAUTHENTICATED');
    expect(body.message).toBe('Session expired. Please log in again.');
    expect(body.redirectTo).toBe('/auth/login');
  });

  it('handles AuthorizationError with 403', async () => {
    const handler = withErrorHandling(async () => {
      throw AuthorizationError.cycleDataModification();
    });

    const response = await handler(createMockRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
    expect(body.message).toBe('Only the Primary_User can modify Cycle_Data.');
  });

  it('handles ConflictError with 409 and conflicting record', async () => {
    const conflicting = { id: 'abc', startDate: '2024-01-01', endDate: '2024-01-28' };
    const handler = withErrorHandling(async () => {
      throw ConflictError.cycleOverlap(conflicting);
    });

    const response = await handler(createMockRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('CONFLICT');
    expect(body.conflictingRecord).toEqual(conflicting);
    expect(body.message).toContain('2024-01-01');
  });

  it('handles RateLimitError with 429 and Retry-After header', async () => {
    const handler = withErrorHandling(async () => {
      throw new RateLimitError(30);
    });

    const response = await handler(createMockRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.retryAfter).toBe(30);
    expect(response.headers.get('Retry-After')).toBe('30');
  });

  it('handles InternalError with 500 and generic message', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const originalError = new Error('DB connection failed');
    const handler = withErrorHandling(async () => {
      throw new InternalError('Something went wrong. Please try again.', originalError);
    });

    const response = await handler(createMockRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('Something went wrong. Please try again.');
    // Should not expose original error details
    expect(body.originalError).toBeUndefined();

    // Should log the original error server-side
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('handles unknown errors with 500 and logs them', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const handler = withErrorHandling(async () => {
      throw new Error('Unexpected failure');
    });

    const response = await handler(createMockRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('Something went wrong. Please try again.');

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('handles non-Error thrown values', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const handler = withErrorHandling(async () => {
      throw 'string error'; // eslint-disable-line no-throw-literal
    });

    const response = await handler(createMockRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');

    consoleSpy.mockRestore();
  });

  it('passes request context to the handler', async () => {
    const handler = withErrorHandling(async (request, context) => {
      return NextResponse.json({
        path: request.nextUrl.pathname,
        params: context?.params,
      });
    });

    const response = await handler(createMockRequest('/api/users/123'), {
      params: { id: '123' },
    });
    const body = await response.json();

    expect(body.path).toBe('/api/users/123');
    expect(body.params).toEqual({ id: '123' });
  });
});
