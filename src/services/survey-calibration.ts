import { SurveyResponse } from '@/lib/types';

// ─── Survey Question Options ─────────────────────────────────────────────────

/** Q1: Cycle Experience Baseline options */
export const Q1_OPTIONS = [
  'Very predictable',
  'Somewhat predictable',
  'Unpredictable',
  'Not sure yet',
] as const;

/** Q2: Emotional Sensitivity Pattern options */
export const Q2_OPTIONS = ['Slightly', 'Moderately', 'Strongly', 'Very strongly'] as const;

/** Q3: Social Energy Preference options */
export const Q3_OPTIONS = [
  'Mostly consistent across all phases',
  'I need more alone time in certain phases',
  'I become significantly more social in some phases',
  'It varies a lot and is hard to predict',
] as const;

/** Q4: Conflict and Sensitivity Triggers options */
export const Q4_OPTIONS = [
  'Feeling unheard or not understood',
  'Stress / workload / fatigue',
  'Social situations or overstimulation',
  'Relationship dynamics or communication tone',
  "I don't notice clear triggers",
  'Other',
] as const;

/** Q5: Preferred Support Style options */
export const Q5_OPTIONS = [
  'Space and minimal interaction',
  'Emotional reassurance and empathy',
  'Practical help (tasks, comfort, routines)',
  'Distraction / fun activities',
  'I prefer different things depending on the day',
] as const;

/** Q6: Communication Boundaries and Preferences options */
export const Q6_OPTIONS = [
  "Check in gently, but don't push for deep conversation",
  'Be direct and ask what I need',
  'Give me space unless I initiate contact',
  'Stay emotionally present but low-pressure',
  'It depends on the situation',
] as const;

// ─── Calibration Output Types ────────────────────────────────────────────────

/** Confidence level derived from Q1 */
export type ConfidenceLevel = 'high' | 'moderate' | 'low';

/** Emotional emphasis derived from Q2 */
export type EmotionalEmphasis = 'reduced' | 'standard' | 'heightened' | 'intensive';

/** Social energy recommendation derived from Q3 */
export type SocialEnergyRecommendation =
  | 'maintain_engagement'
  | 'give_space'
  | 'engage_more'
  | 'vary_approach';

/** Support style derived from Q5 */
export type SupportStyle =
  | 'space'
  | 'emotional_reassurance'
  | 'practical_help'
  | 'distraction'
  | 'adaptive';

/** Communication approach derived from Q6 */
export interface CommunicationApproach {
  checkInFrequency: 'low' | 'moderate' | 'high';
  conversationDepth: 'shallow' | 'moderate' | 'deep';
  initiationBehavior: 'partner_initiates' | 'user_initiates' | 'mutual' | 'situational';
}

/**
 * Complete calibration profile generated from all 6 survey responses.
 * Each field maps directly to a specific survey question.
 *
 * Validates: Requirements 20.10, 20.11, 20.12, 20.13, 20.14, 20.15, 20.16
 */
export interface CalibrationProfile {
  /** Q1 → Confidence level for phase-based assumptions (Req 20.11) */
  confidenceLevel: ConfidenceLevel;

  /** Q2 → Emotional emphasis in guidance (Req 20.12) */
  emotionalEmphasis: EmotionalEmphasis;

  /** Q3 → Social energy recommendations (Req 20.13) */
  socialEnergyRecommendation: SocialEnergyRecommendation;

  /** Q4 → Avoidance triggers prioritized in content (Req 20.14) */
  avoidanceTriggers: string[];

  /** Q5 → Support style for "Best Approach" suggestions (Req 20.15) */
  supportStyle: SupportStyle;

  /** Q6 → Communication approach calibration (Req 20.16) */
  communicationApproach: CommunicationApproach;
}

// ─── Calibration Engine ──────────────────────────────────────────────────────

/**
 * Calibrates confidence level from Q1 (Cycle Experience Baseline).
 *
 * - "Very predictable" → high confidence
 * - "Somewhat predictable" → moderate confidence
 * - "Unpredictable" or "Not sure yet" → low confidence
 *
 * Validates: Requirement 20.11
 */
export function calibrateConfidenceLevel(q1Response: string): ConfidenceLevel {
  switch (q1Response) {
    case 'Very predictable':
      return 'high';
    case 'Somewhat predictable':
      return 'moderate';
    case 'Unpredictable':
    case 'Not sure yet':
    default:
      return 'low';
  }
}

/**
 * Calibrates emotional emphasis from Q2 (Emotional Sensitivity Pattern).
 *
 * - "Slightly" → reduced emphasis
 * - "Moderately" → standard emphasis
 * - "Strongly" → heightened emphasis
 * - "Very strongly" → intensive emphasis with additional context
 *
 * Validates: Requirement 20.12
 */
export function calibrateEmotionalEmphasis(q2Response: string): EmotionalEmphasis {
  switch (q2Response) {
    case 'Slightly':
      return 'reduced';
    case 'Moderately':
      return 'standard';
    case 'Strongly':
      return 'heightened';
    case 'Very strongly':
      return 'intensive';
    default:
      return 'standard';
  }
}

/**
 * Calibrates social energy recommendations from Q3 (Social Energy Preference).
 *
 * - "Mostly consistent across all phases" → maintain engagement
 * - "I need more alone time in certain phases" → give space
 * - "I become significantly more social in some phases" → engage more
 * - "It varies a lot and is hard to predict" → vary approach
 *
 * Validates: Requirement 20.13
 */
export function calibrateSocialEnergy(q3Response: string): SocialEnergyRecommendation {
  switch (q3Response) {
    case 'Mostly consistent across all phases':
      return 'maintain_engagement';
    case 'I need more alone time in certain phases':
      return 'give_space';
    case 'I become significantly more social in some phases':
      return 'engage_more';
    case 'It varies a lot and is hard to predict':
      return 'vary_approach';
    default:
      return 'vary_approach';
  }
}

/**
 * Calibrates avoidance triggers from Q4 (Conflict and Sensitivity Triggers).
 * Returns the selected triggers to prioritize in "Avoid This" content.
 * Filters out "I don't notice clear triggers" as it indicates no specific triggers.
 *
 * Validates: Requirement 20.14
 */
export function calibrateAvoidanceTriggers(q4Responses: string[]): string[] {
  return q4Responses.filter((trigger) => trigger !== "I don't notice clear triggers");
}

/**
 * Calibrates support style from Q5 (Preferred Support Style).
 *
 * - "Space and minimal interaction" → space
 * - "Emotional reassurance and empathy" → emotional_reassurance
 * - "Practical help (tasks, comfort, routines)" → practical_help
 * - "Distraction / fun activities" → distraction
 * - "I prefer different things depending on the day" → adaptive
 *
 * Validates: Requirement 20.15
 */
export function calibrateSupportStyle(q5Response: string): SupportStyle {
  switch (q5Response) {
    case 'Space and minimal interaction':
      return 'space';
    case 'Emotional reassurance and empathy':
      return 'emotional_reassurance';
    case 'Practical help (tasks, comfort, routines)':
      return 'practical_help';
    case 'Distraction / fun activities':
      return 'distraction';
    case 'I prefer different things depending on the day':
      return 'adaptive';
    default:
      return 'adaptive';
  }
}

/**
 * Calibrates communication approach from Q6 (Communication Boundaries and Preferences).
 *
 * Maps the selected preference to check-in frequency, conversation depth,
 * and initiation behavior.
 *
 * Validates: Requirement 20.16
 */
export function calibrateCommunicationApproach(q6Response: string): CommunicationApproach {
  switch (q6Response) {
    case "Check in gently, but don't push for deep conversation":
      return {
        checkInFrequency: 'moderate',
        conversationDepth: 'shallow',
        initiationBehavior: 'partner_initiates',
      };
    case 'Be direct and ask what I need':
      return {
        checkInFrequency: 'high',
        conversationDepth: 'deep',
        initiationBehavior: 'partner_initiates',
      };
    case 'Give me space unless I initiate contact':
      return {
        checkInFrequency: 'low',
        conversationDepth: 'shallow',
        initiationBehavior: 'user_initiates',
      };
    case 'Stay emotionally present but low-pressure':
      return {
        checkInFrequency: 'moderate',
        conversationDepth: 'moderate',
        initiationBehavior: 'mutual',
      };
    case 'It depends on the situation':
      return {
        checkInFrequency: 'moderate',
        conversationDepth: 'moderate',
        initiationBehavior: 'situational',
      };
    default:
      return {
        checkInFrequency: 'moderate',
        conversationDepth: 'moderate',
        initiationBehavior: 'situational',
      };
  }
}

/**
 * Generates a complete CalibrationProfile from survey responses.
 *
 * Takes an array of SurveyResponse objects (one per question, questions 1-6)
 * and produces a calibration profile that maps each question to its
 * corresponding guidance modifier.
 *
 * @param responses - Array of survey responses (must contain questions 1-6)
 * @returns CalibrationProfile or null if responses are incomplete
 *
 * Validates: Requirements 20.10, 20.11, 20.12, 20.13, 20.14, 20.15, 20.16
 */
export function generateCalibrationProfile(responses: SurveyResponse[]): CalibrationProfile | null {
  // Find response for each question
  const q1 = responses.find((r) => r.question_number === 1);
  const q2 = responses.find((r) => r.question_number === 2);
  const q3 = responses.find((r) => r.question_number === 3);
  const q4 = responses.find((r) => r.question_number === 4);
  const q5 = responses.find((r) => r.question_number === 5);
  const q6 = responses.find((r) => r.question_number === 6);

  // All 6 questions must be present
  if (!q1 || !q2 || !q3 || !q4 || !q5 || !q6) {
    return null;
  }

  return {
    confidenceLevel: calibrateConfidenceLevel(q1.selected_options[0]),
    emotionalEmphasis: calibrateEmotionalEmphasis(q2.selected_options[0]),
    socialEnergyRecommendation: calibrateSocialEnergy(q3.selected_options[0]),
    avoidanceTriggers: calibrateAvoidanceTriggers(q4.selected_options),
    supportStyle: calibrateSupportStyle(q5.selected_options[0]),
    communicationApproach: calibrateCommunicationApproach(q6.selected_options[0]),
  };
}
