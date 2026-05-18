import { describe, it, expect } from 'vitest';

import { validatePhaseDurations } from './cycle.schemas';

describe('validatePhaseDurations', () => {
  const validDurations = {
    menstrual_days: 5,
    follicular_days: 8,
    ovulation_days: 1,
    early_luteal_days: 7,
    late_luteal_days: 7,
  };

  it('accepts valid durations that sum to cycle length', () => {
    const result = validatePhaseDurations(validDurations, 28);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts custom durations that sum to a non-default cycle length', () => {
    const durations = {
      menstrual_days: 6,
      follicular_days: 9,
      ovulation_days: 2,
      early_luteal_days: 8,
      late_luteal_days: 7,
    };
    const result = validatePhaseDurations(durations, 32);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts all phases at minimum duration (1 day each)', () => {
    const durations = {
      menstrual_days: 1,
      follicular_days: 1,
      ovulation_days: 1,
      early_luteal_days: 1,
      late_luteal_days: 1,
    };
    const result = validatePhaseDurations(durations, 5);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts all phases at maximum duration (14 days each)', () => {
    const durations = {
      menstrual_days: 14,
      follicular_days: 14,
      ovulation_days: 14,
      early_luteal_days: 14,
      late_luteal_days: 14,
    };
    const result = validatePhaseDurations(durations, 70);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a duration below minimum (0 days)', () => {
    const durations = { ...validDurations, menstrual_days: 0 };
    const result = validatePhaseDurations(durations, 27);
    expect(result.success).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        field: 'menstrual_days',
        constraint: 'min_duration',
      }),
    );
  });

  it('rejects a duration above maximum (15 days)', () => {
    const durations = { ...validDurations, follicular_days: 15 };
    const result = validatePhaseDurations(durations, 35);
    expect(result.success).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        field: 'follicular_days',
        constraint: 'max_duration',
      }),
    );
  });

  it('rejects when sum does not equal cycle length', () => {
    const result = validatePhaseDurations(validDurations, 30);
    expect(result.success).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        constraint: 'sum_equals_cycle_length',
      }),
    );
    const sumError = result.errors.find((e) => e.constraint === 'sum_equals_cycle_length');
    expect(sumError).toBeDefined();
    expect(sumError?.message).toContain('30');
    expect(sumError?.message).toContain('28');
  });

  it('rejects non-integer durations', () => {
    const durations = { ...validDurations, ovulation_days: 1.5 };
    const result = validatePhaseDurations(durations, 28.5);
    expect(result.success).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        field: 'ovulation_days',
        constraint: 'integer',
      }),
    );
  });

  it('reports multiple errors when multiple phases are invalid', () => {
    const durations = {
      menstrual_days: 0,
      follicular_days: 15,
      ovulation_days: 1,
      early_luteal_days: 7,
      late_luteal_days: 7,
    };
    const result = validatePhaseDurations(durations, 30);
    expect(result.success).toBe(false);
    // Should have at least 2 individual duration errors + sum error
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('includes specific error message for sum mismatch', () => {
    const durations = {
      menstrual_days: 5,
      follicular_days: 5,
      ovulation_days: 5,
      early_luteal_days: 5,
      late_luteal_days: 5,
    };
    const result = validatePhaseDurations(durations, 28);
    expect(result.success).toBe(false);
    const sumError = result.errors.find((e) => e.constraint === 'sum_equals_cycle_length');
    expect(sumError).toBeDefined();
    expect(sumError?.message).toBe('Phase durations must sum to 28 days (currently 25)');
  });
});
