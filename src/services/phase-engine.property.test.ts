import fc from 'fast-check';
import { describe, it } from 'vitest';

import { CyclePhase } from '@/lib/types';

import {
  calculatePhaseFromElapsedDays,
  PhaseCalculationResult,
  generatePredictions,
  PhaseDurations,
  scalePhaseDurations,
  calculateAverageCycleLength,
} from './phase-engine';

/**
 * Property 17: Phase Calculation Correctness
 *
 * For any valid cycle start date and number of elapsed days (1-28), the calculated
 * Cycle_Phase SHALL match the standard phase boundaries: Menstrual (1-5),
 * Follicular (6-13), Ovulation (14), Early Luteal (15-21), Late Luteal (22-28).
 * When elapsed days exceed the cycle length, the phase SHALL be Late_Luteal
 * with an overdue indicator.
 *
 * **Validates: Requirements 8.1, 8.6**
 */
describe('Property 17: Phase Calculation Correctness', () => {
  it('days 1-5 always produce Menstrual phase', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (elapsedDays) => {
        const result: PhaseCalculationResult = calculatePhaseFromElapsedDays(elapsedDays);
        return result.phase === CyclePhase.MENSTRUAL && result.isOverdue === false;
      }),
      { numRuns: 200 },
    );
  });

  it('days 6-13 always produce Follicular phase', () => {
    fc.assert(
      fc.property(fc.integer({ min: 6, max: 13 }), (elapsedDays) => {
        const result: PhaseCalculationResult = calculatePhaseFromElapsedDays(elapsedDays);
        return result.phase === CyclePhase.FOLLICULAR && result.isOverdue === false;
      }),
      { numRuns: 200 },
    );
  });

  it('day 14 always produces Ovulation phase', () => {
    fc.assert(
      fc.property(fc.constant(14), (elapsedDays) => {
        const result: PhaseCalculationResult = calculatePhaseFromElapsedDays(elapsedDays);
        return result.phase === CyclePhase.OVULATION && result.isOverdue === false;
      }),
      { numRuns: 10 },
    );
  });

  it('days 15-21 always produce Early Luteal phase', () => {
    fc.assert(
      fc.property(fc.integer({ min: 15, max: 21 }), (elapsedDays) => {
        const result: PhaseCalculationResult = calculatePhaseFromElapsedDays(elapsedDays);
        return result.phase === CyclePhase.EARLY_LUTEAL && result.isOverdue === false;
      }),
      { numRuns: 200 },
    );
  });

  it('days 22-28 always produce Late Luteal phase', () => {
    fc.assert(
      fc.property(fc.integer({ min: 22, max: 28 }), (elapsedDays) => {
        const result: PhaseCalculationResult = calculatePhaseFromElapsedDays(elapsedDays);
        return result.phase === CyclePhase.LATE_LUTEAL && result.isOverdue === false;
      }),
      { numRuns: 200 },
    );
  });

  it('days > 28 always produce Late Luteal phase with isOverdue=true', () => {
    fc.assert(
      fc.property(fc.integer({ min: 29, max: 100 }), (elapsedDays) => {
        const result: PhaseCalculationResult = calculatePhaseFromElapsedDays(elapsedDays);
        return result.phase === CyclePhase.LATE_LUTEAL && result.isOverdue === true;
      }),
      { numRuns: 200 },
    );
  });

  it('dayInPhase is always >= 1 for any elapsed days', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (elapsedDays) => {
        const result: PhaseCalculationResult = calculatePhaseFromElapsedDays(elapsedDays);
        return result.dayInPhase >= 1;
      }),
      { numRuns: 500 },
    );
  });

  it('totalCycleLength equals 28 for standard (default) durations', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (elapsedDays) => {
        const result: PhaseCalculationResult = calculatePhaseFromElapsedDays(elapsedDays);
        return result.totalCycleLength === 28;
      }),
      { numRuns: 500 },
    );
  });
});

/**
 * Property 19: 60-Day Prediction Coverage
 *
 * For any available Cycle_Data, the generated Phase_Predictions SHALL cover
 * exactly 60 days from the current date, with no gaps or overlaps between
 * predicted phases.
 *
 * **Validates: Requirements 8.4**
 */
describe('Property 19: 60-Day Prediction Coverage', () => {
  const validPhases = Object.values(CyclePhase);

  const minDate = new Date(2020, 0, 1);
  const maxDate = new Date(2025, 11, 31);

  // Generate a startDate and currentDate where currentDate >= startDate
  // Use integer-based approach to avoid fc.date min/max edge cases
  const datesPairArb = fc
    .integer({ min: minDate.getTime(), max: maxDate.getTime() })
    .chain((startMs) =>
      fc.integer({ min: startMs, max: maxDate.getTime() }).map((currentMs) => ({
        startDate: new Date(startMs),
        currentDate: new Date(currentMs),
      })),
    );

  // Arbitrary for custom phase durations (each between 1 and 14)
  const customDurationsArb: fc.Arbitrary<PhaseDurations> = fc.record({
    menstrual: fc.integer({ min: 1, max: 14 }),
    follicular: fc.integer({ min: 1, max: 14 }),
    ovulation: fc.integer({ min: 1, max: 14 }),
    earlyLuteal: fc.integer({ min: 1, max: 14 }),
    lateLuteal: fc.integer({ min: 1, max: 14 }),
  });

  // Arbitrary for historical cycle lengths (2+ records, each between 21 and 35 days)
  const historicalCycleLengthsArb = fc.array(fc.integer({ min: 21, max: 35 }), {
    minLength: 2,
    maxLength: 12,
  });

  it('total days covered by all predictions equals exactly 60 (standard durations)', () => {
    fc.assert(
      fc.property(datesPairArb, ({ startDate, currentDate }) => {
        const predictions = generatePredictions(startDate, currentDate);
        const totalDays = predictions.reduce((sum, p) => sum + (p.endDay - p.startDay + 1), 0);
        return totalDays === 60;
      }),
      { numRuns: 200 },
    );
  });

  it('predictions start at day 1 and end at day 60', () => {
    fc.assert(
      fc.property(datesPairArb, ({ startDate, currentDate }) => {
        const predictions = generatePredictions(startDate, currentDate);
        return predictions[0].startDay === 1 && predictions[predictions.length - 1].endDay === 60;
      }),
      { numRuns: 200 },
    );
  });

  it('no gaps: each prediction startDay equals previous endDay + 1', () => {
    fc.assert(
      fc.property(datesPairArb, ({ startDate, currentDate }) => {
        const predictions = generatePredictions(startDate, currentDate);
        for (let i = 1; i < predictions.length; i++) {
          if (predictions[i].startDay !== predictions[i - 1].endDay + 1) {
            return false;
          }
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });

  it('no overlaps: each prediction startDay is strictly greater than previous endDay', () => {
    fc.assert(
      fc.property(datesPairArb, ({ startDate, currentDate }) => {
        const predictions = generatePredictions(startDate, currentDate);
        for (let i = 1; i < predictions.length; i++) {
          if (predictions[i].startDay <= predictions[i - 1].endDay) {
            return false;
          }
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });

  it('all predictions have valid CyclePhase values', () => {
    fc.assert(
      fc.property(datesPairArb, ({ startDate, currentDate }) => {
        const predictions = generatePredictions(startDate, currentDate);
        return predictions.every((p) => validPhases.includes(p.phase));
      }),
      { numRuns: 200 },
    );
  });

  it('covers exactly 60 days with custom durations', () => {
    fc.assert(
      fc.property(
        datesPairArb,
        customDurationsArb,
        ({ startDate, currentDate }, customDurations) => {
          const predictions = generatePredictions(startDate, currentDate, { customDurations });
          const totalDays = predictions.reduce((sum, p) => sum + (p.endDay - p.startDay + 1), 0);
          return (
            totalDays === 60 &&
            predictions[0].startDay === 1 &&
            predictions[predictions.length - 1].endDay === 60
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('covers exactly 60 days with historical cycle lengths (2+ records)', () => {
    fc.assert(
      fc.property(
        datesPairArb,
        historicalCycleLengthsArb,
        ({ startDate, currentDate }, historicalCycleLengths) => {
          const predictions = generatePredictions(startDate, currentDate, {
            historicalCycleLengths,
          });
          const totalDays = predictions.reduce((sum, p) => sum + (p.endDay - p.startDay + 1), 0);
          return (
            totalDays === 60 &&
            predictions[0].startDay === 1 &&
            predictions[predictions.length - 1].endDay === 60
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('no gaps or overlaps with custom durations', () => {
    fc.assert(
      fc.property(
        datesPairArb,
        customDurationsArb,
        ({ startDate, currentDate }, customDurations) => {
          const predictions = generatePredictions(startDate, currentDate, { customDurations });
          for (let i = 1; i < predictions.length; i++) {
            if (predictions[i].startDay !== predictions[i - 1].endDay + 1) {
              return false;
            }
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('no gaps or overlaps with historical cycle lengths', () => {
    fc.assert(
      fc.property(
        datesPairArb,
        historicalCycleLengthsArb,
        ({ startDate, currentDate }, historicalCycleLengths) => {
          const predictions = generatePredictions(startDate, currentDate, {
            historicalCycleLengths,
          });
          for (let i = 1; i < predictions.length; i++) {
            if (predictions[i].startDay !== predictions[i - 1].endDay + 1) {
              return false;
            }
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('all predictions have valid CyclePhase values with any configuration', () => {
    fc.assert(
      fc.property(
        datesPairArb,
        customDurationsArb,
        historicalCycleLengthsArb,
        ({ startDate, currentDate }, customDurations, historicalCycleLengths) => {
          // Test with custom durations
          const pred1 = generatePredictions(startDate, currentDate, { customDurations });
          // Test with historical lengths
          const pred2 = generatePredictions(startDate, currentDate, { historicalCycleLengths });

          return (
            pred1.every((p) => validPhases.includes(p.phase)) &&
            pred2.every((p) => validPhases.includes(p.phase))
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 18: Phase Duration Scaling Preserves Total
 *
 * For any set of two or more historical cycle records, the proportionally scaled
 * phase durations SHALL sum exactly to the calculated average cycle length.
 *
 * **Validates: Requirements 8.2**
 */
describe('Property 18: Phase Duration Scaling Preserves Total', () => {
  // Generator for arrays of 2+ cycle lengths in the reasonable range 14-45 days
  const cycleLengthsArb = fc.array(fc.integer({ min: 14, max: 45 }), {
    minLength: 2,
    maxLength: 12,
  });

  it('scaled phase durations sum exactly to the average cycle length', () => {
    fc.assert(
      fc.property(cycleLengthsArb, (lengths) => {
        const avgLength = calculateAverageCycleLength(lengths);
        const durations = scalePhaseDurations(avgLength);

        const sum =
          durations.menstrual +
          durations.follicular +
          durations.ovulation +
          durations.earlyLuteal +
          durations.lateLuteal;

        return sum === avgLength;
      }),
      { numRuns: 500 },
    );
  });

  it('all individual phase durations are positive (>= 1)', () => {
    fc.assert(
      fc.property(cycleLengthsArb, (lengths) => {
        const avgLength = calculateAverageCycleLength(lengths);
        const durations = scalePhaseDurations(avgLength);

        return (
          durations.menstrual >= 1 &&
          durations.follicular >= 1 &&
          durations.ovulation >= 1 &&
          durations.earlyLuteal >= 1 &&
          durations.lateLuteal >= 1
        );
      }),
      { numRuns: 500 },
    );
  });

  it('scaling is proportional (each phase proportion is approximately maintained)', () => {
    // Standard durations: [5, 8, 1, 7, 7] for a 28-day cycle
    const standardDurations = [5, 8, 1, 7, 7];

    fc.assert(
      fc.property(cycleLengthsArb, (lengths) => {
        const avgLength = calculateAverageCycleLength(lengths);
        const durations = scalePhaseDurations(avgLength);

        const scaledValues = [
          durations.menstrual,
          durations.follicular,
          durations.ovulation,
          durations.earlyLuteal,
          durations.lateLuteal,
        ];

        // Each phase's scaled value should be close to the ideal proportional value.
        // The ideal value is standardDuration * (avgLength / 28).
        // Due to integer rounding and the last-phase adjustment, allow a tolerance of 2 days.
        const scaleFactor = avgLength / 28;

        for (let i = 0; i < 5; i++) {
          const idealValue = standardDurations[i] * scaleFactor;
          if (Math.abs(scaledValues[i] - idealValue) > 2) {
            return false;
          }
        }

        return true;
      }),
      { numRuns: 500 },
    );
  });
});
