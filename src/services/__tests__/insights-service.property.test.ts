import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { CyclePhase } from '@/lib/types';

import { InsightsService } from '../insights-service';

/**
 * Property 23: Phase Content Structure Completeness
 *
 * *For any* of the five Cycle_Phases, the generated insights content SHALL contain:
 * at least 3 emotional tendencies, at least 2 cognitive tendencies, at least 2
 * behavioral tendencies, an energy level indicator, and at least 2 communication
 * tendencies. All five phases SHALL use the same set of content categories.
 *
 * **Validates: Requirements 13.1, 13.2, 13.3, 13.5, 13.7**
 */
describe('Property 23: Phase Content Structure Completeness', () => {
  const service = new InsightsService();

  const cyclePhaseArb = fc.constantFrom(
    CyclePhase.MENSTRUAL,
    CyclePhase.FOLLICULAR,
    CyclePhase.OVULATION,
    CyclePhase.EARLY_LUTEAL,
    CyclePhase.LATE_LUTEAL,
  );

  it('should contain at least 3 emotional tendencies for any phase', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const insights = service.generateBaseInsights(phase);
        expect(insights.emotionalTendencies.length).toBeGreaterThanOrEqual(3);
      }),
    );
  });

  it('should contain at least 2 cognitive tendencies for any phase', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const insights = service.generateBaseInsights(phase);
        expect(insights.cognitiveTendencies.length).toBeGreaterThanOrEqual(2);
      }),
    );
  });

  it('should contain at least 2 behavioral tendencies for any phase', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const insights = service.generateBaseInsights(phase);
        expect(insights.behavioralTendencies.length).toBeGreaterThanOrEqual(2);
      }),
    );
  });

  it('should contain an energy level indicator with valid level and non-empty summary for any phase', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const insights = service.generateBaseInsights(phase);
        expect(insights.energyLevel).toBeDefined();
        expect(['Low', 'Moderate', 'High']).toContain(insights.energyLevel.level);
        expect(insights.energyLevel.summary.length).toBeGreaterThan(0);
      }),
    );
  });

  it('should contain at least 2 communication tendencies for any phase', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const insights = service.generateBaseInsights(phase);
        expect(insights.communicationTendencies.length).toBeGreaterThanOrEqual(2);
      }),
    );
  });

  it('should use the same set of content category keys across all 5 phases', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const allInsights = service.generateAllBaseInsights();
        const referenceKeys = Object.keys(allInsights[0]).sort();

        const phaseInsights = allInsights.find((i) => i.phase === phase);
        expect(phaseInsights).toBeDefined();
        expect(Object.keys(phaseInsights as object).sort()).toEqual(referenceKeys);
      }),
    );
  });
});
