import { describe, it, expect, beforeEach } from 'vitest';

import { CyclePhase, SurveyResponse } from '@/lib/types';
import { BEHAVIORAL_PROMPT_MAX_LENGTH } from '@/lib/constants';

import {
  GuidanceService,
  countSentences,
  MIN_BEHAVIORAL_PROMPTS,
  MAX_BEHAVIORAL_PROMPTS,
  MAX_PROMPT_SENTENCES,
  MIN_SITUATIONAL_RECOMMENDATIONS,
  MAX_SITUATIONAL_RECOMMENDATIONS,
} from './guidance-service';

describe('GuidanceService', () => {
  let service: GuidanceService;

  beforeEach(() => {
    service = new GuidanceService();
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

  // ─── Base Guidance Generation ───────────────────────────────────────────

  describe('generateBaseGuidance', () => {
    const allPhases = [
      CyclePhase.MENSTRUAL,
      CyclePhase.FOLLICULAR,
      CyclePhase.OVULATION,
      CyclePhase.EARLY_LUTEAL,
      CyclePhase.LATE_LUTEAL,
    ];

    it.each(allPhases)('generates 3-5 supportive actions for %s phase', (phase) => {
      const guidance = service.generateBaseGuidance(phase);
      expect(guidance.supportiveActions.length).toBeGreaterThanOrEqual(3);
      expect(guidance.supportiveActions.length).toBeLessThanOrEqual(5);
    });

    it.each(allPhases)('generates 2-4 triggers to avoid for %s phase', (phase) => {
      const guidance = service.generateBaseGuidance(phase);
      expect(guidance.triggersToAvoid.length).toBeGreaterThanOrEqual(2);
      expect(guidance.triggersToAvoid.length).toBeLessThanOrEqual(4);
    });

    it.each(allPhases)('generates 2-4 communication strategies for %s phase', (phase) => {
      const guidance = service.generateBaseGuidance(phase);
      expect(guidance.communicationStrategies.length).toBeGreaterThanOrEqual(2);
      expect(guidance.communicationStrategies.length).toBeLessThanOrEqual(4);
    });

    it.each(allPhases)('generates 2-4 discouraged patterns for %s phase', (phase) => {
      const guidance = service.generateBaseGuidance(phase);
      expect(guidance.discouragedPatterns.length).toBeGreaterThanOrEqual(2);
      expect(guidance.discouragedPatterns.length).toBeLessThanOrEqual(4);
    });

    it('uses suggestion-oriented language in supportive actions', () => {
      const guidance = service.generateBaseGuidance(CyclePhase.MENSTRUAL);
      const suggestionTerms = ['consider', 'might', 'could', 'may'];

      for (const action of guidance.supportiveActions) {
        const hasSuggestion = suggestionTerms.some((term) =>
          action.toLowerCase().includes(term),
        );
        expect(hasSuggestion).toBe(true);
      }
    });

    it('uses probabilistic framing in triggers to avoid', () => {
      const guidance = service.generateBaseGuidance(CyclePhase.LATE_LUTEAL);
      const probabilisticTerms = ['may', 'might', 'could', 'can'];

      for (const trigger of guidance.triggersToAvoid) {
        const hasProbabilistic = probabilisticTerms.some((term) =>
          trigger.toLowerCase().includes(term),
        );
        expect(hasProbabilistic).toBe(true);
      }
    });

    it('returns consistent structure across all phases', () => {
      const allGuidance = service.generateAllBaseGuidance();
      expect(allGuidance).toHaveLength(5);

      for (const guidance of allGuidance) {
        expect(guidance).toHaveProperty('phase');
        expect(guidance).toHaveProperty('supportiveActions');
        expect(guidance).toHaveProperty('triggersToAvoid');
        expect(guidance).toHaveProperty('communicationStrategies');
        expect(guidance).toHaveProperty('discouragedPatterns');
      }
    });
  });

  // ─── All Base Guidance ──────────────────────────────────────────────────

  describe('generateAllBaseGuidance', () => {
    it('generates guidance for all 5 phases', () => {
      const allGuidance = service.generateAllBaseGuidance();
      expect(allGuidance).toHaveLength(5);

      const phases = allGuidance.map((g) => g.phase);
      expect(phases).toContain(CyclePhase.MENSTRUAL);
      expect(phases).toContain(CyclePhase.FOLLICULAR);
      expect(phases).toContain(CyclePhase.OVULATION);
      expect(phases).toContain(CyclePhase.EARLY_LUTEAL);
      expect(phases).toContain(CyclePhase.LATE_LUTEAL);
    });

    it('uses the same content categories for each phase', () => {
      const allGuidance = service.generateAllBaseGuidance();
      const keys = Object.keys(allGuidance[0]);

      for (const guidance of allGuidance) {
        expect(Object.keys(guidance)).toEqual(keys);
      }
    });
  });

  // ─── Calibrated Guidance ────────────────────────────────────────────────

  describe('generateCalibratedGuidance', () => {
    it('returns calibrationApplied: true when survey responses are complete', () => {
      const responses = createSurveyResponses();
      const guidance = service.generateCalibratedGuidance(CyclePhase.MENSTRUAL, responses);
      expect(guidance.calibrationApplied).toBe(true);
    });

    it('returns calibrationApplied: false when survey responses are incomplete', () => {
      const incompleteResponses = createSurveyResponses().slice(0, 3);
      const guidance = service.generateCalibratedGuidance(CyclePhase.MENSTRUAL, incompleteResponses);
      expect(guidance.calibrationApplied).toBe(false);
    });

    it('still meets count bounds after calibration', () => {
      const responses = createSurveyResponses();
      const guidance = service.generateCalibratedGuidance(CyclePhase.MENSTRUAL, responses);

      expect(guidance.supportiveActions.length).toBeGreaterThanOrEqual(3);
      expect(guidance.supportiveActions.length).toBeLessThanOrEqual(5);
      expect(guidance.triggersToAvoid.length).toBeGreaterThanOrEqual(2);
      expect(guidance.triggersToAvoid.length).toBeLessThanOrEqual(4);
      expect(guidance.communicationStrategies.length).toBeGreaterThanOrEqual(2);
      expect(guidance.communicationStrategies.length).toBeLessThanOrEqual(4);
      expect(guidance.discouragedPatterns.length).toBeGreaterThanOrEqual(2);
      expect(guidance.discouragedPatterns.length).toBeLessThanOrEqual(4);
    });

    // Q1: Confidence level
    describe('Q1 - confidence level modifier', () => {
      it('adds variability qualifier for low confidence (Unpredictable)', () => {
        const responses = createSurveyResponses({
          1: { selected_options: ['Unpredictable'], free_text: null },
        });
        const guidance = service.generateCalibratedGuidance(CyclePhase.FOLLICULAR, responses);

        const hasVariability = guidance.supportiveActions.some((a) =>
          a.includes('every person is different'),
        );
        expect(hasVariability).toBe(true);
      });

      it('does not add variability qualifier for high confidence', () => {
        const responses = createSurveyResponses({
          1: { selected_options: ['Very predictable'], free_text: null },
        });
        const guidance = service.generateCalibratedGuidance(CyclePhase.FOLLICULAR, responses);

        const hasVariability = guidance.supportiveActions.some((a) =>
          a.includes('every person is different'),
        );
        expect(hasVariability).toBe(false);
      });
    });

    // Q2: Emotional emphasis
    describe('Q2 - emotional emphasis modifier', () => {
      it('adds sensitivity context for very heightened emphasis', () => {
        const responses = createSurveyResponses({
          2: { selected_options: ['Very strongly'], free_text: null },
        });
        const guidance = service.generateCalibratedGuidance(CyclePhase.MENSTRUAL, responses);

        const hasSensitivity = guidance.triggersToAvoid.some(
          (t) => t.includes('particularly intense') || t.includes('extra gentleness'),
        );
        expect(hasSensitivity).toBe(true);
      });

      it('adds mindfulness context for heightened emphasis', () => {
        const responses = createSurveyResponses({
          2: { selected_options: ['Strongly'], free_text: null },
        });
        const guidance = service.generateCalibratedGuidance(CyclePhase.FOLLICULAR, responses);

        const hasMindfulness = guidance.triggersToAvoid.some(
          (t) => t.includes('emotionally sensitive') || t.includes('extra mindful'),
        );
        expect(hasMindfulness).toBe(true);
      });
    });

    // Q3: Social energy
    describe('Q3 - social energy modifier', () => {
      it('adds space-related action for low-energy phases when user needs alone time', () => {
        const responses = createSurveyResponses({
          3: { selected_options: ['I need more alone time in certain phases'], free_text: null },
        });
        const guidance = service.generateCalibratedGuidance(CyclePhase.MENSTRUAL, responses);

        const hasSpaceAction = guidance.supportiveActions.some(
          (a) => a.includes('alone time') || a.includes('uninterrupted'),
        );
        expect(hasSpaceAction).toBe(true);
      });

      it('adds social action for high-energy phases when user is more social', () => {
        const responses = createSurveyResponses({
          3: {
            selected_options: ['I become significantly more social in some phases'],
            free_text: null,
          },
        });
        const guidance = service.generateCalibratedGuidance(CyclePhase.OVULATION, responses);

        const hasSocialAction = guidance.supportiveActions.some(
          (a) => a.includes('social activities') || a.includes('shared social'),
        );
        expect(hasSocialAction).toBe(true);
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
        const guidance = service.generateCalibratedGuidance(CyclePhase.LATE_LUTEAL, responses);

        const hasUnheardTrigger = guidance.triggersToAvoid.some(
          (t) => t.includes('unheard') || t.includes('full attention'),
        );
        const hasStressTrigger = guidance.triggersToAvoid.some(
          (t) => t.includes('workload') || t.includes('responsibilities'),
        );
        expect(hasUnheardTrigger).toBe(true);
        expect(hasStressTrigger).toBe(true);
      });

      it('does not add trigger context for non-sensitive phases', () => {
        const responses = createSurveyResponses({
          4: { selected_options: ['Feeling unheard or not understood'], free_text: null },
        });
        const guidance = service.generateCalibratedGuidance(CyclePhase.FOLLICULAR, responses);

        const hasUnheardTrigger = guidance.triggersToAvoid.some(
          (t) => t.includes('particularly sensitive to feeling unheard'),
        );
        expect(hasUnheardTrigger).toBe(false);
      });
    });

    // Q5: Support style
    describe('Q5 - support style modifier', () => {
      it('adds space-related action for low-energy phases when support style is space', () => {
        const responses = createSurveyResponses({
          5: { selected_options: ['Space and minimal interaction'], free_text: null },
        });
        const guidance = service.generateCalibratedGuidance(CyclePhase.MENSTRUAL, responses);

        const hasSpaceAction = guidance.supportiveActions.some(
          (a) => a.includes('space') || a.includes('hovering'),
        );
        expect(hasSpaceAction).toBe(true);
      });

      it('adds practical help action for low-energy phases when support style is practical', () => {
        const responses = createSurveyResponses({
          5: { selected_options: ['Practical help (tasks, comfort, routines)'], free_text: null },
        });
        const guidance = service.generateCalibratedGuidance(CyclePhase.LATE_LUTEAL, responses);

        const hasPracticalAction = guidance.supportiveActions.some(
          (a) => a.includes('practical tasks') || a.includes('cooking') || a.includes('tidying'),
        );
        expect(hasPracticalAction).toBe(true);
      });
    });

    // Q6: Communication approach
    describe('Q6 - communication approach modifier', () => {
      it('adds gentle check-in strategy', () => {
        const responses = createSurveyResponses({
          6: {
            selected_options: ["Check in gently, but don't push for deep conversation"],
            free_text: null,
          },
        });
        const guidance = service.generateCalibratedGuidance(CyclePhase.MENSTRUAL, responses);

        const hasCheckIn = guidance.communicationStrategies.some(
          (s) => s.includes('gentle') || s.includes('check-in'),
        );
        expect(hasCheckIn).toBe(true);
      });

      it('adds direct communication strategy', () => {
        const responses = createSurveyResponses({
          6: { selected_options: ['Be direct and ask what I need'], free_text: null },
        });
        const guidance = service.generateCalibratedGuidance(CyclePhase.FOLLICULAR, responses);

        const hasDirect = guidance.communicationStrategies.some(
          (s) => s.includes('directly') || s.includes('What do you need'),
        );
        expect(hasDirect).toBe(true);
      });
    });
  });

  // ─── All Calibrated Guidance ────────────────────────────────────────────

  describe('generateAllCalibratedGuidance', () => {
    it('generates calibrated guidance for all 5 phases', () => {
      const responses = createSurveyResponses();
      const allGuidance = service.generateAllCalibratedGuidance(responses);

      expect(allGuidance).toHaveLength(5);
      expect(allGuidance.every((g) => g.calibrationApplied)).toBe(true);
    });

    it('maintains consistent structure across all calibrated phases', () => {
      const responses = createSurveyResponses();
      const allGuidance = service.generateAllCalibratedGuidance(responses);

      for (const guidance of allGuidance) {
        expect(guidance).toHaveProperty('phase');
        expect(guidance).toHaveProperty('supportiveActions');
        expect(guidance).toHaveProperty('triggersToAvoid');
        expect(guidance).toHaveProperty('communicationStrategies');
        expect(guidance).toHaveProperty('discouragedPatterns');
        expect(guidance).toHaveProperty('calibrationApplied');
      }
    });

    it('meets count bounds for all phases after calibration with extreme settings', () => {
      const responses = createSurveyResponses({
        1: { selected_options: ['Unpredictable'], free_text: null },
        2: { selected_options: ['Very strongly'], free_text: null },
        3: { selected_options: ['I need more alone time in certain phases'], free_text: null },
        4: {
          selected_options: [
            'Feeling unheard or not understood',
            'Stress / workload / fatigue',
            'Social situations or overstimulation',
            'Relationship dynamics or communication tone',
          ],
          free_text: null,
        },
        5: { selected_options: ['Space and minimal interaction'], free_text: null },
        6: { selected_options: ['Give me space unless I initiate contact'], free_text: null },
      });
      const allGuidance = service.generateAllCalibratedGuidance(responses);

      for (const guidance of allGuidance) {
        expect(guidance.supportiveActions.length).toBeGreaterThanOrEqual(3);
        expect(guidance.supportiveActions.length).toBeLessThanOrEqual(5);
        expect(guidance.triggersToAvoid.length).toBeGreaterThanOrEqual(2);
        expect(guidance.triggersToAvoid.length).toBeLessThanOrEqual(4);
        expect(guidance.communicationStrategies.length).toBeGreaterThanOrEqual(2);
        expect(guidance.communicationStrategies.length).toBeLessThanOrEqual(4);
        expect(guidance.discouragedPatterns.length).toBeGreaterThanOrEqual(2);
        expect(guidance.discouragedPatterns.length).toBeLessThanOrEqual(4);
      }
    });
  });

  // ─── Decision Support Layer ───────────────────────────────────────────────

  describe('generateDecisionSupport', () => {
    const allPhases = [
      CyclePhase.MENSTRUAL,
      CyclePhase.FOLLICULAR,
      CyclePhase.OVULATION,
      CyclePhase.EARLY_LUTEAL,
      CyclePhase.LATE_LUTEAL,
    ];

    it.each(allPhases)('generates 3-5 behavioral prompts for %s phase', (phase) => {
      const support = service.generateDecisionSupport(phase);
      expect(support.behavioralPrompts.length).toBeGreaterThanOrEqual(MIN_BEHAVIORAL_PROMPTS);
      expect(support.behavioralPrompts.length).toBeLessThanOrEqual(MAX_BEHAVIORAL_PROMPTS);
    });

    it.each(allPhases)('generates 2-4 situational recommendations for %s phase', (phase) => {
      const support = service.generateDecisionSupport(phase);
      expect(support.situationalRecommendations.length).toBeGreaterThanOrEqual(
        MIN_SITUATIONAL_RECOMMENDATIONS,
      );
      expect(support.situationalRecommendations.length).toBeLessThanOrEqual(
        MAX_SITUATIONAL_RECOMMENDATIONS,
      );
    });

    it.each(allPhases)(
      'ensures all behavioral prompts are max 280 chars for %s phase',
      (phase) => {
        const support = service.generateDecisionSupport(phase);

        for (const prompt of support.behavioralPrompts) {
          expect(prompt.length).toBeLessThanOrEqual(BEHAVIORAL_PROMPT_MAX_LENGTH);
        }
      },
    );

    it.each(allPhases)(
      'ensures all behavioral prompts are max 2 sentences for %s phase',
      (phase) => {
        const support = service.generateDecisionSupport(phase);

        for (const prompt of support.behavioralPrompts) {
          const sentences = countSentences(prompt);
          expect(sentences).toBeLessThanOrEqual(MAX_PROMPT_SENTENCES);
        }
      },
    );

    it.each(allPhases)(
      'ensures situational recommendations have scenario and recommendation fields for %s phase',
      (phase) => {
        const support = service.generateDecisionSupport(phase);

        for (const rec of support.situationalRecommendations) {
          expect(rec.scenario).toBeDefined();
          expect(rec.scenario.length).toBeGreaterThan(0);
          expect(rec.recommendation).toBeDefined();
          expect(rec.recommendation.length).toBeGreaterThan(0);
        }
      },
    );

    it.each(allPhases)(
      'uses probabilistic/suggestion-oriented language in prompts for %s phase',
      (phase) => {
        const support = service.generateDecisionSupport(phase);
        const suggestionPatterns = [
          /consider/i,
          /might/i,
          /may/i,
          /could/i,
          /try/i,
        ];

        for (const prompt of support.behavioralPrompts) {
          const hasSuggestionLanguage = suggestionPatterns.some((pattern) => pattern.test(prompt));
          expect(hasSuggestionLanguage).toBe(true);
        }
      },
    );

    it('returns the correct phase in the result', () => {
      const support = service.generateDecisionSupport(CyclePhase.OVULATION);
      expect(support.phase).toBe(CyclePhase.OVULATION);
    });
  });

  describe('generateAllDecisionSupport', () => {
    it('generates decision support for all 5 phases', () => {
      const allSupport = service.generateAllDecisionSupport();

      expect(allSupport).toHaveLength(5);
      const phases = allSupport.map((s) => s.phase);
      expect(phases).toContain(CyclePhase.MENSTRUAL);
      expect(phases).toContain(CyclePhase.FOLLICULAR);
      expect(phases).toContain(CyclePhase.OVULATION);
      expect(phases).toContain(CyclePhase.EARLY_LUTEAL);
      expect(phases).toContain(CyclePhase.LATE_LUTEAL);
    });

    it('all generated content passes validation', () => {
      const allSupport = service.generateAllDecisionSupport();

      for (const support of allSupport) {
        expect(service.validateDecisionSupport(support)).toBe(true);
      }
    });
  });

  describe('validateBehavioralPrompt', () => {
    it('accepts a valid prompt within bounds', () => {
      const prompt = 'Consider offering a warm drink. Small gestures can mean a lot.';
      expect(service.validateBehavioralPrompt(prompt)).toBe(true);
    });

    it('rejects a prompt exceeding 280 characters', () => {
      const longPrompt = 'A'.repeat(281);
      expect(service.validateBehavioralPrompt(longPrompt)).toBe(false);
    });

    it('rejects a prompt with more than 2 sentences', () => {
      const threeSentences = 'First sentence. Second sentence. Third sentence.';
      expect(service.validateBehavioralPrompt(threeSentences)).toBe(false);
    });

    it('accepts a prompt with exactly 280 characters and 1 sentence', () => {
      const exactPrompt = 'A'.repeat(279) + '.';
      expect(exactPrompt.length).toBe(280);
      expect(service.validateBehavioralPrompt(exactPrompt)).toBe(true);
    });

    it('accepts a prompt with exactly 2 sentences', () => {
      const twoSentences = 'First sentence here. Second sentence here.';
      expect(service.validateBehavioralPrompt(twoSentences)).toBe(true);
    });
  });

  describe('validateDecisionSupport', () => {
    it('rejects support with fewer than 3 behavioral prompts', () => {
      const support = {
        phase: CyclePhase.MENSTRUAL,
        behavioralPrompts: ['Prompt one.', 'Prompt two.'],
        situationalRecommendations: [
          { scenario: 'Test', recommendation: 'Test rec.' },
          { scenario: 'Test 2', recommendation: 'Test rec 2.' },
        ],
      };
      expect(service.validateDecisionSupport(support)).toBe(false);
    });

    it('rejects support with more than 5 behavioral prompts', () => {
      const support = {
        phase: CyclePhase.MENSTRUAL,
        behavioralPrompts: [
          'Prompt one.',
          'Prompt two.',
          'Prompt three.',
          'Prompt four.',
          'Prompt five.',
          'Prompt six.',
        ],
        situationalRecommendations: [
          { scenario: 'Test', recommendation: 'Test rec.' },
          { scenario: 'Test 2', recommendation: 'Test rec 2.' },
        ],
      };
      expect(service.validateDecisionSupport(support)).toBe(false);
    });

    it('rejects support with fewer than 2 situational recommendations', () => {
      const support = {
        phase: CyclePhase.MENSTRUAL,
        behavioralPrompts: ['Prompt one.', 'Prompt two.', 'Prompt three.'],
        situationalRecommendations: [{ scenario: 'Test', recommendation: 'Test rec.' }],
      };
      expect(service.validateDecisionSupport(support)).toBe(false);
    });

    it('rejects support with more than 4 situational recommendations', () => {
      const support = {
        phase: CyclePhase.MENSTRUAL,
        behavioralPrompts: ['Prompt one.', 'Prompt two.', 'Prompt three.'],
        situationalRecommendations: [
          { scenario: 'Test 1', recommendation: 'Rec 1.' },
          { scenario: 'Test 2', recommendation: 'Rec 2.' },
          { scenario: 'Test 3', recommendation: 'Rec 3.' },
          { scenario: 'Test 4', recommendation: 'Rec 4.' },
          { scenario: 'Test 5', recommendation: 'Rec 5.' },
        ],
      };
      expect(service.validateDecisionSupport(support)).toBe(false);
    });

    it('rejects support with an invalid prompt (too long)', () => {
      const support = {
        phase: CyclePhase.MENSTRUAL,
        behavioralPrompts: ['Valid prompt.', 'Also valid.', 'A'.repeat(281)],
        situationalRecommendations: [
          { scenario: 'Test', recommendation: 'Test rec.' },
          { scenario: 'Test 2', recommendation: 'Test rec 2.' },
        ],
      };
      expect(service.validateDecisionSupport(support)).toBe(false);
    });
  });

  // ─── Daily Summary Generation ───────────────────────────────────────────

  describe('generateDailySummary', () => {
    const allPhases = [
      CyclePhase.MENSTRUAL,
      CyclePhase.FOLLICULAR,
      CyclePhase.OVULATION,
      CyclePhase.EARLY_LUTEAL,
      CyclePhase.LATE_LUTEAL,
    ];

    it.each(allPhases)('generates todaysState containing the phase name for %s', (phase) => {
      const summary = service.generateDailySummary(phase);
      // Phase name should appear in the todaysState
      expect(summary.todaysState.toLowerCase()).toContain(phase.replace('_', ' '));
    });

    it.each(allPhases)(
      'generates todaysState with no more than 3 sentences for %s',
      (phase) => {
        const summary = service.generateDailySummary(phase);
        const sentenceCount = countSentences(summary.todaysState);
        expect(sentenceCount).toBeLessThanOrEqual(3);
        expect(sentenceCount).toBeGreaterThanOrEqual(1);
      },
    );

    it.each(allPhases)('generates bestApproach with 1-3 items for %s', (phase) => {
      const summary = service.generateDailySummary(phase);
      expect(summary.bestApproach.length).toBeGreaterThanOrEqual(1);
      expect(summary.bestApproach.length).toBeLessThanOrEqual(3);
    });

    it.each(allPhases)('generates avoidThis with 1-3 items for %s', (phase) => {
      const summary = service.generateDailySummary(phase);
      expect(summary.avoidThis.length).toBeGreaterThanOrEqual(1);
      expect(summary.avoidThis.length).toBeLessThanOrEqual(3);
    });

    it.each(allPhases)('returns the correct phase in the result for %s', (phase) => {
      const summary = service.generateDailySummary(phase);
      expect(summary.phase).toBe(phase);
    });

    it('uses probabilistic language in todaysState', () => {
      const summary = service.generateDailySummary(CyclePhase.MENSTRUAL);
      expect(summary.todaysState).toMatch(/may|might|tend|can|likely/i);
    });

    it('uses suggestion-oriented language in bestApproach', () => {
      const summary = service.generateDailySummary(CyclePhase.MENSTRUAL);
      const hasCollaborativeFraming = summary.bestApproach.some((item) =>
        /consider|you might|can/i.test(item),
      );
      expect(hasCollaborativeFraming).toBe(true);
    });

    it('uses suggestion-oriented language in avoidThis', () => {
      const summary = service.generateDailySummary(CyclePhase.MENSTRUAL);
      const hasSuggestionFraming = summary.avoidThis.some((item) =>
        /try to avoid|it may be best|consider avoiding/i.test(item),
      );
      expect(hasSuggestionFraming).toBe(true);
    });
  });

  // ─── Calibrated Daily Summary ───────────────────────────────────────────

  describe('generateCalibratedDailySummary', () => {
    it('returns base summary when survey responses are incomplete', () => {
      const incompleteResponses: SurveyResponse[] = [
        {
          id: 'r1',
          primary_user_id: 'user-1',
          question_number: 1,
          selected_options: ['Somewhat predictable'],
          free_text: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      const summary = service.generateCalibratedDailySummary(
        CyclePhase.MENSTRUAL,
        incompleteResponses,
      );
      const baseSummary = service.generateDailySummary(CyclePhase.MENSTRUAL);

      expect(summary.todaysState).toBe(baseSummary.todaysState);
      expect(summary.bestApproach).toEqual(baseSummary.bestApproach);
      expect(summary.avoidThis).toEqual(baseSummary.avoidThis);
    });

    it('applies Q4 avoidance trigger calibration for sensitive phases', () => {
      const responses = createSurveyResponses({
        4: { selected_options: ['Stress / workload / fatigue'], free_text: null },
      });

      const summary = service.generateCalibratedDailySummary(CyclePhase.LATE_LUTEAL, responses);

      const hasStressTrigger = summary.avoidThis.some(
        (item) =>
          item.toLowerCase().includes('workload') || item.toLowerCase().includes('stress'),
      );
      expect(hasStressTrigger).toBe(true);
    });

    it('applies Q5 support style calibration for low-energy phases', () => {
      const responses = createSurveyResponses({
        5: { selected_options: ['Space and minimal interaction'], free_text: null },
      });

      const summary = service.generateCalibratedDailySummary(CyclePhase.MENSTRUAL, responses);

      const hasSpaceApproach = summary.bestApproach.some((item) =>
        item.toLowerCase().includes('space'),
      );
      expect(hasSpaceApproach).toBe(true);
    });

    it('does not apply Q4 calibration for non-sensitive phases', () => {
      const responses = createSurveyResponses({
        4: { selected_options: ['Stress / workload / fatigue'], free_text: null },
      });

      const calibrated = service.generateCalibratedDailySummary(
        CyclePhase.FOLLICULAR,
        responses,
      );
      const base = service.generateDailySummary(CyclePhase.FOLLICULAR);

      expect(calibrated.avoidThis).toEqual(base.avoidThis);
    });

    it('does not apply Q5 calibration for high-energy phases', () => {
      const responses = createSurveyResponses({
        5: { selected_options: ['Space and minimal interaction'], free_text: null },
      });

      const calibrated = service.generateCalibratedDailySummary(CyclePhase.OVULATION, responses);
      const base = service.generateDailySummary(CyclePhase.OVULATION);

      expect(calibrated.bestApproach).toEqual(base.bestApproach);
    });

    it('maintains 1-3 items in bestApproach after calibration', () => {
      const responses = createSurveyResponses({
        5: { selected_options: ['Practical help (tasks, comfort, routines)'], free_text: null },
      });

      const summary = service.generateCalibratedDailySummary(CyclePhase.MENSTRUAL, responses);
      expect(summary.bestApproach.length).toBeGreaterThanOrEqual(1);
      expect(summary.bestApproach.length).toBeLessThanOrEqual(3);
    });

    it('maintains 1-3 items in avoidThis after calibration', () => {
      const responses = createSurveyResponses({
        4: {
          selected_options: ['Social situations or overstimulation'],
          free_text: null,
        },
      });

      const summary = service.generateCalibratedDailySummary(CyclePhase.LATE_LUTEAL, responses);
      expect(summary.avoidThis.length).toBeGreaterThanOrEqual(1);
      expect(summary.avoidThis.length).toBeLessThanOrEqual(3);
    });

    it('preserves todaysState unchanged after calibration', () => {
      const responses = createSurveyResponses();
      const calibrated = service.generateCalibratedDailySummary(CyclePhase.MENSTRUAL, responses);
      const base = service.generateDailySummary(CyclePhase.MENSTRUAL);

      expect(calibrated.todaysState).toBe(base.todaysState);
    });

    it('handles Q4 "no clear triggers" without modification', () => {
      const responses = createSurveyResponses({
        4: { selected_options: ["I don't notice clear triggers"], free_text: null },
      });

      const calibrated = service.generateCalibratedDailySummary(
        CyclePhase.LATE_LUTEAL,
        responses,
      );
      const base = service.generateDailySummary(CyclePhase.LATE_LUTEAL);

      expect(calibrated.avoidThis).toEqual(base.avoidThis);
    });

    it('handles Q4 "Other" with custom text', () => {
      const responses = createSurveyResponses({
        4: { selected_options: ['Other'], free_text: 'Loud noises' },
      });

      const summary = service.generateCalibratedDailySummary(CyclePhase.MENSTRUAL, responses);

      const hasPersonalTrigger = summary.avoidThis.some((item) =>
        item.toLowerCase().includes('personal triggers'),
      );
      expect(hasPersonalTrigger).toBe(true);
    });
  });
});

describe('countSentences', () => {
  it('returns 0 for empty string', () => {
    expect(countSentences('')).toBe(0);
  });

  it('returns 0 for whitespace-only string', () => {
    expect(countSentences('   ')).toBe(0);
  });

  it('returns 1 for a single sentence', () => {
    expect(countSentences('This is one sentence.')).toBe(1);
  });

  it('returns 2 for two sentences', () => {
    expect(countSentences('First sentence. Second sentence.')).toBe(2);
  });

  it('returns 3 for three sentences', () => {
    expect(countSentences('One. Two. Three.')).toBe(3);
  });

  it('handles question marks as sentence endings', () => {
    expect(countSentences('Is this a question? Yes it is.')).toBe(2);
  });

  it('handles exclamation marks as sentence endings', () => {
    expect(countSentences('Wow! That is great.')).toBe(2);
  });
});
