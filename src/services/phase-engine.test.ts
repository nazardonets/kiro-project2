import { describe, it, expect } from 'vitest';

import { PREDICTION_DAYS } from '@/lib/constants';
import { CyclePhase } from '@/lib/types';

import {
  calculateCurrentPhase,
  calculateElapsedDays,
  calculatePhaseFromElapsedDays,
  customizationToDurations,
  calculateAverageCycleLength,
  scalePhaseDurations,
  generatePredictions,
  PhaseDurations,
} from './phase-engine';

describe('PhaseEngine', () => {
  describe('calculateElapsedDays', () => {
    it('returns 1 when current date equals start date', () => {
      const date = new Date(2024, 0, 15);
      expect(calculateElapsedDays(date, date)).toBe(1);
    });

    it('returns correct elapsed days for a known difference', () => {
      const start = new Date(2024, 0, 1);
      const current = new Date(2024, 0, 10);
      expect(calculateElapsedDays(start, current)).toBe(10);
    });

    it('handles month boundaries', () => {
      const start = new Date(2024, 0, 28);
      const current = new Date(2024, 1, 4);
      expect(calculateElapsedDays(start, current)).toBe(8);
    });
  });

  describe('calculatePhaseFromElapsedDays - standard boundaries', () => {
    it('returns Menstrual for days 1-5', () => {
      for (let day = 1; day <= 5; day++) {
        const result = calculatePhaseFromElapsedDays(day);
        expect(result.phase).toBe(CyclePhase.MENSTRUAL);
        expect(result.dayInPhase).toBe(day);
        expect(result.isOverdue).toBe(false);
        expect(result.totalCycleLength).toBe(28);
      }
    });

    it('returns Follicular for days 6-13', () => {
      for (let day = 6; day <= 13; day++) {
        const result = calculatePhaseFromElapsedDays(day);
        expect(result.phase).toBe(CyclePhase.FOLLICULAR);
        expect(result.dayInPhase).toBe(day - 5);
        expect(result.isOverdue).toBe(false);
      }
    });

    it('returns Ovulation for day 14', () => {
      const result = calculatePhaseFromElapsedDays(14);
      expect(result.phase).toBe(CyclePhase.OVULATION);
      expect(result.dayInPhase).toBe(1);
      expect(result.isOverdue).toBe(false);
    });

    it('returns Early Luteal for days 15-21', () => {
      for (let day = 15; day <= 21; day++) {
        const result = calculatePhaseFromElapsedDays(day);
        expect(result.phase).toBe(CyclePhase.EARLY_LUTEAL);
        expect(result.dayInPhase).toBe(day - 14);
        expect(result.isOverdue).toBe(false);
      }
    });

    it('returns Late Luteal for days 22-28', () => {
      for (let day = 22; day <= 28; day++) {
        const result = calculatePhaseFromElapsedDays(day);
        expect(result.phase).toBe(CyclePhase.LATE_LUTEAL);
        expect(result.dayInPhase).toBe(day - 21);
        expect(result.isOverdue).toBe(false);
      }
    });

    it('returns Late Luteal with overdue for day 29+', () => {
      const result = calculatePhaseFromElapsedDays(29);
      expect(result.phase).toBe(CyclePhase.LATE_LUTEAL);
      expect(result.isOverdue).toBe(true);
      expect(result.totalCycleLength).toBe(28);
      expect(result.elapsedDays).toBe(29);
    });

    it('returns Late Luteal with overdue for day 40', () => {
      const result = calculatePhaseFromElapsedDays(40);
      expect(result.phase).toBe(CyclePhase.LATE_LUTEAL);
      expect(result.isOverdue).toBe(true);
      expect(result.dayInPhase).toBe(40 - 21);
      expect(result.elapsedDays).toBe(40);
    });
  });

  describe('calculatePhaseFromElapsedDays - custom durations', () => {
    const customDurations: PhaseDurations = {
      menstrual: 3,
      follicular: 10,
      ovulation: 2,
      earlyLuteal: 8,
      lateLuteal: 7,
    };

    it('uses custom durations for phase boundaries', () => {
      // Menstrual: days 1-3
      expect(calculatePhaseFromElapsedDays(1, customDurations).phase).toBe(CyclePhase.MENSTRUAL);
      expect(calculatePhaseFromElapsedDays(3, customDurations).phase).toBe(CyclePhase.MENSTRUAL);

      // Follicular: days 4-13
      expect(calculatePhaseFromElapsedDays(4, customDurations).phase).toBe(CyclePhase.FOLLICULAR);
      expect(calculatePhaseFromElapsedDays(13, customDurations).phase).toBe(CyclePhase.FOLLICULAR);

      // Ovulation: days 14-15
      expect(calculatePhaseFromElapsedDays(14, customDurations).phase).toBe(CyclePhase.OVULATION);
      expect(calculatePhaseFromElapsedDays(15, customDurations).phase).toBe(CyclePhase.OVULATION);

      // Early Luteal: days 16-23
      expect(calculatePhaseFromElapsedDays(16, customDurations).phase).toBe(
        CyclePhase.EARLY_LUTEAL,
      );
      expect(calculatePhaseFromElapsedDays(23, customDurations).phase).toBe(
        CyclePhase.EARLY_LUTEAL,
      );

      // Late Luteal: days 24-30
      expect(calculatePhaseFromElapsedDays(24, customDurations).phase).toBe(CyclePhase.LATE_LUTEAL);
      expect(calculatePhaseFromElapsedDays(30, customDurations).phase).toBe(CyclePhase.LATE_LUTEAL);
    });

    it('calculates correct total cycle length from custom durations', () => {
      const result = calculatePhaseFromElapsedDays(1, customDurations);
      expect(result.totalCycleLength).toBe(30);
    });

    it('returns overdue when exceeding custom cycle length', () => {
      const result = calculatePhaseFromElapsedDays(31, customDurations);
      expect(result.phase).toBe(CyclePhase.LATE_LUTEAL);
      expect(result.isOverdue).toBe(true);
      expect(result.totalCycleLength).toBe(30);
    });

    it('calculates correct dayInPhase with custom durations', () => {
      // Day 5 is in Follicular (starts at day 4), so dayInPhase = 2
      const result = calculatePhaseFromElapsedDays(5, customDurations);
      expect(result.phase).toBe(CyclePhase.FOLLICULAR);
      expect(result.dayInPhase).toBe(2);
    });
  });

  describe('calculateCurrentPhase', () => {
    it('calculates phase from start date and current date', () => {
      const startDate = new Date(2024, 0, 1);
      const currentDate = new Date(2024, 0, 3); // Day 3 = Menstrual
      const result = calculateCurrentPhase(startDate, currentDate);
      expect(result.phase).toBe(CyclePhase.MENSTRUAL);
      expect(result.dayInPhase).toBe(3);
      expect(result.elapsedDays).toBe(3);
    });

    it('calculates Follicular phase correctly', () => {
      const startDate = new Date(2024, 0, 1);
      const currentDate = new Date(2024, 0, 8); // Day 8 = Follicular
      const result = calculateCurrentPhase(startDate, currentDate);
      expect(result.phase).toBe(CyclePhase.FOLLICULAR);
      expect(result.dayInPhase).toBe(3);
    });

    it('calculates overdue correctly from dates', () => {
      const startDate = new Date(2024, 0, 1);
      const currentDate = new Date(2024, 1, 5); // Day 36 = overdue
      const result = calculateCurrentPhase(startDate, currentDate);
      expect(result.phase).toBe(CyclePhase.LATE_LUTEAL);
      expect(result.isOverdue).toBe(true);
    });

    it('accepts custom durations', () => {
      const startDate = new Date(2024, 0, 1);
      const currentDate = new Date(2024, 0, 4); // Day 4
      const customDurations: PhaseDurations = {
        menstrual: 3,
        follicular: 10,
        ovulation: 2,
        earlyLuteal: 8,
        lateLuteal: 7,
      };
      const result = calculateCurrentPhase(startDate, currentDate, customDurations);
      // Day 4 with menstrual=3 means Follicular phase, day 1
      expect(result.phase).toBe(CyclePhase.FOLLICULAR);
      expect(result.dayInPhase).toBe(1);
    });
  });

  describe('customizationToDurations', () => {
    it('converts PhaseCustomization fields to PhaseDurations', () => {
      const customization = {
        menstrual_days: 4,
        follicular_days: 9,
        ovulation_days: 2,
        early_luteal_days: 6,
        late_luteal_days: 7,
      };
      const result = customizationToDurations(customization);
      expect(result).toEqual({
        menstrual: 4,
        follicular: 9,
        ovulation: 2,
        earlyLuteal: 6,
        lateLuteal: 7,
      });
    });
  });

  describe('calculateAverageCycleLength', () => {
    it('throws an error when fewer than 2 cycle lengths are provided', () => {
      expect(() => calculateAverageCycleLength([])).toThrow(
        'At least 2 historical cycle records are required',
      );
      expect(() => calculateAverageCycleLength([28])).toThrow(
        'At least 2 historical cycle records are required',
      );
    });

    it('calculates the average of two cycle lengths', () => {
      expect(calculateAverageCycleLength([28, 30])).toBe(29);
    });

    it('calculates the average of multiple cycle lengths', () => {
      expect(calculateAverageCycleLength([26, 28, 30, 32])).toBe(29);
    });

    it('rounds to the nearest integer', () => {
      // (27 + 28) / 2 = 27.5 → rounds to 28
      expect(calculateAverageCycleLength([27, 28])).toBe(28);
      // (25 + 26) / 2 = 25.5 → rounds to 26
      expect(calculateAverageCycleLength([25, 26])).toBe(26);
    });

    it('handles identical cycle lengths', () => {
      expect(calculateAverageCycleLength([28, 28, 28])).toBe(28);
    });

    it('handles the standard 28-day cycle', () => {
      expect(calculateAverageCycleLength([28, 28])).toBe(28);
    });
  });

  describe('scalePhaseDurations', () => {
    it('returns standard durations for a 28-day cycle', () => {
      const result = scalePhaseDurations(28);
      expect(result).toEqual({
        menstrual: 5,
        follicular: 8,
        ovulation: 1,
        earlyLuteal: 7,
        lateLuteal: 7,
      });
    });

    it('scales durations proportionally for a longer cycle', () => {
      const result = scalePhaseDurations(35);
      // 5 * (35/28) = 6.25 → 6
      // 8 * (35/28) = 10 → 10
      // 1 * (35/28) = 1.25 → 1
      // 7 * (35/28) = 8.75 → 9
      // lateLuteal = 35 - (6 + 10 + 1 + 9) = 9
      expect(result.menstrual).toBe(6);
      expect(result.follicular).toBe(10);
      expect(result.ovulation).toBe(1);
      expect(result.earlyLuteal).toBe(9);
      expect(result.lateLuteal).toBe(9);
    });

    it('scales durations proportionally for a shorter cycle', () => {
      const result = scalePhaseDurations(21);
      // 5 * (21/28) = 3.75 → 4
      // 8 * (21/28) = 6 → 6
      // 1 * (21/28) = 0.75 → 1
      // 7 * (21/28) = 5.25 → 5
      // lateLuteal = 21 - (4 + 6 + 1 + 5) = 5
      expect(result.menstrual).toBe(4);
      expect(result.follicular).toBe(6);
      expect(result.ovulation).toBe(1);
      expect(result.earlyLuteal).toBe(5);
      expect(result.lateLuteal).toBe(5);
    });

    it('ensures scaled durations sum exactly to the average cycle length', () => {
      const testLengths = [21, 24, 25, 26, 28, 30, 32, 35, 40];
      for (const length of testLengths) {
        const result = scalePhaseDurations(length);
        const sum =
          result.menstrual +
          result.follicular +
          result.ovulation +
          result.earlyLuteal +
          result.lateLuteal;
        expect(sum).toBe(length);
      }
    });

    it('handles edge case of very short cycle (e.g., 14 days)', () => {
      const result = scalePhaseDurations(14);
      const sum =
        result.menstrual +
        result.follicular +
        result.ovulation +
        result.earlyLuteal +
        result.lateLuteal;
      expect(sum).toBe(14);
    });

    it('handles edge case of very long cycle (e.g., 45 days)', () => {
      const result = scalePhaseDurations(45);
      const sum =
        result.menstrual +
        result.follicular +
        result.ovulation +
        result.earlyLuteal +
        result.lateLuteal;
      expect(sum).toBe(45);
    });
  });
});

describe('generatePredictions', () => {
  const startDate = new Date(2024, 0, 1); // Jan 1, 2024
  const currentDate = new Date(2024, 0, 1); // Same day (day 1 of cycle)

  describe('coverage and structure', () => {
    it('generates predictions covering exactly 60 days', () => {
      const predictions = generatePredictions(startDate, currentDate);
      const totalDays = predictions.reduce((sum, p) => sum + (p.endDay - p.startDay + 1), 0);
      expect(totalDays).toBe(PREDICTION_DAYS);
    });

    it('starts at day 1 and ends at day 60', () => {
      const predictions = generatePredictions(startDate, currentDate);
      expect(predictions[0].startDay).toBe(1);
      expect(predictions[predictions.length - 1].endDay).toBe(60);
    });

    it('has no gaps between predictions', () => {
      const predictions = generatePredictions(startDate, currentDate);
      for (let i = 1; i < predictions.length; i++) {
        expect(predictions[i].startDay).toBe(predictions[i - 1].endDay + 1);
      }
    });

    it('has no overlaps between predictions', () => {
      const predictions = generatePredictions(startDate, currentDate);
      for (let i = 1; i < predictions.length; i++) {
        expect(predictions[i].startDay).toBeGreaterThan(predictions[i - 1].endDay);
      }
    });

    it('has contiguous dates with no gaps', () => {
      const predictions = generatePredictions(startDate, currentDate);
      for (let i = 1; i < predictions.length; i++) {
        const prevEnd = predictions[i - 1].endDate;
        const currStart = predictions[i].startDate;
        const diffMs = currStart.getTime() - prevEnd.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        expect(diffDays).toBe(1); // Next day
      }
    });

    it('startDate of first prediction equals currentDate', () => {
      const predictions = generatePredictions(startDate, currentDate);
      const first = predictions[0];
      expect(first.startDate.getFullYear()).toBe(currentDate.getFullYear());
      expect(first.startDate.getMonth()).toBe(currentDate.getMonth());
      expect(first.startDate.getDate()).toBe(currentDate.getDate());
    });
  });

  describe('standard 28-day durations (fewer than 2 historical records)', () => {
    it('uses standard durations when no options provided', () => {
      const predictions = generatePredictions(startDate, currentDate);
      // Day 1 of cycle = Menstrual phase, which lasts 5 days
      expect(predictions[0].phase).toBe(CyclePhase.MENSTRUAL);
      expect(predictions[0].endDay).toBe(5);
    });

    it('uses standard durations when fewer than 2 historical records', () => {
      const predictions = generatePredictions(startDate, currentDate, {
        historicalCycleLengths: [30], // Only 1 record
      });
      // Should still use standard 28-day durations
      expect(predictions[0].phase).toBe(CyclePhase.MENSTRUAL);
      expect(predictions[0].endDay).toBe(5);
    });

    it('cycles through all phases in order', () => {
      const predictions = generatePredictions(startDate, currentDate);
      const phases = predictions.map((p) => p.phase);
      // First cycle: Menstrual, Follicular, Ovulation, Early Luteal, Late Luteal
      expect(phases[0]).toBe(CyclePhase.MENSTRUAL);
      expect(phases[1]).toBe(CyclePhase.FOLLICULAR);
      expect(phases[2]).toBe(CyclePhase.OVULATION);
      expect(phases[3]).toBe(CyclePhase.EARLY_LUTEAL);
      expect(phases[4]).toBe(CyclePhase.LATE_LUTEAL);
      // Second cycle starts
      expect(phases[5]).toBe(CyclePhase.MENSTRUAL);
    });
  });

  describe('scaled durations (2+ historical records)', () => {
    it('uses scaled durations when 2+ historical records provided', () => {
      const predictions = generatePredictions(startDate, currentDate, {
        historicalCycleLengths: [30, 32], // Average = 31
      });
      const totalDays = predictions.reduce((sum, p) => sum + (p.endDay - p.startDay + 1), 0);
      expect(totalDays).toBe(60);
    });

    it('still covers exactly 60 days with scaled durations', () => {
      const predictions = generatePredictions(startDate, currentDate, {
        historicalCycleLengths: [24, 26],
      });
      expect(predictions[0].startDay).toBe(1);
      expect(predictions[predictions.length - 1].endDay).toBe(60);
    });
  });

  describe('custom durations take priority', () => {
    it('uses custom durations over historical scaling', () => {
      const customDurations: PhaseDurations = {
        menstrual: 4,
        follicular: 10,
        ovulation: 2,
        earlyLuteal: 6,
        lateLuteal: 6,
      };
      const predictions = generatePredictions(startDate, currentDate, {
        customDurations,
        historicalCycleLengths: [30, 32], // Should be ignored
      });
      // First phase should be menstrual with 4 days
      expect(predictions[0].phase).toBe(CyclePhase.MENSTRUAL);
      expect(predictions[0].endDay).toBe(4);
    });
  });

  describe('mid-cycle start', () => {
    it('correctly handles predictions starting mid-cycle', () => {
      // Start date Jan 1, current date Jan 10 = day 10 (Follicular phase, day 5 of 8)
      const midCycleDate = new Date(2024, 0, 10);
      const predictions = generatePredictions(startDate, midCycleDate);

      // Day 10 of cycle = Follicular (days 6-13), so 4 days remain in Follicular
      expect(predictions[0].phase).toBe(CyclePhase.FOLLICULAR);
      expect(predictions[0].endDay).toBe(4); // 4 days remaining in follicular

      // Total should still be 60
      const totalDays = predictions.reduce((sum, p) => sum + (p.endDay - p.startDay + 1), 0);
      expect(totalDays).toBe(60);
    });

    it('handles predictions starting in overdue cycle (wraps around)', () => {
      // Start date Jan 1, current date Feb 5 = day 36 (overdue, wraps to day 8 = Follicular)
      const overdueDate = new Date(2024, 1, 5);
      const predictions = generatePredictions(startDate, overdueDate);

      const totalDays = predictions.reduce((sum, p) => sum + (p.endDay - p.startDay + 1), 0);
      expect(totalDays).toBe(60);
      expect(predictions[0].startDay).toBe(1);
      expect(predictions[predictions.length - 1].endDay).toBe(60);
    });
  });
});
