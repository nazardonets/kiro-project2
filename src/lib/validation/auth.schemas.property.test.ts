import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '@/lib/constants';

import { validatePassword } from './auth.schemas';

/**
 * **Validates: Requirements 1.1, 1.7**
 *
 * Property 1: Password Validation Correctness
 *
 * For any string, the password validator SHALL accept it if and only if it is
 * between 8 and 128 characters long and contains at least one uppercase letter,
 * one lowercase letter, and one digit. All other strings SHALL be rejected with
 * a message indicating which requirements are not satisfied.
 */
describe('Property 1: Password Validation Correctness', () => {
  // Helper: generate a valid password (8-128 chars, has uppercase, lowercase, digit)
  const validPasswordArb = fc
    .tuple(
      fc.integer({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH }),
      fc.integer({ min: 0, max: 25 }), // uppercase letter index
      fc.integer({ min: 0, max: 25 }), // lowercase letter index
      fc.integer({ min: 0, max: 9 }), // digit
    )
    .chain(([length, upperIdx, lowerIdx, digitVal]) => {
      // We need at least 3 chars for the required characters
      const fillerLength = Math.max(0, length - 3);
      return fc.string({ minLength: fillerLength, maxLength: fillerLength }).map((filler) => {
        const upper = String.fromCharCode(65 + upperIdx);
        const lower = String.fromCharCode(97 + lowerIdx);
        const digit = String(digitVal);
        // Place required chars at random positions within the string
        const base = filler.slice(0, fillerLength);
        return upper + lower + digit + base;
      });
    })
    .filter((pw) => {
      // Ensure the generated password actually meets all requirements
      return (
        pw.length >= PASSWORD_MIN_LENGTH &&
        pw.length <= PASSWORD_MAX_LENGTH &&
        /[A-Z]/.test(pw) &&
        /[a-z]/.test(pw) &&
        /[0-9]/.test(pw)
      );
    });

  it('should accept any string that meets all password requirements', () => {
    fc.assert(
      fc.property(validPasswordArb, (password) => {
        const result = validatePassword(password);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(password);
        }
      }),
      { numRuns: 200 },
    );
  });

  // Generate passwords that are too short (1-7 chars)
  const tooShortArb = fc
    .string({ minLength: 0, maxLength: PASSWORD_MIN_LENGTH - 1 })
    .filter((s) => s.length < PASSWORD_MIN_LENGTH);

  it('should reject any string shorter than minimum length and report min_length constraint', () => {
    fc.assert(
      fc.property(tooShortArb, (password) => {
        const result = validatePassword(password);
        expect(result.success).toBe(false);
        if (!result.success) {
          const constraints = result.error.fields.password.map((e) => e.constraint);
          expect(constraints).toContain('min_length');
        }
      }),
      { numRuns: 100 },
    );
  });

  // Generate passwords that are too long (129+ chars)
  const tooLongArb = fc.string({
    minLength: PASSWORD_MAX_LENGTH + 1,
    maxLength: PASSWORD_MAX_LENGTH + 50,
  });

  it('should reject any string longer than maximum length and report max_length constraint', () => {
    fc.assert(
      fc.property(tooLongArb, (password) => {
        const result = validatePassword(password);
        expect(result.success).toBe(false);
        if (!result.success) {
          const constraints = result.error.fields.password.map((e) => e.constraint);
          expect(constraints).toContain('max_length');
        }
      }),
      { numRuns: 100 },
    );
  });

  // Generate strings with valid length but missing uppercase
  const noUppercaseArb = fc
    .string({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
    .filter((s) => !/[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s));

  it('should reject any valid-length string missing uppercase and report uppercase constraint', () => {
    fc.assert(
      fc.property(noUppercaseArb, (password) => {
        const result = validatePassword(password);
        expect(result.success).toBe(false);
        if (!result.success) {
          const constraints = result.error.fields.password.map((e) => e.constraint);
          expect(constraints).toContain('uppercase');
          expect(constraints).not.toContain('min_length');
          expect(constraints).not.toContain('max_length');
          expect(constraints).not.toContain('lowercase');
          expect(constraints).not.toContain('digit');
        }
      }),
      { numRuns: 100 },
    );
  });

  // Generate strings with valid length but missing lowercase
  const noLowercaseArb = fc
    .string({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
    .filter((s) => /[A-Z]/.test(s) && !/[a-z]/.test(s) && /[0-9]/.test(s));

  it('should reject any valid-length string missing lowercase and report lowercase constraint', () => {
    fc.assert(
      fc.property(noLowercaseArb, (password) => {
        const result = validatePassword(password);
        expect(result.success).toBe(false);
        if (!result.success) {
          const constraints = result.error.fields.password.map((e) => e.constraint);
          expect(constraints).toContain('lowercase');
          expect(constraints).not.toContain('min_length');
          expect(constraints).not.toContain('max_length');
          expect(constraints).not.toContain('uppercase');
          expect(constraints).not.toContain('digit');
        }
      }),
      { numRuns: 100 },
    );
  });

  // Generate strings with valid length but missing digit
  const noDigitArb = fc
    .string({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
    .filter((s) => /[A-Z]/.test(s) && /[a-z]/.test(s) && !/[0-9]/.test(s));

  it('should reject any valid-length string missing a digit and report digit constraint', () => {
    fc.assert(
      fc.property(noDigitArb, (password) => {
        const result = validatePassword(password);
        expect(result.success).toBe(false);
        if (!result.success) {
          const constraints = result.error.fields.password.map((e) => e.constraint);
          expect(constraints).toContain('digit');
          expect(constraints).not.toContain('min_length');
          expect(constraints).not.toContain('max_length');
          expect(constraints).not.toContain('uppercase');
          expect(constraints).not.toContain('lowercase');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should never produce false positives: any accepted password meets all requirements', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (password) => {
        const result = validatePassword(password);
        if (result.success) {
          // If accepted, it must meet ALL requirements
          expect(password.length).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
          expect(password.length).toBeLessThanOrEqual(PASSWORD_MAX_LENGTH);
          expect(/[A-Z]/.test(password)).toBe(true);
          expect(/[a-z]/.test(password)).toBe(true);
          expect(/[0-9]/.test(password)).toBe(true);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('should never produce false negatives: any rejected password fails at least one requirement', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (password) => {
        const result = validatePassword(password);
        if (!result.success) {
          // If rejected, at least one requirement must be violated
          const violatesLength =
            password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH;
          const missingUpper = !/[A-Z]/.test(password);
          const missingLower = !/[a-z]/.test(password);
          const missingDigit = !/[0-9]/.test(password);
          expect(violatesLength || missingUpper || missingLower || missingDigit).toBe(true);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('should report exactly the constraints that are violated (no more, no less)', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (password) => {
        const result = validatePassword(password);
        if (!result.success) {
          const constraints = result.error.fields.password.map((e) => e.constraint);

          // Check each constraint is reported if and only if it is violated
          if (password.length < PASSWORD_MIN_LENGTH) {
            expect(constraints).toContain('min_length');
          } else {
            expect(constraints).not.toContain('min_length');
          }

          if (password.length > PASSWORD_MAX_LENGTH) {
            expect(constraints).toContain('max_length');
          } else {
            expect(constraints).not.toContain('max_length');
          }

          if (!/[A-Z]/.test(password)) {
            expect(constraints).toContain('uppercase');
          } else {
            expect(constraints).not.toContain('uppercase');
          }

          if (!/[a-z]/.test(password)) {
            expect(constraints).toContain('lowercase');
          } else {
            expect(constraints).not.toContain('lowercase');
          }

          if (!/[0-9]/.test(password)) {
            expect(constraints).toContain('digit');
          } else {
            expect(constraints).not.toContain('digit');
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  it('should always return VALIDATION_ERROR code when rejecting', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (password) => {
        const result = validatePassword(password);
        if (!result.success) {
          expect(result.error.code).toBe('VALIDATION_ERROR');
        }
      }),
      { numRuns: 200 },
    );
  });
});
