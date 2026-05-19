import { describe, expect, it } from 'vitest';

import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  InternalError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from './errors';

describe('Error Classes', () => {
  describe('ValidationError', () => {
    it('creates a 400 error with field-specific messages', () => {
      const error = new ValidationError('Validation failed', {
        email: { message: 'Email is required', constraint: 'min_length' },
        password: { message: 'Must contain uppercase letter', constraint: 'pattern' },
      });

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Validation failed');
      expect(error.fields.email.message).toBe('Email is required');
      expect(error.fields.email.constraint).toBe('min_length');
      expect(error.fields.password.constraint).toBe('pattern');
    });

    it('is an instance of AppError', () => {
      const error = new ValidationError('test', {});
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('AuthenticationError', () => {
    it('creates a 401 error with default message and redirect', () => {
      const error = new AuthenticationError();

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHENTICATED');
      expect(error.message).toBe('Session expired. Please log in again.');
      expect(error.redirectTo).toBe('/auth/login');
    });

    it('accepts custom message and redirect path', () => {
      const error = new AuthenticationError('Token invalid', '/login');

      expect(error.message).toBe('Token invalid');
      expect(error.redirectTo).toBe('/login');
    });
  });

  describe('AuthorizationError', () => {
    it('creates a 403 error with default message', () => {
      const error = new AuthorizationError();

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.message).toBe('You do not have permission to perform this action.');
    });

    it('cycleDataModification factory returns role-appropriate message', () => {
      const error = AuthorizationError.cycleDataModification();

      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Only the Primary_User can modify Cycle_Data.');
    });

    it('adminOnly factory returns admin-specific message', () => {
      const error = AuthorizationError.adminOnly();

      expect(error.message).toBe('Only admin users can access this resource.');
    });

    it('primaryOnly factory returns primary-user-specific message', () => {
      const error = AuthorizationError.primaryOnly();

      expect(error.message).toBe('Only the Primary_User can perform this action.');
    });
  });

  describe('NotFoundError', () => {
    it('creates a 404 error with default message', () => {
      const error = new NotFoundError();

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('The requested resource was not found.');
    });

    it('accepts custom message', () => {
      const error = new NotFoundError('Cycle record not found');
      expect(error.message).toBe('Cycle record not found');
    });
  });

  describe('ConflictError', () => {
    it('creates a 409 error with conflicting record info', () => {
      const conflicting = {
        id: 'abc-123',
        startDate: '2024-01-01',
        endDate: '2024-01-28',
      };
      const error = new ConflictError('Cycle overlap detected', conflicting);

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
      expect(error.conflictingRecord).toEqual(conflicting);
    });

    it('cycleOverlap factory includes date range in message', () => {
      const conflicting = {
        id: 'xyz-789',
        startDate: '2024-03-01',
        endDate: '2024-03-28',
      };
      const error = ConflictError.cycleOverlap(conflicting);

      expect(error.statusCode).toBe(409);
      expect(error.message).toContain('2024-03-01');
      expect(error.message).toContain('2024-03-28');
      expect(error.conflictingRecord).toEqual(conflicting);
    });
  });

  describe('RateLimitError', () => {
    it('creates a 429 error with default retry-after of 60 seconds', () => {
      const error = new RateLimitError();

      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMITED');
      expect(error.retryAfter).toBe(60);
      expect(error.message).toContain('60 seconds');
    });

    it('accepts custom retry-after value', () => {
      const error = new RateLimitError(120);

      expect(error.retryAfter).toBe(120);
      expect(error.message).toContain('120 seconds');
    });

    it('accepts custom message', () => {
      const error = new RateLimitError(30, 'Slow down');

      expect(error.retryAfter).toBe(30);
      expect(error.message).toBe('Slow down');
    });
  });

  describe('InternalError', () => {
    it('creates a 500 error with generic message', () => {
      const error = new InternalError();

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.message).toBe('Something went wrong. Please try again.');
    });

    it('preserves original error for logging', () => {
      const original = new Error('DB connection failed');
      const error = new InternalError('Something went wrong. Please try again.', original);

      expect(error.originalError).toBe(original);
    });
  });
});
