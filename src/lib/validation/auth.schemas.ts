import { z } from 'zod';

import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '@/lib/constants';

/** Validation error shape matching the design document's ValidationError interface */
export interface PasswordValidationError {
  code: 'VALIDATION_ERROR';
  fields: {
    password: {
      message: string;
      constraint: string;
    }[];
  };
}

export interface PasswordValidationSuccess {
  success: true;
  data: string;
}

export type PasswordValidationResult =
  | PasswordValidationSuccess
  | { success: false; error: PasswordValidationError };

/**
 * Validates a password against all requirements and returns detailed error messages
 * for each failing requirement.
 *
 * Requirements:
 * - Length between 8 and 128 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 *
 * Returns all failing requirements at once (not just the first failure).
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: { message: string; constraint: string }[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push({
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      constraint: 'min_length',
    });
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push({
      message: `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
      constraint: 'max_length',
    });
  }

  if (!/[A-Z]/.test(password)) {
    errors.push({
      message: 'Password must contain at least one uppercase letter',
      constraint: 'uppercase',
    });
  }

  if (!/[a-z]/.test(password)) {
    errors.push({
      message: 'Password must contain at least one lowercase letter',
      constraint: 'lowercase',
    });
  }

  if (!/[0-9]/.test(password)) {
    errors.push({
      message: 'Password must contain at least one digit',
      constraint: 'digit',
    });
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        fields: {
          password: errors,
        },
      },
    };
  }

  return { success: true, data: password };
}

/** Password must be 8-128 chars with at least one uppercase, one lowercase, one digit */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Invite token is required'),
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
