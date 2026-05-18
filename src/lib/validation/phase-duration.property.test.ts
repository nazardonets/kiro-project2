import fc from 'fast-check';
import { describe, it } from 'vitest';

import { validatePhaseDurations, MIN_PHASE_DURATION, MAX_PHASE_DURATION } from './cycle.schemas';
import type { PhaseCustomizationInput } from './cycle.schemas';

/**
 * Property 20: Phase Duration Customization Validation
 *
 * For any set of custom phase durations, the system SHALL accept them if and only if
 * each individual duration is between 1 and 14 days AND the sum of all durations
 * equals the Primary_User's total cycle length.
 *
 * **Validates: Requirements 9.1, 9.2, 9.3**
 */
describe('Property 20: Phase Duration Customization Validation', () => {
  /**
   * Generator for valid phase durations: each in [1, 14].
   * The cycle length is computed as the sum of all durations.
   */
  const validDurationsArb = fc
    .tuple(
      fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
      fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
      fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
      fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
      fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
    )
    .map(([menstrual, follicular, ovulation, earlyLuteal, lateLuteal]) => ({
      durations: {
        menstrual_days: menstrual,
        follicular_days: follicular,
        ovulation_days: ovulation,
        early_luteal_days: earlyLuteal,
        late_luteal_days: lateLuteal,
      } as PhaseCustomizationInput,
      cycleLength: menstrual + follicular + ovulation + earlyLuteal + lateLuteal,
    }));

  it('any set of 5 durations where each is in [1,14] AND their sum equals the cycle length is always accepted', () => {
    fc.assert(
      fc.property(validDurationsArb, ({ durations, cycleLength }) => {
        const result = validatePhaseDurations(durations, cycleLength);
        return result.success === true && result.errors.length === 0;
      }),
      { numRuns: 200 },
    );
  });

  it('any set where at least one duration is below minimum (< 1) is always rejected', () => {
    fc.assert(
      fc.property(
        // Generate 5 durations where at least one is below MIN_PHASE_DURATION
        fc.integer({ min: 0, max: 4 }), // index of the invalid phase
        fc.integer({ min: -10, max: MIN_PHASE_DURATION - 1 }), // invalid value (0 or negative)
        fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
        fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
        fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
        fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
        (invalidIndex, invalidValue, d1, d2, d3, d4) => {
          const values = [d1, d2, d3, d4];
          // Insert the invalid value at the chosen index
          values.splice(invalidIndex, 0, invalidValue);

          const durations: PhaseCustomizationInput = {
            menstrual_days: values[0],
            follicular_days: values[1],
            ovulation_days: values[2],
            early_luteal_days: values[3],
            late_luteal_days: values[4],
          };

          const sum = values.reduce((acc, v) => acc + v, 0);
          const result = validatePhaseDurations(durations, sum);

          // Should be rejected due to min_duration constraint
          return (
            result.success === false && result.errors.some((e) => e.constraint === 'min_duration')
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('any set where at least one duration is above maximum (> 14) is always rejected', () => {
    fc.assert(
      fc.property(
        // Generate 5 durations where at least one is above MAX_PHASE_DURATION
        fc.integer({ min: 0, max: 4 }), // index of the invalid phase
        fc.integer({ min: MAX_PHASE_DURATION + 1, max: 50 }), // invalid value (> 14)
        fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
        fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
        fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
        fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
        (invalidIndex, invalidValue, d1, d2, d3, d4) => {
          const values = [d1, d2, d3, d4];
          // Insert the invalid value at the chosen index
          values.splice(invalidIndex, 0, invalidValue);

          const durations: PhaseCustomizationInput = {
            menstrual_days: values[0],
            follicular_days: values[1],
            ovulation_days: values[2],
            early_luteal_days: values[3],
            late_luteal_days: values[4],
          };

          const sum = values.reduce((acc, v) => acc + v, 0);
          const result = validatePhaseDurations(durations, sum);

          // Should be rejected due to max_duration constraint
          return (
            result.success === false && result.errors.some((e) => e.constraint === 'max_duration')
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('any set where the sum does not equal the cycle length is always rejected', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
        fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
        fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
        fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
        fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
        // Generate a non-zero offset to ensure sum != cycleLength
        fc.integer({ min: 1, max: 20 }),
        fc.boolean(),
        (menstrual, follicular, ovulation, earlyLuteal, lateLuteal, offset, addOffset) => {
          const durations: PhaseCustomizationInput = {
            menstrual_days: menstrual,
            follicular_days: follicular,
            ovulation_days: ovulation,
            early_luteal_days: earlyLuteal,
            late_luteal_days: lateLuteal,
          };

          const actualSum = menstrual + follicular + ovulation + earlyLuteal + lateLuteal;
          // Make cycle length differ from the actual sum
          const cycleLength = addOffset ? actualSum + offset : actualSum - offset;

          const result = validatePhaseDurations(durations, cycleLength);

          // Should be rejected due to sum_equals_cycle_length constraint
          return (
            result.success === false &&
            result.errors.some((e) => e.constraint === 'sum_equals_cycle_length')
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('error messages correctly identify which specific constraints failed', () => {
    fc.assert(
      fc.property(
        // Generate a phase index to make invalid
        fc.integer({ min: 0, max: 4 }),
        // Choose whether to go below min or above max
        fc.boolean(),
        fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
        fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
        fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
        fc.integer({ min: MIN_PHASE_DURATION, max: MAX_PHASE_DURATION }),
        (invalidIndex, belowMin, d1, d2, d3, d4) => {
          const fields = [
            'menstrual_days',
            'follicular_days',
            'ovulation_days',
            'early_luteal_days',
            'late_luteal_days',
          ] as const;

          const values = [d1, d2, d3, d4];
          // Insert an invalid value at the chosen index
          const invalidValue = belowMin ? 0 : MAX_PHASE_DURATION + 1;
          values.splice(invalidIndex, 0, invalidValue);

          const durations: PhaseCustomizationInput = {
            menstrual_days: values[0],
            follicular_days: values[1],
            ovulation_days: values[2],
            early_luteal_days: values[3],
            late_luteal_days: values[4],
          };

          const sum = values.reduce((acc, v) => acc + v, 0);
          const result = validatePhaseDurations(durations, sum);

          // The error should reference the specific field that was invalid
          const expectedField = fields[invalidIndex];
          const expectedConstraint = belowMin ? 'min_duration' : 'max_duration';

          const matchingError = result.errors.find(
            (e) => e.field === expectedField && e.constraint === expectedConstraint,
          );

          return (
            result.success === false &&
            matchingError !== undefined &&
            matchingError.message.includes(expectedField)
          );
        },
      ),
      { numRuns: 200 },
    );
  });
});
