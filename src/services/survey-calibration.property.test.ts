import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { SurveyResponse } from '@/lib/types';

import {
  generateCalibrationProfile,
  calibrateConfidenceLevel,
  calibrateEmotionalEmphasis,
  calibrateSocialEnergy,
  calibrateAvoidanceTriggers,
  calibrateSupportStyle,
  calibrateCommunicationApproach,
  Q1_OPTIONS,
  Q2_OPTIONS,
  Q3_OPTIONS,
  Q4_OPTIONS,
  Q5_OPTIONS,
  Q6_OPTIONS,
  ConfidenceLevel,
  EmotionalEmphasis,
  SocialEnergyRecommendation,
  SupportStyle,
} from './survey-calibration';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function assertDefined<T>(value: T | null | undefined): asserts value is T {
  expect(value).toBeDefined();
  expect(value).not.toBeNull();
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

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
        id: crypto.randomUUID(),
        primary_user_id: userId,
        question_number: 1,
        selected_options: [q1],
        free_text: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: crypto.randomUUID(),
        primary_user_id: userId,
        question_number: 2,
        selected_options: [q2],
        free_text: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: crypto.randomUUID(),
        primary_user_id: userId,
        question_number: 3,
        selected_options: [q3],
        free_text: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: crypto.randomUUID(),
        primary_user_id: userId,
        question_number: 4,
        selected_options: [...q4],
        free_text: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: crypto.randomUUID(),
        primary_user_id: userId,
        question_number: 5,
        selected_options: [q5],
        free_text: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: crypto.randomUUID(),
        primary_user_id: userId,
        question_number: 6,
        selected_options: [q6],
        free_text: null,
        created_at: now,
        updated_at: now,
      },
    ];
  });

// ─── Expected Mapping Tables ─────────────────────────────────────────────────

const Q1_TO_CONFIDENCE: Record<string, ConfidenceLevel> = {
  'Very predictable': 'high',
  'Somewhat predictable': 'moderate',
  Unpredictable: 'low',
  'Not sure yet': 'low',
};

const Q2_TO_EMPHASIS: Record<string, EmotionalEmphasis> = {
  Slightly: 'reduced',
  Moderately: 'standard',
  Strongly: 'heightened',
  'Very strongly': 'intensive',
};

const Q3_TO_SOCIAL_ENERGY: Record<string, SocialEnergyRecommendation> = {
  'Mostly consistent across all phases': 'maintain_engagement',
  'I need more alone time in certain phases': 'give_space',
  'I become significantly more social in some phases': 'engage_more',
  'It varies a lot and is hard to predict': 'vary_approach',
};

const Q5_TO_SUPPORT_STYLE: Record<string, SupportStyle> = {
  'Space and minimal interaction': 'space',
  'Emotional reassurance and empathy': 'emotional_reassurance',
  'Practical help (tasks, comfort, routines)': 'practical_help',
  'Distraction / fun activities': 'distraction',
  'I prefer different things depending on the day': 'adaptive',
};

// ─── Property 33: Survey Calibration Correctness ─────────────────────────────

/**
 * **Validates: Requirements 20.10, 20.11, 20.12, 20.13, 20.14, 20.15, 20.16**
 *
 * Property 33: Survey Calibration Correctness
 *
 * For any combination of Survey_Responses, the generated Partner_User guidance
 * SHALL reflect the calibration rules: Q1 maps to confidence level, Q2 maps to
 * emotional emphasis, Q3 maps to social energy recommendations, Q4 maps to
 * avoidance triggers, Q5 maps to support style, and Q6 maps to communication approach.
 */
describe('Property 33: Survey Calibration Correctness', () => {
  it('Q1 correctly maps to confidence level for all valid options', () => {
    fc.assert(
      fc.property(q1OptionArb, (q1Option) => {
        const result = calibrateConfidenceLevel(q1Option);
        const expected = Q1_TO_CONFIDENCE[q1Option];

        expect(result).toBe(expected);

        // Verify the result is a valid ConfidenceLevel
        expect(['high', 'moderate', 'low']).toContain(result);
      }),
      { numRuns: 100 },
    );
  });

  it('Q2 correctly maps to emotional emphasis for all valid options', () => {
    fc.assert(
      fc.property(q2OptionArb, (q2Option) => {
        const result = calibrateEmotionalEmphasis(q2Option);
        const expected = Q2_TO_EMPHASIS[q2Option];

        expect(result).toBe(expected);

        // Verify the result is a valid EmotionalEmphasis
        expect(['reduced', 'standard', 'heightened', 'intensive']).toContain(result);
      }),
      { numRuns: 100 },
    );
  });

  it('Q3 correctly maps to social energy recommendations for all valid options', () => {
    fc.assert(
      fc.property(q3OptionArb, (q3Option) => {
        const result = calibrateSocialEnergy(q3Option);
        const expected = Q3_TO_SOCIAL_ENERGY[q3Option];

        expect(result).toBe(expected);

        // Verify the result is a valid SocialEnergyRecommendation
        expect(['maintain_engagement', 'give_space', 'engage_more', 'vary_approach']).toContain(
          result,
        );
      }),
      { numRuns: 100 },
    );
  });

  it('Q4 correctly maps to avoidance triggers (selected triggers are prioritized)', () => {
    fc.assert(
      fc.property(q4OptionsArb, (q4Options) => {
        const result = calibrateAvoidanceTriggers(q4Options);

        // All returned triggers should be from the original selection
        for (const trigger of result) {
          expect(q4Options).toContain(trigger);
        }

        // "I don't notice clear triggers" should be filtered out
        expect(result).not.toContain("I don't notice clear triggers");

        // All other selected triggers should be present in the result
        const expectedTriggers = q4Options.filter((t) => t !== "I don't notice clear triggers");
        expect(result).toEqual(expectedTriggers);
      }),
      { numRuns: 200 },
    );
  });

  it('Q5 correctly maps to support style for all valid options', () => {
    fc.assert(
      fc.property(q5OptionArb, (q5Option) => {
        const result = calibrateSupportStyle(q5Option);
        const expected = Q5_TO_SUPPORT_STYLE[q5Option];

        expect(result).toBe(expected);

        // Verify the result is a valid SupportStyle
        expect([
          'space',
          'emotional_reassurance',
          'practical_help',
          'distraction',
          'adaptive',
        ]).toContain(result);
      }),
      { numRuns: 100 },
    );
  });

  it('Q6 correctly maps to communication approach for all valid options', () => {
    fc.assert(
      fc.property(q6OptionArb, (q6Option) => {
        const result = calibrateCommunicationApproach(q6Option);

        // Verify the result has the correct structure
        expect(result).toHaveProperty('checkInFrequency');
        expect(result).toHaveProperty('conversationDepth');
        expect(result).toHaveProperty('initiationBehavior');

        // Verify each field has a valid value
        expect(['low', 'moderate', 'high']).toContain(result.checkInFrequency);
        expect(['shallow', 'moderate', 'deep']).toContain(result.conversationDepth);
        expect(['partner_initiates', 'user_initiates', 'mutual', 'situational']).toContain(
          result.initiationBehavior,
        );

        // Verify specific mappings per Q6 option
        switch (q6Option) {
          case "Check in gently, but don't push for deep conversation":
            expect(result.checkInFrequency).toBe('moderate');
            expect(result.conversationDepth).toBe('shallow');
            expect(result.initiationBehavior).toBe('partner_initiates');
            break;
          case 'Be direct and ask what I need':
            expect(result.checkInFrequency).toBe('high');
            expect(result.conversationDepth).toBe('deep');
            expect(result.initiationBehavior).toBe('partner_initiates');
            break;
          case 'Give me space unless I initiate contact':
            expect(result.checkInFrequency).toBe('low');
            expect(result.conversationDepth).toBe('shallow');
            expect(result.initiationBehavior).toBe('user_initiates');
            break;
          case 'Stay emotionally present but low-pressure':
            expect(result.checkInFrequency).toBe('moderate');
            expect(result.conversationDepth).toBe('moderate');
            expect(result.initiationBehavior).toBe('mutual');
            break;
          case 'It depends on the situation':
            expect(result.checkInFrequency).toBe('moderate');
            expect(result.conversationDepth).toBe('moderate');
            expect(result.initiationBehavior).toBe('situational');
            break;
        }
      }),
      { numRuns: 100 },
    );
  });

  it('generateCalibrationProfile correctly maps all 6 questions simultaneously for any valid combination', () => {
    fc.assert(
      fc.property(surveyResponsesArb, (responses) => {
        const profile = generateCalibrationProfile(responses);

        // Profile should always be generated for complete responses
        expect(profile).not.toBeNull();
        assertDefined(profile);

        const q1 = responses.find((r) => r.question_number === 1) as SurveyResponse;
        const q2 = responses.find((r) => r.question_number === 2) as SurveyResponse;
        const q3 = responses.find((r) => r.question_number === 3) as SurveyResponse;
        const q4 = responses.find((r) => r.question_number === 4) as SurveyResponse;
        const q5 = responses.find((r) => r.question_number === 5) as SurveyResponse;
        const q6 = responses.find((r) => r.question_number === 6) as SurveyResponse;

        // Q1 → confidence level (Req 20.11)
        expect(profile.confidenceLevel).toBe(Q1_TO_CONFIDENCE[q1.selected_options[0]]);

        // Q2 → emotional emphasis (Req 20.12)
        expect(profile.emotionalEmphasis).toBe(Q2_TO_EMPHASIS[q2.selected_options[0]]);

        // Q3 → social energy recommendations (Req 20.13)
        expect(profile.socialEnergyRecommendation).toBe(
          Q3_TO_SOCIAL_ENERGY[q3.selected_options[0]],
        );

        // Q4 → avoidance triggers (Req 20.14)
        const expectedTriggers = q4.selected_options.filter(
          (t) => t !== "I don't notice clear triggers",
        );
        expect(profile.avoidanceTriggers).toEqual(expectedTriggers);

        // Q5 → support style (Req 20.15)
        expect(profile.supportStyle).toBe(Q5_TO_SUPPORT_STYLE[q5.selected_options[0]]);

        // Q6 → communication approach (Req 20.16)
        const expectedComm = calibrateCommunicationApproach(q6.selected_options[0]);
        expect(profile.communicationApproach).toEqual(expectedComm);
      }),
      { numRuns: 500 },
    );
  });

  it('generateCalibrationProfile returns null when responses are incomplete', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        surveyResponsesArb,
        (removeCount, fullResponses) => {
          // Remove some responses to make it incomplete
          const incomplete = fullResponses.slice(0, 6 - removeCount);

          const profile = generateCalibrationProfile(incomplete);
          expect(profile).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('each question maps independently - changing one question only affects its corresponding output', () => {
    fc.assert(
      fc.property(
        surveyResponsesArb,
        fc.integer({ min: 1, max: 6 }),
        (responses, questionToChange) => {
          // Generate profile from original responses
          const originalProfile = generateCalibrationProfile(responses) as NonNullable<
            ReturnType<typeof generateCalibrationProfile>
          >;

          // Create modified responses with a different option for the target question
          const modifiedResponses = responses.map((r) => {
            if (r.question_number !== questionToChange) return r;

            // Pick a different option for this question
            let newOptions: string[];
            switch (questionToChange) {
              case 1: {
                const otherOptions = Q1_OPTIONS.filter((o) => o !== r.selected_options[0]);
                newOptions = otherOptions.length > 0 ? [otherOptions[0]] : r.selected_options;
                break;
              }
              case 2: {
                const otherOptions = Q2_OPTIONS.filter((o) => o !== r.selected_options[0]);
                newOptions = otherOptions.length > 0 ? [otherOptions[0]] : r.selected_options;
                break;
              }
              case 3: {
                const otherOptions = Q3_OPTIONS.filter((o) => o !== r.selected_options[0]);
                newOptions = otherOptions.length > 0 ? [otherOptions[0]] : r.selected_options;
                break;
              }
              case 4: {
                // For Q4, just use a single different option
                const otherOptions = Q4_OPTIONS.filter((o) => !r.selected_options.includes(o));
                newOptions = otherOptions.length > 0 ? [otherOptions[0]] : r.selected_options;
                break;
              }
              case 5: {
                const otherOptions = Q5_OPTIONS.filter((o) => o !== r.selected_options[0]);
                newOptions = otherOptions.length > 0 ? [otherOptions[0]] : r.selected_options;
                break;
              }
              case 6: {
                const otherOptions = Q6_OPTIONS.filter((o) => o !== r.selected_options[0]);
                newOptions = otherOptions.length > 0 ? [otherOptions[0]] : r.selected_options;
                break;
              }
              default:
                newOptions = r.selected_options;
            }

            return { ...r, selected_options: newOptions };
          });

          const modifiedProfile = generateCalibrationProfile(modifiedResponses) as NonNullable<
            ReturnType<typeof generateCalibrationProfile>
          >;

          // Verify that only the corresponding field changed
          // (or stayed the same if no different option was available)
          switch (questionToChange) {
            case 1:
              // Q2-Q6 outputs should remain unchanged
              expect(modifiedProfile.emotionalEmphasis).toBe(originalProfile.emotionalEmphasis);
              expect(modifiedProfile.socialEnergyRecommendation).toBe(
                originalProfile.socialEnergyRecommendation,
              );
              expect(modifiedProfile.avoidanceTriggers).toEqual(originalProfile.avoidanceTriggers);
              expect(modifiedProfile.supportStyle).toBe(originalProfile.supportStyle);
              expect(modifiedProfile.communicationApproach).toEqual(
                originalProfile.communicationApproach,
              );
              break;
            case 2:
              expect(modifiedProfile.confidenceLevel).toBe(originalProfile.confidenceLevel);
              expect(modifiedProfile.socialEnergyRecommendation).toBe(
                originalProfile.socialEnergyRecommendation,
              );
              expect(modifiedProfile.avoidanceTriggers).toEqual(originalProfile.avoidanceTriggers);
              expect(modifiedProfile.supportStyle).toBe(originalProfile.supportStyle);
              expect(modifiedProfile.communicationApproach).toEqual(
                originalProfile.communicationApproach,
              );
              break;
            case 3:
              expect(modifiedProfile.confidenceLevel).toBe(originalProfile.confidenceLevel);
              expect(modifiedProfile.emotionalEmphasis).toBe(originalProfile.emotionalEmphasis);
              expect(modifiedProfile.avoidanceTriggers).toEqual(originalProfile.avoidanceTriggers);
              expect(modifiedProfile.supportStyle).toBe(originalProfile.supportStyle);
              expect(modifiedProfile.communicationApproach).toEqual(
                originalProfile.communicationApproach,
              );
              break;
            case 4:
              expect(modifiedProfile.confidenceLevel).toBe(originalProfile.confidenceLevel);
              expect(modifiedProfile.emotionalEmphasis).toBe(originalProfile.emotionalEmphasis);
              expect(modifiedProfile.socialEnergyRecommendation).toBe(
                originalProfile.socialEnergyRecommendation,
              );
              expect(modifiedProfile.supportStyle).toBe(originalProfile.supportStyle);
              expect(modifiedProfile.communicationApproach).toEqual(
                originalProfile.communicationApproach,
              );
              break;
            case 5:
              expect(modifiedProfile.confidenceLevel).toBe(originalProfile.confidenceLevel);
              expect(modifiedProfile.emotionalEmphasis).toBe(originalProfile.emotionalEmphasis);
              expect(modifiedProfile.socialEnergyRecommendation).toBe(
                originalProfile.socialEnergyRecommendation,
              );
              expect(modifiedProfile.avoidanceTriggers).toEqual(originalProfile.avoidanceTriggers);
              expect(modifiedProfile.communicationApproach).toEqual(
                originalProfile.communicationApproach,
              );
              break;
            case 6:
              expect(modifiedProfile.confidenceLevel).toBe(originalProfile.confidenceLevel);
              expect(modifiedProfile.emotionalEmphasis).toBe(originalProfile.emotionalEmphasis);
              expect(modifiedProfile.socialEnergyRecommendation).toBe(
                originalProfile.socialEnergyRecommendation,
              );
              expect(modifiedProfile.avoidanceTriggers).toEqual(originalProfile.avoidanceTriggers);
              expect(modifiedProfile.supportStyle).toBe(originalProfile.supportStyle);
              break;
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
