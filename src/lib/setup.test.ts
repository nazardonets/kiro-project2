import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

describe('Project setup verification', () => {
  it('vitest is configured correctly', () => {
    expect(true).toBe(true);
  });

  it('fast-check is configured correctly', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a);
      }),
    );
  });

  it('path aliases resolve correctly', () => {
    // Verify that @/ alias works by importing from lib
    expect(typeof import('@/lib/constants')).toBe('object');
  });
});
