import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ValidationError } from './errors';
import { fromZodError, validateOrThrow } from './zod-adapter';

describe('Zod Adapter', () => {
  describe('fromZodError', () => {
    it('converts a ZodError with too_small issue to min_length constraint', () => {
      const schema = z.object({
        password: z.string().min(8, 'Password must be at least 8 characters'),
      });

      const result = schema.safeParse({ password: 'short' });
      expect(result.success).toBe(false);

      if (!result.success) {
        const error = fromZodError(result.error);

        expect(error).toBeInstanceOf(ValidationError);
        expect(error.statusCode).toBe(400);
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.fields.password).toBeDefined();
        expect(error.fields.password.constraint).toBe('min_length');
        expect(error.fields.password.message).toBe('Password must be at least 8 characters');
      }
    });

    it('converts a ZodError with too_big issue to max_length constraint', () => {
      const schema = z.object({
        name: z.string().max(50, 'Name too long'),
      });

      const result = schema.safeParse({ name: 'a'.repeat(51) });
      expect(result.success).toBe(false);

      if (!result.success) {
        const error = fromZodError(result.error);

        expect(error.fields.name.constraint).toBe('max_length');
        expect(error.fields.name.message).toBe('Name too long');
      }
    });

    it('converts invalid_type issues', () => {
      const schema = z.object({
        age: z.number(),
      });

      const result = schema.safeParse({ age: 'not a number' });
      expect(result.success).toBe(false);

      if (!result.success) {
        const error = fromZodError(result.error);

        expect(error.fields.age).toBeDefined();
        expect(error.fields.age.constraint).toBe('type');
      }
    });

    it('handles multiple field errors', () => {
      const schema = z.object({
        email: z.string().min(1, 'Email is required'),
        password: z.string().min(8, 'Password too short'),
      });

      const result = schema.safeParse({ email: '', password: 'abc' });
      expect(result.success).toBe(false);

      if (!result.success) {
        const error = fromZodError(result.error);

        expect(Object.keys(error.fields).length).toBe(2);
        expect(error.fields.email).toBeDefined();
        expect(error.fields.password).toBeDefined();
      }
    });

    it('uses first error when multiple issues exist for same field', () => {
      const schema = z.object({
        password: z.string().min(8, 'Too short').max(128, 'Too long'),
      });

      // Empty string triggers min_length
      const result = schema.safeParse({ password: '' });
      expect(result.success).toBe(false);

      if (!result.success) {
        const error = fromZodError(result.error);

        // Should only have one entry for password (the first issue)
        expect(error.fields.password.message).toBe('Too short');
      }
    });

    it('handles nested field paths with dot notation', () => {
      const schema = z.object({
        address: z.object({
          city: z.string().min(1, 'City is required'),
        }),
      });

      const result = schema.safeParse({ address: { city: '' } });
      expect(result.success).toBe(false);

      if (!result.success) {
        const error = fromZodError(result.error);

        expect(error.fields['address.city']).toBeDefined();
        expect(error.fields['address.city'].message).toBe('City is required');
      }
    });

    it('uses custom message when provided', () => {
      const schema = z.object({ name: z.string().min(1) });
      const result = schema.safeParse({ name: '' });

      if (!result.success) {
        const error = fromZodError(result.error, 'Invalid user data');
        expect(error.message).toBe('Invalid user data');
      }
    });

    it('uses default message when not provided', () => {
      const schema = z.object({ name: z.string().min(1) });
      const result = schema.safeParse({ name: '' });

      if (!result.success) {
        const error = fromZodError(result.error);
        expect(error.message).toBe('Validation failed');
      }
    });
  });

  describe('validateOrThrow', () => {
    it('returns parsed data on valid input', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(0),
      });

      const result = validateOrThrow(schema, { email: 'test@example.com', age: 25 });

      expect(result).toEqual({ email: 'test@example.com', age: 25 });
    });

    it('throws ValidationError on invalid input', () => {
      const schema = z.object({
        email: z.string().email('Invalid email'),
      });

      expect(() => validateOrThrow(schema, { email: 'not-an-email' })).toThrow(ValidationError);
    });

    it('thrown error has correct field information', () => {
      const schema = z.object({
        password: z.string().min(8, 'Password too short'),
      });

      try {
        validateOrThrow(schema, { password: 'abc' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.fields.password.message).toBe('Password too short');
        expect(validationError.fields.password.constraint).toBe('min_length');
      }
    });

    it('uses custom message in thrown error', () => {
      const schema = z.object({ name: z.string().min(1) });

      try {
        validateOrThrow(schema, { name: '' }, 'Name validation failed');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toBe('Name validation failed');
      }
    });
  });
});
