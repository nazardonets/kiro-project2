import { describe, it, expect, beforeEach } from 'vitest';

import { CyclePhase, SurveyResponse } from '@/lib/types';

import { InsightsService } from './insights-service';

describe('InsightsService', () => {
  let service: InsightsService;

  beforeEach(() => {
    service = new InsightsService();
  });

  // ─── Helper to create mock survey responses ─────────────────────────────

  function createSurveyResponses(
    overrides?: Partial<Record<number, { selected_options: string[]; free_text?: string | null }>>,
  ): SurveyResponse[] {
    const defaults: Record<number, { selected_options: string[]; free_text: string | null }> = {
      1: { selected_options: ['Somewhat predictable'], free_text: null },
      2: { selected_options: ['Moderately'], free_text: null },
      3: { selected_options: ['Mostly consistent across all phases'], free_text: null },
      4: { selected_options: ['Feeling unheard or not understood'], free_text: null },
      5: { selected_options: ['Emotional reassurance and empathy'], free_text: null },
      6: {
        selected_options: ["Check in gently, but don't push for deep conversation"],
        free_text: null,
      },
    };

    const merged = { ...defaults, ...overrides };

    return Object.entries(merged).map(([qNum, data]) => ({
      id: `response-${qNum}`,
      primary_user_id: 'user-1',
      question_number: parseInt(qNum),
      selected_options: data.selected_options,
      free_text: data.free_text ?? null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }));
  }

  // ─── Base Insights Generation ───────────────────────────────────────────

  describe('generateBaseInsights', () => {
    const allPhases = [
      CyclePhase.MENSTRUAL,
      CyclePhase.FOLLICULAR,
      CyclePhase.OVULATION,
      CyclePhase.EARLY_LUTEAL,
      CyclePhase.LATE_LUTEAL,
    ];

    it.each(allPhases)('generates at least 3 emotional tendencies for %s phase', (phase) => {
      const insights = service.generateBaseInsights(phase);
      expect(insights.emotionalTendencies.length).toBeGreaterThanOrEqual(3);
    });

    it.each(allPhases)('generates at least 2 cognitive tendencies for %s phase', (phase) => {
      const insights = service.generateBaseInsights(phase);
      expect(insights.cognitiveTendencies.length).toBeGreaterThanOrEqual(2);
    });

    it.each(allPhases)('generates at least 2 behavioral tendencies for %s phase', (phase) => {
      const insights = service.generateBaseInsights(phase);
      expect(insights.behavioralTendencies.length).toBeGreaterThanOrEqual(2);
    });

    it.each(allPhases)('generates energy level indicator for %s phase', (phase) => {
      const insights = service.generateBaseInsights(phase);
      expect(insights.energyLevel).toBeDefined();
      expect(['Low', 'Moderate', 'High']).toContain(insights.energyLevel.level);
      expect(insights.energyLevel.summary).toBeTruthy();
    });

    it.each(allPhases)('generates at least 2 communication tendencies for %s phase', (phase) => {
      const insights = service.generateBaseInsights(phase);
      expect(insights.communicationTendencies.length).toBeGreaterThanOrEqual(2);
    });

    it.each(allPhases)('energy level summary is max 2 sentences for %s phase', (phase) => {
      const insights = service.generateBaseInsights(phase);
      const sentences = insights.energyLevel.summary.split(/[.!?]+/).filter(Boolean);
      expect(sentences.length).toBeLessThanOrEqual(2);
    });

    it('uses probabilistic framing in emotional tendencies', () => {
      const insights = service.generateBaseInsights(CyclePhase.MENSTRUAL);
      const probabilisticTerms = ['may', 'might', 'common', 'tend', 'some', 'many', 'often'];

      for (const tendency of insights.emotionalTendencies) {
        const hasProbabilistic = probabilisticTerms.some((term) =>
          tendency.toLowerCase().includes(term),
        );
        expect(hasProbabilistic).toBe(true);
      }
    });

    it('returns consistent structure across all phases', () => {
      const allInsights = service.generateAllBaseInsights();
      expect(allInsights).toHaveLength(5);

      for (const insights of allInsights) {
        expect(insights).toHaveProperty('phase');
        expect(insights).toHaveProperty('emotionalTendencies');
        expect(insights).toHaveProperty('cognitiveTendencies');
        expect(insights).toHaveProperty('behavioralTendencies');
        expect(insights).toHaveProperty('energyLevel');
        expect(insights).toHaveProperty('communicationTendencies');
      }
    });
  });

  // ─── All Base Insights ──────────────────────────────────────────────────

  describe('generateAllBaseInsights', () => {
    it('generates insights for all 5 phases', () => {
      const allInsights = service.generateAllBaseInsights();
      expect(allInsights).toHaveLength(5);

      const phases = allInsights.map((i) => i.phase);
      expect(phases).toContain(CyclePhase.MENSTRUAL);
      expect(phases).toContain(CyclePhase.FOLLICULAR);
      expect(phases).toContain(CyclePhase.OVULATION);
      expect(phases).toContain(CyclePhase.EARLY_LUTEAL);
      expect(phases).toContain(CyclePhase.LATE_LUTEAL);
    });

    it('uses the same content categories for each phase', () => {
      const allInsights = service.generateAllBaseInsights();
      const keys = Object.keys(allInsights[0]);

      for (const insights of allInsights) {
        expect(Object.keys(insights)).toEqual(keys);
      }
    });
  });

  // ─── Calibrated Insights ────────────────────────────────────────────────

  describe('generateCalibratedInsights', () => {
    it('returns calibrationApplied: true when survey responses are complete', () => {
      const responses = createSurveyResponses();
      const insights = service.generateCalibratedInsights(CyclePhase.MENSTRUAL, responses);
      expect(insights.calibrationApplied).toBe(true);
    });

    it('returns calibrationApplied: false when survey responses are incomplete', () => {
      const incompleteResponses = createSurveyResponses().slice(0, 3);
      const insights = service.generateCalibratedInsights(
        CyclePhase.MENSTRUAL,
        incompleteResponses,
      );
      expect(insights.calibrationApplied).toBe(false);
    });

    it('still meets minimum content requirements after calibration', () => {
      const responses = createSurveyResponses();
      const insights = service.generateCalibratedInsights(CyclePhase.MENSTRUAL, responses);

      expect(insights.emotionalTendencies.length).toBeGreaterThanOrEqual(3);
      expect(insights.cognitiveTendencies.length).toBeGreaterThanOrEqual(2);
      expect(insights.behavioralTendencies.length).toBeGreaterThanOrEqual(2);
      expect(insights.communicationTendencies.length).toBeGreaterThanOrEqual(2);
      expect(insights.energyLevel).toBeDefined();
    });

    // Q1: Confidence level
    describe('Q1 - confidence level modifier', () => {
      it('adds variability qualifiers for low confidence (Unpredictable)', () => {
        const responses = createSurveyResponses({
          1: { selected_options: ['Unpredictable'], free_text: null },
        });
        const insights = service.generateCalibratedInsights(CyclePhase.FOLLICULAR, responses);

        const hasVariabilityQualifier = insights.emotionalTendencies.some((t) =>
          t.includes('every person is different'),
        );
        expect(hasVariabilityQualifier).toBe(true);
      });

      it('does not add variability qualifiers for high confidence', () => {
        const responses = createSurveyResponses({
          1: { selected_options: ['Very predictable'], free_text: null },
        });
        const baseInsights = service.generateBaseInsights(CyclePhase.FOLLICULAR);
        const insights = service.generateCalibratedInsights(CyclePhase.FOLLICULAR, responses);

        // High confidence should keep content as-is (same length as base)
        expect(insights.emotionalTendencies.length).toBeGreaterThanOrEqual(
          baseInsights.emotionalTendencies.length,
        );
      });
    });

    // Q2: Emotional emphasis
    describe('Q2 - emotional emphasis modifier', () => {
      it('adds emphasis context for very strongly emotional', () => {
        const responses = createSurveyResponses({
          2: { selected_options: ['Very strongly'], free_text: null },
        });
        const insights = service.generateCalibratedInsights(CyclePhase.MENSTRUAL, responses);

        const hasEmphasis = insights.emotionalTendencies.some((t) =>
          t.includes('particularly noticeable'),
        );
        expect(hasEmphasis).toBe(true);
      });

      it('limits emotional tendencies for reduced emphasis', () => {
        const responses = createSurveyResponses({
          2: { selected_options: ['Slightly'], free_text: null },
        });
        const insights = service.generateCalibratedInsights(CyclePhase.MENSTRUAL, responses);

        // Reduced emphasis should still have at least 3 (minimum requirement)
        expect(insights.emotionalTendencies.length).toBeGreaterThanOrEqual(3);
      });
    });

    // Q3: Social energy
    describe('Q3 - social energy modifier', () => {
      it('adds give-space context for low-energy phases when user needs alone time', () => {
        const responses = createSurveyResponses({
          3: { selected_options: ['I need more alone time in certain phases'], free_text: null },
        });
        const insights = service.generateCalibratedInsights(CyclePhase.MENSTRUAL, responses);

        const hasSpaceContext = insights.behavioralTendencies.some(
          (t) => t.includes('alone time') || t.includes('personal space'),
        );
        expect(hasSpaceContext).toBe(true);
      });

      it('adds engage-more context for high-energy phases when user is more social', () => {
        const responses = createSurveyResponses({
          3: {
            selected_options: ['I become significantly more social in some phases'],
            free_text: null,
          },
        });
        const insights = service.generateCalibratedInsights(CyclePhase.OVULATION, responses);

        const hasEngageContext = insights.behavioralTendencies.some(
          (t) => t.includes('social connection') || t.includes('shared activities'),
        );
        expect(hasEngageContext).toBe(true);
      });
    });

    // Q4: Avoidance triggers
    describe('Q4 - avoidance triggers modifier', () => {
      it('adds trigger context for sensitive phases', () => {
        const responses = createSurveyResponses({
          4: {
            selected_options: ['Feeling unheard or not understood', 'Stress / workload / fatigue'],
            free_text: null,
          },
        });
        const insights = service.generateCalibratedInsights(CyclePhase.LATE_LUTEAL, responses);

        const hasUnheardTrigger = insights.behavioralTendencies.some(
          (t) => t.includes('unheard') || t.includes('dismissed'),
        );
        const hasStressTrigger = insights.behavioralTendencies.some(
          (t) => t.includes('Stress') || t.includes('workload'),
        );
        expect(hasUnheardTrigger).toBe(true);
        expect(hasStressTrigger).toBe(true);
      });

      it('does not add trigger context for non-sensitive phases', () => {
        const responses = createSurveyResponses({
          4: { selected_options: ['Feeling unheard or not understood'], free_text: null },
        });
        const insights = service.generateCalibratedInsights(CyclePhase.FOLLICULAR, responses);

        // For non-sensitive phases, behavioral tendencies should not have trigger additions
        // (though other modifiers may still apply)
        const hasUnheardTrigger = insights.behavioralTendencies.some(
          (t) => t.includes('unheard') || t.includes('dismissed'),
        );
        expect(hasUnheardTrigger).toBe(false);
      });
    });

    // Q5: Support style
    describe('Q5 - support style modifier', () => {
      it('adds space-related content for low-energy phases when support style is space', () => {
        const responses = createSurveyResponses({
          5: { selected_options: ['Space and minimal interaction'], free_text: null },
        });
        const insights = service.generateCalibratedInsights(CyclePhase.MENSTRUAL, responses);

        const hasSpaceContent = insights.behavioralTendencies.some(
          (t) => t.includes('space') || t.includes('minimal interaction'),
        );
        expect(hasSpaceContent).toBe(true);
      });

      it('adds practical help content for low-energy phases when support style is practical', () => {
        const responses = createSurveyResponses({
          5: { selected_options: ['Practical help (tasks, comfort, routines)'], free_text: null },
        });
        const insights = service.generateCalibratedInsights(CyclePhase.LATE_LUTEAL, responses);

        const hasPracticalContent = insights.behavioralTendencies.some(
          (t) => t.includes('Practical help') || t.includes('tasks'),
        );
        expect(hasPracticalContent).toBe(true);
      });
    });

    // Q6: Communication approach
    describe('Q6 - communication approach modifier', () => {
      it('adds gentle check-in guidance', () => {
        const responses = createSurveyResponses({
          6: {
            selected_options: ["Check in gently, but don't push for deep conversation"],
            free_text: null,
          },
        });
        const insights = service.generateCalibratedInsights(CyclePhase.MENSTRUAL, responses);

        const hasCheckInGuidance = insights.communicationTendencies.some(
          (t) => t.includes('gentle') || t.includes('brief check-ins'),
        );
        expect(hasCheckInGuidance).toBe(true);
      });

      it('adds direct communication guidance', () => {
        const responses = createSurveyResponses({
          6: { selected_options: ['Be direct and ask what I need'], free_text: null },
        });
        const insights = service.generateCalibratedInsights(CyclePhase.FOLLICULAR, responses);

        const hasDirectGuidance = insights.communicationTendencies.some((t) =>
          t.includes('direct questions'),
        );
        expect(hasDirectGuidance).toBe(true);
      });
    });
  });

  // ─── All Calibrated Insights ────────────────────────────────────────────

  describe('generateAllCalibratedInsights', () => {
    it('generates calibrated insights for all 5 phases', () => {
      const responses = createSurveyResponses();
      const allInsights = service.generateAllCalibratedInsights(responses);

      expect(allInsights).toHaveLength(5);
      expect(allInsights.every((i) => i.calibrationApplied)).toBe(true);
    });

    it('maintains consistent structure across all calibrated phases', () => {
      const responses = createSurveyResponses();
      const allInsights = service.generateAllCalibratedInsights(responses);

      for (const insights of allInsights) {
        expect(insights).toHaveProperty('phase');
        expect(insights).toHaveProperty('emotionalTendencies');
        expect(insights).toHaveProperty('cognitiveTendencies');
        expect(insights).toHaveProperty('behavioralTendencies');
        expect(insights).toHaveProperty('energyLevel');
        expect(insights).toHaveProperty('communicationTendencies');
        expect(insights).toHaveProperty('calibrationApplied');
      }
    });

    it('meets minimum content requirements for all phases after calibration', () => {
      const responses = createSurveyResponses({
        1: { selected_options: ['Unpredictable'], free_text: null },
        2: { selected_options: ['Very strongly'], free_text: null },
        3: { selected_options: ['I need more alone time in certain phases'], free_text: null },
        4: {
          selected_options: ['Feeling unheard or not understood', 'Stress / workload / fatigue'],
          free_text: null,
        },
        5: { selected_options: ['Space and minimal interaction'], free_text: null },
        6: { selected_options: ['Give me space unless I initiate contact'], free_text: null },
      });
      const allInsights = service.generateAllCalibratedInsights(responses);

      for (const insights of allInsights) {
        expect(insights.emotionalTendencies.length).toBeGreaterThanOrEqual(3);
        expect(insights.cognitiveTendencies.length).toBeGreaterThanOrEqual(2);
        expect(insights.behavioralTendencies.length).toBeGreaterThanOrEqual(2);
        expect(insights.communicationTendencies.length).toBeGreaterThanOrEqual(2);
        expect(['Low', 'Moderate', 'High']).toContain(insights.energyLevel.level);
        expect(insights.energyLevel.summary).toBeTruthy();
      }
    });
  });
});
