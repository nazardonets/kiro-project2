import fc from 'fast-check';
import { describe, it } from 'vitest';

import { CYCLE_DATE_MAX_AGE_DAYS } from '@/lib/constants';

import { validateCycleStartDate } from './cycle.schemas';

/**
 * Property 14: Cycle Start Date Range Validation
 *
 * For any date submitted as a cycle start date, the system SHALL accept it
 * if and only if it falls within the range [today - 365 days, today].
 * All future dates and dates older than 365 days SHALL be rejected.
 *
 * **Validates: Requirements 7.1, 7.4**
 */
describe('Property 14: Cycle Start Date Range Validation', () => {
  // Use a fixed reference date for deterministic testing
  const referenceDate = new Date('2024-06-15T00:00:00.000Z');

  /**
   * Helper to format a Date as an ISO date string (YYYY-MM-DD)
   */
  function toDateStr(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  it('any date within [today - 365 days, today] is always accepted', () => {
    fc.assert(
      fc.property(
        // Generate random offsets from 0 to 365 (inclusive) representing days before reference
        fc.integer({ min: 0, max: CYCLE_DATE_MAX_AGE_DAYS }),
        (daysAgo) => {
          const date = new Date(referenceDate);
          date.setDate(date.getDate() - daysAgo);
          const dateStr = toDateStr(date);

          const result = validateCycleStartDate(dateStr, referenceDate);
          return result.success === true && result.error === undefined;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('any future date (tomorrow or later) is always rejected', () => {
    fc.assert(
      fc.property(
        // Generate random offsets from 1 to 1000 representing days in the future
        fc.integer({ min: 1, max: 1000 }),
        (daysInFuture) => {
          const date = new Date(referenceDate);
          date.setDate(date.getDate() + daysInFuture);
          const dateStr = toDateStr(date);

          const result = validateCycleStartDate(dateStr, referenceDate);
          return result.success === false && result.error === 'Start date must be today or earlier';
        },
      ),
      { numRuns: 200 },
    );
  });

  it('any date older than 365 days is always rejected', () => {
    fc.assert(
      fc.property(
        // Generate random offsets from 366 to 2000 representing days too far in the past
        fc.integer({ min: CYCLE_DATE_MAX_AGE_DAYS + 1, max: 2000 }),
        (daysAgo) => {
          const date = new Date(referenceDate);
          date.setDate(date.getDate() - daysAgo);
          const dateStr = toDateStr(date);

          const result = validateCycleStartDate(dateStr, referenceDate);
          return (
            result.success === false &&
            result.error === `Start date must be within the last ${CYCLE_DATE_MAX_AGE_DAYS} days`
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('boundary dates (today and today-365) are always accepted', () => {
    // Today (offset 0)
    const todayStr = toDateStr(referenceDate);
    const todayResult = validateCycleStartDate(todayStr, referenceDate);

    // Exactly 365 days ago
    const minDate = new Date(referenceDate);
    minDate.setDate(minDate.getDate() - CYCLE_DATE_MAX_AGE_DAYS);
    const minDateStr = toDateStr(minDate);
    const minResult = validateCycleStartDate(minDateStr, referenceDate);

    fc.assert(
      fc.property(fc.constant(null), () => {
        return (
          todayResult.success === true &&
          todayResult.error === undefined &&
          minResult.success === true &&
          minResult.error === undefined
        );
      }),
    );
  });

  it('boundary+1 dates (tomorrow and today-366) are always rejected', () => {
    // Tomorrow (1 day in the future)
    const tomorrow = new Date(referenceDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = toDateStr(tomorrow);
    const tomorrowResult = validateCycleStartDate(tomorrowStr, referenceDate);

    // 366 days ago (1 day beyond the valid range)
    const tooOld = new Date(referenceDate);
    tooOld.setDate(tooOld.getDate() - (CYCLE_DATE_MAX_AGE_DAYS + 1));
    const tooOldStr = toDateStr(tooOld);
    const tooOldResult = validateCycleStartDate(tooOldStr, referenceDate);

    fc.assert(
      fc.property(fc.constant(null), () => {
        return (
          tomorrowResult.success === false &&
          tomorrowResult.error === 'Start date must be today or earlier' &&
          tooOldResult.success === false &&
          tooOldResult.error ===
            `Start date must be within the last ${CYCLE_DATE_MAX_AGE_DAYS} days`
        );
      }),
    );
  });
});
