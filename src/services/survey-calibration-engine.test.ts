import { describe, it, expect } from 'vitest';

import { SurveyResponse } from '@/lib/types';

import {
  AvoidanceTrigger,
  calibrateAvoidanceTriggers,
  calibrateCommunicationApproach,
  calibrateConfidenceLevel,
  calibrateEmotionalEmphasis,
  calibrateSocialEnergy,
  calibrateSupportStyle,
  CommunicationApproach,
  ConfidenceLevel,
  EmotionalEmphasis,
  generateCalibrationProfile,
  SocialEnergyRecommendation,
  SupportStyle,
} from './survey-calibration-engine';

/**
 * Helper to create a mock SurveyResponse.
 */
function createMockResponse(
  questionNumber: number,
  selectedOptions: string[],
  freeText: string | null = null,
): SurveyResponse {
  return {
    id: `response-${questionNumber}`,
    primary_user_id: 'user-1',
    question_number: questionNumber,
    selected_options: selectedOptions,
    free_text: freeText,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Helper to create a complete set of 6 survey responses.
 */
function createCompleteResponses(
  overrides?: Partial<Record<number, { options: string[]; freeText?: string | null }>>,
): SurveyResponse[] {
  const defaults: Record<number, { options: string[]; freeText: string | null }> = {
    1: {
      options: ['Very predictable (I usually notice clear patterns each month)'],
      freeText: null,
    },
    2: { options: ['Moderately (noticeable mood changes)'], freeText: null },
    3: { options: ['Mostly consistent across all phases'], freeText: null },
    4: { options: ['Stress / workload / fatigue'], freeText: null },
    5: { options: ['Emotional reassurance and empathy'], freeText: null },
    6: { options: ["Check in gently, but don't push for deep conversation"], freeText: null },
  };

  const merged = { ...defaults, ...overrides };

  return Object.entries(merged).map(([qNum, data]) =>
    createMockResponse(Number(qNum), data.options, data.freeText ?? null),
  );
}

describe('Survey Calibration Engine', () => {
  describe('calibrateConfidenceLevel (Q1)', () => {
    it('should map "Very predictable" to HIGH confidence', () => {
      expect(
        calibrateConfidenceLevel('Very predictable (I usually notice clear patterns each month)'),
      ).toBe(ConfidenceLevel.HIGH);
    });

    it('should map short form "Very predictable" to HIGH confidence', () => {
      expect(calibrateConfidenceLevel('Very predictable')).toBe(ConfidenceLevel.HIGH);
    });

    it('should map "Somewhat predictable" to MODERATE confidence', () => {
      expect(
        calibrateConfidenceLevel('Somewhat predictable (I notice patterns, but they vary)'),
      ).toBe(ConfidenceLevel.MODERATE);
    });

    it('should map "Unpredictable" to LOW confidence', () => {
      expect(calibrateConfidenceLevel('Unpredictable (each cycle feels different)')).toBe(
        ConfidenceLevel.LOW,
      );
    });

    it('should map "Not sure yet" to LOW confidence', () => {
      expect(calibrateConfidenceLevel('Not sure yet')).toBe(ConfidenceLevel.LOW);
    });

    it('should default to MODERATE for unrecognized options', () => {
      expect(calibrateConfidenceLevel('Unknown option')).toBe(ConfidenceLevel.MODERATE);
    });
  });

  describe('calibrateEmotionalEmphasis (Q2)', () => {
    it('should map "Slightly" to REDUCED emphasis', () => {
      expect(calibrateEmotionalEmphasis('Slightly (subtle shifts, still stable overall)')).toBe(
        EmotionalEmphasis.REDUCED,
      );
    });

    it('should map "Moderately" to MODERATE emphasis', () => {
      expect(calibrateEmotionalEmphasis('Moderately (noticeable mood changes)')).toBe(
        EmotionalEmphasis.MODERATE,
      );
    });

    it('should map "Strongly" to HEIGHTENED emphasis', () => {
      expect(calibrateEmotionalEmphasis('Strongly (clear emotional shifts across phases)')).toBe(
        EmotionalEmphasis.HEIGHTENED,
      );
    });

    it('should map "Very strongly" to VERY_HEIGHTENED emphasis', () => {
      expect(
        calibrateEmotionalEmphasis(
          'Very strongly (emotions feel significantly different day to day)',
        ),
      ).toBe(EmotionalEmphasis.VERY_HEIGHTENED);
    });

    it('should default to MODERATE for unrecognized options', () => {
      expect(calibrateEmotionalEmphasis('Unknown')).toBe(EmotionalEmphasis.MODERATE);
    });
  });

  describe('calibrateSocialEnergy (Q3)', () => {
    it('should map "Mostly consistent" to CONSISTENT', () => {
      expect(calibrateSocialEnergy('Mostly consistent across all phases')).toBe(
        SocialEnergyRecommendation.CONSISTENT,
      );
    });

    it('should map "I need more alone time" to GIVE_SPACE', () => {
      expect(calibrateSocialEnergy('I need more alone time in certain phases')).toBe(
        SocialEnergyRecommendation.GIVE_SPACE,
      );
    });

    it('should map "I become significantly more social" to ENGAGE_MORE', () => {
      expect(calibrateSocialEnergy('I become significantly more social in some phases')).toBe(
        SocialEnergyRecommendation.ENGAGE_MORE,
      );
    });

    it('should map "It varies a lot" to VARIABLE', () => {
      expect(calibrateSocialEnergy('It varies a lot and is hard to predict')).toBe(
        SocialEnergyRecommendation.VARIABLE,
      );
    });

    it('should default to CONSISTENT for unrecognized options', () => {
      expect(calibrateSocialEnergy('Unknown')).toBe(SocialEnergyRecommendation.CONSISTENT);
    });
  });

  describe('calibrateAvoidanceTriggers (Q4)', () => {
    it('should map single trigger correctly', () => {
      const result = calibrateAvoidanceTriggers(['Feeling unheard or not understood'], null);
      expect(result.triggers).toEqual([AvoidanceTrigger.FEELING_UNHEARD]);
      expect(result.customText).toBeNull();
    });

    it('should map multiple triggers correctly', () => {
      const result = calibrateAvoidanceTriggers(
        ['Stress / workload / fatigue', 'Social situations or overstimulation'],
        null,
      );
      expect(result.triggers).toEqual([
        AvoidanceTrigger.STRESS_WORKLOAD,
        AvoidanceTrigger.SOCIAL_OVERSTIMULATION,
      ]);
    });

    it('should include custom text when "Other" is selected', () => {
      const result = calibrateAvoidanceTriggers(['Other'], 'Loud noises and sudden changes');
      expect(result.triggers).toEqual([AvoidanceTrigger.OTHER]);
      expect(result.customText).toBe('Loud noises and sudden changes');
    });

    it('should not include custom text when "Other" is not selected', () => {
      const result = calibrateAvoidanceTriggers(
        ['Stress / workload / fatigue'],
        'Some text that should be ignored',
      );
      expect(result.triggers).toEqual([AvoidanceTrigger.STRESS_WORKLOAD]);
      expect(result.customText).toBeNull();
    });

    it('should map "I don\'t notice clear triggers" correctly', () => {
      const result = calibrateAvoidanceTriggers(["I don't notice clear triggers"], null);
      expect(result.triggers).toEqual([AvoidanceTrigger.NO_CLEAR_TRIGGERS]);
    });

    it('should default to NO_CLEAR_TRIGGERS for unrecognized options', () => {
      const result = calibrateAvoidanceTriggers(['Unknown option'], null);
      expect(result.triggers).toEqual([AvoidanceTrigger.NO_CLEAR_TRIGGERS]);
    });

    it('should handle mix of recognized and unrecognized options', () => {
      const result = calibrateAvoidanceTriggers(
        ['Stress / workload / fatigue', 'Unknown option'],
        null,
      );
      expect(result.triggers).toEqual([AvoidanceTrigger.STRESS_WORKLOAD]);
    });

    it('should map "Relationship dynamics or communication tone" correctly', () => {
      const result = calibrateAvoidanceTriggers(
        ['Relationship dynamics or communication tone'],
        null,
      );
      expect(result.triggers).toEqual([AvoidanceTrigger.RELATIONSHIP_DYNAMICS]);
    });
  });

  describe('calibrateSupportStyle (Q5)', () => {
    it('should map "Space and minimal interaction" to SPACE', () => {
      expect(calibrateSupportStyle('Space and minimal interaction')).toBe(SupportStyle.SPACE);
    });

    it('should map "Emotional reassurance and empathy" to EMOTIONAL_REASSURANCE', () => {
      expect(calibrateSupportStyle('Emotional reassurance and empathy')).toBe(
        SupportStyle.EMOTIONAL_REASSURANCE,
      );
    });

    it('should map "Practical help" to PRACTICAL_HELP', () => {
      expect(calibrateSupportStyle('Practical help (tasks, comfort, routines)')).toBe(
        SupportStyle.PRACTICAL_HELP,
      );
    });

    it('should map "Distraction / fun activities" to DISTRACTION', () => {
      expect(calibrateSupportStyle('Distraction / fun activities')).toBe(SupportStyle.DISTRACTION);
    });

    it('should map "I prefer different things" to VARIABLE', () => {
      expect(calibrateSupportStyle('I prefer different things depending on the day')).toBe(
        SupportStyle.VARIABLE,
      );
    });

    it('should default to VARIABLE for unrecognized options', () => {
      expect(calibrateSupportStyle('Unknown')).toBe(SupportStyle.VARIABLE);
    });
  });

  describe('calibrateCommunicationApproach (Q6)', () => {
    it('should map "Check in gently" to GENTLE_CHECKIN', () => {
      expect(
        calibrateCommunicationApproach("Check in gently, but don't push for deep conversation"),
      ).toBe(CommunicationApproach.GENTLE_CHECKIN);
    });

    it('should map "Be direct and ask" to DIRECT_ASK', () => {
      expect(calibrateCommunicationApproach('Be direct and ask what I need')).toBe(
        CommunicationApproach.DIRECT_ASK,
      );
    });

    it('should map "Give me space" to GIVE_SPACE', () => {
      expect(calibrateCommunicationApproach('Give me space unless I initiate contact')).toBe(
        CommunicationApproach.GIVE_SPACE,
      );
    });

    it('should map "Stay emotionally present" to PRESENT_LOW_PRESSURE', () => {
      expect(calibrateCommunicationApproach('Stay emotionally present but low-pressure')).toBe(
        CommunicationApproach.PRESENT_LOW_PRESSURE,
      );
    });

    it('should map "It depends" to SITUATIONAL', () => {
      expect(calibrateCommunicationApproach('It depends on the situation')).toBe(
        CommunicationApproach.SITUATIONAL,
      );
    });

    it('should default to SITUATIONAL for unrecognized options', () => {
      expect(calibrateCommunicationApproach('Unknown')).toBe(CommunicationApproach.SITUATIONAL);
    });
  });

  describe('generateCalibrationProfile', () => {
    it('should generate a complete profile from valid responses', () => {
      const responses = createCompleteResponses();
      const profile = generateCalibrationProfile(responses);

      expect(profile).not.toBeNull();
      expect(profile.confidenceLevel).toBe(ConfidenceLevel.HIGH);
      expect(profile.emotionalEmphasis).toBe(EmotionalEmphasis.MODERATE);
      expect(profile.socialEnergyRecommendation).toBe(SocialEnergyRecommendation.CONSISTENT);
      expect(profile.avoidanceTriggers).toEqual([AvoidanceTrigger.STRESS_WORKLOAD]);
      expect(profile.customTriggerText).toBeNull();
      expect(profile.supportStyle).toBe(SupportStyle.EMOTIONAL_REASSURANCE);
      expect(profile.communicationApproach).toBe(CommunicationApproach.GENTLE_CHECKIN);
    });

    it('should return null when fewer than 6 responses are provided', () => {
      const responses = createCompleteResponses().slice(0, 5);
      const profile = generateCalibrationProfile(responses);
      expect(profile).toBeNull();
    });

    it('should return null when a question number is missing', () => {
      const responses = createCompleteResponses();
      // Replace Q6 with a duplicate Q1
      responses[5] = createMockResponse(1, ['Very predictable']);
      const profile = generateCalibrationProfile(responses);
      expect(profile).toBeNull();
    });

    it('should handle "Unpredictable" Q1 with low confidence framing', () => {
      const responses = createCompleteResponses({
        1: { options: ['Unpredictable (each cycle feels different)'] },
      });
      const profile = generateCalibrationProfile(responses);

      expect(profile).not.toBeNull();
      expect(profile.confidenceLevel).toBe(ConfidenceLevel.LOW);
    });

    it('should handle "Very strongly" Q2 with very heightened emphasis', () => {
      const responses = createCompleteResponses({
        2: { options: ['Very strongly (emotions feel significantly different day to day)'] },
      });
      const profile = generateCalibrationProfile(responses);

      expect(profile).not.toBeNull();
      expect(profile.emotionalEmphasis).toBe(EmotionalEmphasis.VERY_HEIGHTENED);
    });

    it('should handle "give space" social energy from Q3', () => {
      const responses = createCompleteResponses({
        3: { options: ['I need more alone time in certain phases'] },
      });
      const profile = generateCalibrationProfile(responses);

      expect(profile).not.toBeNull();
      expect(profile.socialEnergyRecommendation).toBe(SocialEnergyRecommendation.GIVE_SPACE);
    });

    it('should handle multiple avoidance triggers from Q4', () => {
      const responses = createCompleteResponses({
        4: {
          options: [
            'Feeling unheard or not understood',
            'Relationship dynamics or communication tone',
            'Other',
          ],
          freeText: 'Sudden plan changes',
        },
      });
      const profile = generateCalibrationProfile(responses);

      expect(profile).not.toBeNull();
      expect(profile.avoidanceTriggers).toEqual([
        AvoidanceTrigger.FEELING_UNHEARD,
        AvoidanceTrigger.RELATIONSHIP_DYNAMICS,
        AvoidanceTrigger.OTHER,
      ]);
      expect(profile.customTriggerText).toBe('Sudden plan changes');
    });

    it('should handle "Space" support style from Q5', () => {
      const responses = createCompleteResponses({
        5: { options: ['Space and minimal interaction'] },
      });
      const profile = generateCalibrationProfile(responses);

      expect(profile).not.toBeNull();
      expect(profile.supportStyle).toBe(SupportStyle.SPACE);
    });

    it('should handle "Give me space" communication from Q6', () => {
      const responses = createCompleteResponses({
        6: { options: ['Give me space unless I initiate contact'] },
      });
      const profile = generateCalibrationProfile(responses);

      expect(profile).not.toBeNull();
      expect(profile.communicationApproach).toBe(CommunicationApproach.GIVE_SPACE);
    });

    it('should return null for empty responses array', () => {
      const profile = generateCalibrationProfile([]);
      expect(profile).toBeNull();
    });
  });
});
