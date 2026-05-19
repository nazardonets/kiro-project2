import * as fc from 'fast-check';
import { describe, it, expect, beforeEach } from 'vitest';

import { CyclePhase, SurveyResponse } from '@/lib/types';

import { GuidanceService, countSentences } from './guidance-service';
import {
  Q1_OPTIONS,
  Q2_OPTIONS,
  Q3_OPTIONS,
  Q4_OPTIONS,
  Q5_OPTIONS,
  Q6_OPTIONS,
} from './survey-calibration';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a random cycle phase */
const cyclePhaseArb = fc.constantFrom(
  CyclePhase.MENSTRUAL,
  CyclePhase.FOLLICULAR,
  CyclePhase.OVULATION,
  CyclePhase.EARLY_LUTEAL,
  CyclePhase.LATE_LUTEAL,
);

/** Generate a valid Q1 response (single select) */
const q1OptionArb = fc.constantFrom(...Q1_OPTIONS);

/** Generate a valid Q2 response (single select) */
const q2OptionArb = fc.constantFrom(...Q2_OPTIONS);

/** Generate a valid Q3 response (single select) */
const q3OptionArb = fc.constantFrom(...Q3_OPTIONS);

/** Generate valid Q4 responses (multi-select, at least 1) */
const q4OptionsArb = fc
  .subarray([...Q4_OPTIONS], { minLength: 1 })
  .filter((arr) => arr.length >= 1);

/** Generate a valid Q5 response (single select) */
const q5OptionArb = fc.constantFrom(...Q5_OPTIONS);

/** Generate a valid Q6 response (single select) */
const q6OptionArb = fc.constantFrom(...Q6_OPTIONS);

/** Generate a complete set of valid survey responses */
const surveyResponsesArb = fc
  .tuple(q1OptionArb, q2OptionArb, q3OptionArb, q4OptionsArb, q5OptionArb, q6OptionArb)
  .map(([q1, q2, q3, q4, q5, q6]): SurveyResponse[] => {
    const now = new Date().toISOString();
    const userId = 'user-test';

    return [
      {
        id: 'resp-1',
        primary_user_id: userId,
        question_number: 1,
        selected_options: [q1],
        free_text: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'resp-2',
        primary_user_id: userId,
        question_number: 2,
        selected_options: [q2],
        free_text: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'resp-3',
        primary_user_id: userId,
        question_number: 3,
        selected_options: [q3],
        free_text: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'resp-4',
        primary_user_id: userId,
        question_number: 4,
        selected_options: [...q4],
        free_text: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'resp-5',
        primary_user_id: userId,
        question_number: 5,
        selected_options: [q5],
        free_text: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'resp-6',
        primary_user_id: userId,
        question_number: 6,
        selected_options: [q6],
        free_text: null,
        created_at: now,
        updated_at: now,
      },
    ];
  });

// ─── Property 25: Daily Summary Structure ────────────────────────────────────

/**
 * **Validates: Requirements 15.1, 15.2, 15.3**
 *
 * Property 25: Daily Summary Structure
 *
 * For any generated Daily_Summary, the "Today's State" section SHALL contain
 * the phase name and be no more than 3 sentences, the "Best Approach" section
 * SHALL contain 1-3 items, and the "Avoid This" section SHALL contain 1-3 items.
 */
describe('Property 25: Daily Summary Structure', () => {
  let service: GuidanceService;

  beforeEach(() => {
    service = new GuidanceService();
  });

  it('generateDailySummary: todaysState contains the phase name for any phase', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const summary = service.generateDailySummary(phase);

        // Phase name should appear in todaysState (with underscore replaced by space)
        const phaseName = phase.replace('_', ' ');
        expect(summary.todaysState.toLowerCase()).toContain(phaseName);
      }),
      { numRuns: 100 },
    );
  });

  it('generateDailySummary: todaysState has no more than 3 sentences for any phase', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const summary = service.generateDailySummary(phase);
        const sentenceCount = countSentences(summary.todaysState);

        expect(sentenceCount).toBeGreaterThanOrEqual(1);
        expect(sentenceCount).toBeLessThanOrEqual(3);
      }),
      { numRuns: 100 },
    );
  });

  it('generateDailySummary: bestApproach has 1-3 items for any phase', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const summary = service.generateDailySummary(phase);

        expect(summary.bestApproach.length).toBeGreaterThanOrEqual(1);
        expect(summary.bestApproach.length).toBeLessThanOrEqual(3);
      }),
      { numRuns: 100 },
    );
  });

  it('generateDailySummary: avoidThis has 1-3 items for any phase', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const summary = service.generateDailySummary(phase);

        expect(summary.avoidThis.length).toBeGreaterThanOrEqual(1);
        expect(summary.avoidThis.length).toBeLessThanOrEqual(3);
      }),
      { numRuns: 100 },
    );
  });

  it('generateCalibratedDailySummary: todaysState contains the phase name for any phase and survey responses', () => {
    fc.assert(
      fc.property(cyclePhaseArb, surveyResponsesArb, (phase, responses) => {
        const summary = service.generateCalibratedDailySummary(phase, responses);

        // Phase name should appear in todaysState (with underscore replaced by space)
        const phaseName = phase.replace('_', ' ');
        expect(summary.todaysState.toLowerCase()).toContain(phaseName);
      }),
      { numRuns: 200 },
    );
  });

  it('generateCalibratedDailySummary: todaysState has no more than 3 sentences for any phase and survey responses', () => {
    fc.assert(
      fc.property(cyclePhaseArb, surveyResponsesArb, (phase, responses) => {
        const summary = service.generateCalibratedDailySummary(phase, responses);
        const sentenceCount = countSentences(summary.todaysState);

        expect(sentenceCount).toBeGreaterThanOrEqual(1);
        expect(sentenceCount).toBeLessThanOrEqual(3);
      }),
      { numRuns: 200 },
    );
  });

  it('generateCalibratedDailySummary: bestApproach has 1-3 items for any phase and survey responses', () => {
    fc.assert(
      fc.property(cyclePhaseArb, surveyResponsesArb, (phase, responses) => {
        const summary = service.generateCalibratedDailySummary(phase, responses);

        expect(summary.bestApproach.length).toBeGreaterThanOrEqual(1);
        expect(summary.bestApproach.length).toBeLessThanOrEqual(3);
      }),
      { numRuns: 200 },
    );
  });

  it('generateCalibratedDailySummary: avoidThis has 1-3 items for any phase and survey responses', () => {
    fc.assert(
      fc.property(cyclePhaseArb, surveyResponsesArb, (phase, responses) => {
        const summary = service.generateCalibratedDailySummary(phase, responses);

        expect(summary.avoidThis.length).toBeGreaterThanOrEqual(1);
        expect(summary.avoidThis.length).toBeLessThanOrEqual(3);
      }),
      { numRuns: 200 },
    );
  });
});

// ─── Property 26: Decision Support Content Bounds ────────────────────────────

/**
 * **Validates: Requirements 16.1, 16.2, 16.3**
 *
 * Property 26: Decision Support Content Bounds
 *
 * For any Cycle_Phase, the system SHALL generate 3-5 behavioral prompts
 * (each max 280 characters and max 2 sentences) and 2-4 situational recommendations.
 */
describe('Property 26: Decision Support Content Bounds', () => {
  let service: GuidanceService;

  beforeEach(() => {
    service = new GuidanceService();
  });

  it('generates 3-5 behavioral prompts for any cycle phase', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const support = service.generateDecisionSupport(phase);

        expect(support.behavioralPrompts.length).toBeGreaterThanOrEqual(3);
        expect(support.behavioralPrompts.length).toBeLessThanOrEqual(5);
      }),
      { numRuns: 200 },
    );
  });

  it('each behavioral prompt is max 280 characters for any cycle phase', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const support = service.generateDecisionSupport(phase);

        for (const prompt of support.behavioralPrompts) {
          expect(prompt.length).toBeLessThanOrEqual(280);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('each behavioral prompt has max 2 sentences for any cycle phase', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const support = service.generateDecisionSupport(phase);

        for (const prompt of support.behavioralPrompts) {
          const sentences = countSentences(prompt);
          expect(sentences).toBeLessThanOrEqual(2);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('generates 2-4 situational recommendations for any cycle phase', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const support = service.generateDecisionSupport(phase);

        expect(support.situationalRecommendations.length).toBeGreaterThanOrEqual(2);
        expect(support.situationalRecommendations.length).toBeLessThanOrEqual(4);
      }),
      { numRuns: 200 },
    );
  });

  it('each situational recommendation has non-empty scenario and recommendation fields for any cycle phase', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const support = service.generateDecisionSupport(phase);

        for (const rec of support.situationalRecommendations) {
          expect(rec.scenario).toBeDefined();
          expect(rec.scenario.length).toBeGreaterThan(0);
          expect(rec.recommendation).toBeDefined();
          expect(rec.recommendation.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 },
    );
  });
});
