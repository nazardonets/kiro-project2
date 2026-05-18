import { describe, it, expect } from 'vitest';

import { validatePassword } from './auth.schemas';

describe('validatePassword', () => {
  it('accepts a valid password', () => {
    const result = validatePassword('Abcdef1x');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('Abcdef1x');
    }
  });

  it('accepts a password at minimum length (8 chars)', () => {
    const result = validatePassword('Abcdef1x');
    expect(result.success).toBe(true);
  });

  it('accepts a password at maximum length (128 chars)', () => {
    const password = 'A' + 'a'.repeat(126) + '1';
    expect(password.length).toBe(128);
    const result = validatePassword(password);
    expect(result.success).toBe(true);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = validatePassword('Ab1defg');
    expect(result.success).toBe(false);
    if (!result.success) {
      const constraints = result.error.fields.password.map((e) => e.constraint);
      expect(constraints).toContain('min_length');
    }
  });

  it('rejects a password longer than 128 characters', () => {
    const password = 'A' + 'a'.repeat(127) + '1';
    expect(password.length).toBe(129);
    const result = validatePassword(password);
    expect(result.success).toBe(false);
    if (!result.success) {
      const constraints = result.error.fields.password.map((e) => e.constraint);
      expect(constraints).toContain('max_length');
    }
  });

  it('rejects a password without an uppercase letter', () => {
    const result = validatePassword('abcdefg1');
    expect(result.success).toBe(false);
    if (!result.success) {
      const constraints = result.error.fields.password.map((e) => e.constraint);
      expect(constraints).toContain('uppercase');
    }
  });

  it('rejects a password without a lowercase letter', () => {
    const result = validatePassword('ABCDEFG1');
    expect(result.success).toBe(false);
    if (!result.success) {
      const constraints = result.error.fields.password.map((e) => e.constraint);
      expect(constraints).toContain('lowercase');
    }
  });

  it('rejects a password without a digit', () => {
    const result = validatePassword('Abcdefgh');
    expect(result.success).toBe(false);
    if (!result.success) {
      const constraints = result.error.fields.password.map((e) => e.constraint);
      expect(constraints).toContain('digit');
    }
  });

  it('returns multiple errors when multiple requirements fail', () => {
    const result = validatePassword('abc');
    expect(result.success).toBe(false);
    if (!result.success) {
      const constraints = result.error.fields.password.map((e) => e.constraint);
      expect(constraints).toContain('min_length');
      expect(constraints).toContain('uppercase');
      expect(constraints).toContain('digit');
      expect(constraints).not.toContain('lowercase');
    }
  });

  it('returns the correct error code', () => {
    const result = validatePassword('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns all failing requirements for an empty string', () => {
    const result = validatePassword('');
    expect(result.success).toBe(false);
    if (!result.success) {
      const constraints = result.error.fields.password.map((e) => e.constraint);
      expect(constraints).toContain('min_length');
      expect(constraints).toContain('uppercase');
      expect(constraints).toContain('lowercase');
      expect(constraints).toContain('digit');
    }
  });
});
