import { describe, it, expect } from 'vitest';

import { CYCLE_DATE_MAX_AGE_DAYS } from '@/lib/constants';

import { validateCycleStartDate } from './cycle.schemas';

describe('validateCycleStartDate', () => {
  const today = new Date('2024-06-15');

  it('accepts today as a valid start date', () => {
    const result = validateCycleStartDate('2024-06-15', today);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts yesterday as a valid start date', () => {
    const result = validateCycleStartDate('2024-06-14', today);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts a date exactly 365 days ago', () => {
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - CYCLE_DATE_MAX_AGE_DAYS);
    const dateStr = minDate.toISOString().split('T')[0];
    const result = validateCycleStartDate(dateStr, today);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts a date in the middle of the valid range', () => {
    const result = validateCycleStartDate('2024-03-15', today);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects a future date with appropriate error message', () => {
    const result = validateCycleStartDate('2024-06-16', today);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Start date must be today or earlier');
  });

  it('rejects a date far in the future', () => {
    const result = validateCycleStartDate('2025-01-01', today);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Start date must be today or earlier');
  });

  it('rejects a date older than 365 days with appropriate error message', () => {
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - CYCLE_DATE_MAX_AGE_DAYS - 1);
    const dateStr = minDate.toISOString().split('T')[0];
    const result = validateCycleStartDate(dateStr, today);
    expect(result.success).toBe(false);
    expect(result.error).toBe(`Start date must be within the last ${CYCLE_DATE_MAX_AGE_DAYS} days`);
  });

  it('rejects a date far in the past', () => {
    const result = validateCycleStartDate('2020-01-01', today);
    expect(result.success).toBe(false);
    expect(result.error).toBe(`Start date must be within the last ${CYCLE_DATE_MAX_AGE_DAYS} days`);
  });

  it('rejects an invalid date string', () => {
    const result = validateCycleStartDate('not-a-date', today);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid date format');
  });

  it('rejects an empty string', () => {
    const result = validateCycleStartDate('', today);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid date format');
  });

  it('works without a reference date (uses current date)', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const result = validateCycleStartDate(todayStr);
    expect(result.success).toBe(true);
  });
});
