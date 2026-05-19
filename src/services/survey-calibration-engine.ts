import { SurveyResponse } from '@/lib/types';

// ─── Q1: Confidence Level ────────────────────────────────────────────────────

/**
 * Confidence level determines how assertively phase-based guidance is framed.
 * High confidence = direct phase-based assumptions.
 * Low confidence = increased variability qualifiers.
 */
export enum ConfidenceLevel {
  HIGH = 'high',
  MODERATE = 'moderate',
  LOW = 'low',
}

// ─── Q2: Emotional Emphasis ──────────────────────────────────────────────────

/**
 * Emotional emphasis controls how prominently emotional guidance is presented.
 * Reduced = subtle, brief emotional context.
 * Heightened = detailed emotional guidance with additional context.
 */
export enum EmotionalEmphasis {
  REDUCED = 'reduced',
  MODERATE = 'moderate',
  HEIGHTENED = 'heightened',
  VERY_HEIGHTENED = 'very_heightened',
}

// ─── Q3: Social Energy Recommendation ───────────────────────────────────────

/**
 * Social energy recommendation guides partner behavior around social interaction.
 */
export enum SocialEnergyRecommendation {
  CONSISTENT = 'consistent',
  GIVE_SPACE = 'give_space',
  ENGAGE_MORE = 'engage_more',
  VARIABLE = 'variable',
}

// ─── Q4: Avoidance Triggers ─────────────────────────────────────────────────

/**
 * Known avoidance trigger categories that inform "Avoid This" content.
 */
export enum AvoidanceTrigger {
  FEELING_UNHEARD = 'feeling_unheard',
  STRESS_WORKLOAD = 'stress_workload',
  SOCIAL_OVERSTIMULATION = 'social_overstimulation',
  RELATIONSHIP_DYNAMICS = 'relationship_dynamics',
  NO_CLEAR_TRIGGERS = 'no_clear_triggers',
  OTHER = 'other',
}

// ─── Q5: Support Style ──────────────────────────────────────────────────────

/**
 * Support style determines the type of supportive actions recommended.
 */
export enum SupportStyle {
  SPACE = 'space',
  EMOTIONAL_REASSURANCE = 'emotional_reassurance',
  PRACTICAL_HELP = 'practical_help',
  DISTRACTION = 'distraction',
  VARIABLE = 'variable',
}

// ─── Q6: Communication Approach ─────────────────────────────────────────────

/**
 * Communication approach calibrates check-in frequency and conversation depth.
 */
export enum CommunicationApproach {
  GENTLE_CHECKIN = 'gentle_checkin',
  DIRECT_ASK = 'direct_ask',
  GIVE_SPACE = 'give_space',
  PRESENT_LOW_PRESSURE = 'present_low_pressure',
  SITUATIONAL = 'situational',
}

// ─── Calibration Profile ────────────────────────────────────────────────────

/**
 * The complete calibration profile derived from all 6 survey responses.
 * This profile is used by InsightsService, GuidanceService, and NotificationService
 * to personalize partner-facing content.
 *
 * Validates: Requirements 20.10, 20.11, 20.12, 20.13, 20.14, 20.15, 20.16
 */
export interface CalibrationProfile {
  /** Q1: How assertively to frame phase-based guidance */
  confidenceLevel: ConfidenceLevel;
  /** Q2: How prominently to present emotional guidance */
  emotionalEmphasis: EmotionalEmphasis;
  /** Q3: Social energy recommendation direction */
  socialEnergyRecommendation: SocialEnergyRecommendation;
  /** Q4: Prioritized avoidance triggers for "Avoid This" content */
  avoidanceTriggers: AvoidanceTrigger[];
  /** Q4: Custom trigger text if "Other" was selected */
  customTriggerText: string | null;
  /** Q5: Preferred support style for "Best Approach" suggestions */
  supportStyle: SupportStyle;
  /** Q6: Communication approach (check-in frequency, conversation depth) */
  communicationApproach: CommunicationApproach;
}

// ─── Q1 Option Mapping ──────────────────────────────────────────────────────

const Q1_CONFIDENCE_MAP: Record<string, ConfidenceLevel> = {
  'Very predictable (I usually notice clear patterns each month)': ConfidenceLevel.HIGH,
  'Very predictable': ConfidenceLevel.HIGH,
  'Somewhat predictable (I notice patterns, but they vary)': ConfidenceLevel.MODERATE,
  'Somewhat predictable': ConfidenceLevel.MODERATE,
  'Unpredictable (each cycle feels different)': ConfidenceLevel.LOW,
  Unpredictable: ConfidenceLevel.LOW,
  'Not sure yet': ConfidenceLevel.LOW,
};

// ─── Q2 Option Mapping ──────────────────────────────────────────────────────

const Q2_EMOTIONAL_MAP: Record<string, EmotionalEmphasis> = {
  'Slightly (subtle shifts, still stable overall)': EmotionalEmphasis.REDUCED,
  Slightly: EmotionalEmphasis.REDUCED,
  'Moderately (noticeable mood changes)': EmotionalEmphasis.MODERATE,
  Moderately: EmotionalEmphasis.MODERATE,
  'Strongly (clear emotional shifts across phases)': EmotionalEmphasis.HEIGHTENED,
  Strongly: EmotionalEmphasis.HEIGHTENED,
  'Very strongly (emotions feel significantly different day to day)':
    EmotionalEmphasis.VERY_HEIGHTENED,
  'Very strongly': EmotionalEmphasis.VERY_HEIGHTENED,
};

// ─── Q3 Option Mapping ──────────────────────────────────────────────────────

const Q3_SOCIAL_ENERGY_MAP: Record<string, SocialEnergyRecommendation> = {
  'Mostly consistent across all phases': SocialEnergyRecommendation.CONSISTENT,
  'Mostly consistent': SocialEnergyRecommendation.CONSISTENT,
  'I need more alone time in certain phases': SocialEnergyRecommendation.GIVE_SPACE,
  'I become significantly more social in some phases': SocialEnergyRecommendation.ENGAGE_MORE,
  'It varies a lot and is hard to predict': SocialEnergyRecommendation.VARIABLE,
};

// ─── Q4 Option Mapping ──────────────────────────────────────────────────────

const Q4_TRIGGER_MAP: Record<string, AvoidanceTrigger> = {
  'Feeling unheard or not understood': AvoidanceTrigger.FEELING_UNHEARD,
  'Stress / workload / fatigue': AvoidanceTrigger.STRESS_WORKLOAD,
  'Social situations or overstimulation': AvoidanceTrigger.SOCIAL_OVERSTIMULATION,
  'Relationship dynamics or communication tone': AvoidanceTrigger.RELATIONSHIP_DYNAMICS,
  "I don't notice clear triggers": AvoidanceTrigger.NO_CLEAR_TRIGGERS,
  "I don't notice clear triggers": AvoidanceTrigger.NO_CLEAR_TRIGGERS,
  Other: AvoidanceTrigger.OTHER,
};

// ─── Q5 Option Mapping ──────────────────────────────────────────────────────

const Q5_SUPPORT_MAP: Record<string, SupportStyle> = {
  'Space and minimal interaction': SupportStyle.SPACE,
  'Emotional reassurance and empathy': SupportStyle.EMOTIONAL_REASSURANCE,
  'Practical help (tasks, comfort, routines)': SupportStyle.PRACTICAL_HELP,
  'Practical help': SupportStyle.PRACTICAL_HELP,
  'Distraction / fun activities': SupportStyle.DISTRACTION,
  Distraction: SupportStyle.DISTRACTION,
  'I prefer different things depending on the day': SupportStyle.VARIABLE,
};

// ─── Q6 Option Mapping ──────────────────────────────────────────────────────

const Q6_COMMUNICATION_MAP: Record<string, CommunicationApproach> = {
  "Check in gently, but don't push for deep conversation": CommunicationApproach.GENTLE_CHECKIN,
  "Check in gently, but don't push for deep conversation": CommunicationApproach.GENTLE_CHECKIN,
  'Be direct and ask what I need': CommunicationApproach.DIRECT_ASK,
  'Give me space unless I initiate contact': CommunicationApproach.GIVE_SPACE,
  'Stay emotionally present but low-pressure': CommunicationApproach.PRESENT_LOW_PRESSURE,
  'It depends on the situation': CommunicationApproach.SITUATIONAL,
};

// ─── Calibration Functions ──────────────────────────────────────────────────

/**
 * Calibrate confidence level from Q1 response.
 * Maps cycle experience baseline to how assertively phase guidance is framed.
 *
 * - "Very predictable" → HIGH confidence (direct phase-based assumptions)
 * - "Somewhat predictable" → MODERATE confidence
 * - "Unpredictable" or "Not sure yet" → LOW confidence (increased variability qualifiers)
 *
 * Validates: Requirement 20.11
 */
export function calibrateConfidenceLevel(selectedOption: string): ConfidenceLevel {
  return Q1_CONFIDENCE_MAP[selectedOption] ?? ConfidenceLevel.MODERATE;
}

/**
 * Calibrate emotional emphasis from Q2 response.
 * Maps emotional sensitivity pattern to how prominently emotional guidance is presented.
 *
 * - "Slightly" → REDUCED emphasis (brief emotional context)
 * - "Moderately" → MODERATE emphasis
 * - "Strongly" → HEIGHTENED emphasis
 * - "Very strongly" → VERY_HEIGHTENED emphasis (detailed guidance with additional context)
 *
 * Validates: Requirement 20.12
 */
export function calibrateEmotionalEmphasis(selectedOption: string): EmotionalEmphasis {
  return Q2_EMOTIONAL_MAP[selectedOption] ?? EmotionalEmphasis.MODERATE;
}

/**
 * Calibrate social energy recommendation from Q3 response.
 * Maps social energy preference to partner guidance direction.
 *
 * - "Mostly consistent" → CONSISTENT (no special social adjustments)
 * - "I need more alone time" → GIVE_SPACE guidance
 * - "I become significantly more social" → ENGAGE_MORE guidance
 * - "It varies a lot" → VARIABLE (context-dependent recommendations)
 *
 * Validates: Requirement 20.13
 */
export function calibrateSocialEnergy(selectedOption: string): SocialEnergyRecommendation {
  return Q3_SOCIAL_ENERGY_MAP[selectedOption] ?? SocialEnergyRecommendation.CONSISTENT;
}

/**
 * Calibrate avoidance triggers from Q4 response.
 * Maps conflict and sensitivity triggers to prioritized "Avoid This" content.
 * Q4 allows multiple selections, so this returns an array of triggers.
 *
 * Validates: Requirement 20.14
 */
export function calibrateAvoidanceTriggers(
  selectedOptions: string[],
  freeText: string | null,
): { triggers: AvoidanceTrigger[]; customText: string | null } {
  const triggers: AvoidanceTrigger[] = [];

  for (const option of selectedOptions) {
    const trigger = Q4_TRIGGER_MAP[option];
    if (trigger !== undefined) {
      triggers.push(trigger);
    }
  }

  // If no recognized triggers were mapped, default to NO_CLEAR_TRIGGERS
  if (triggers.length === 0) {
    triggers.push(AvoidanceTrigger.NO_CLEAR_TRIGGERS);
  }

  const customText = triggers.includes(AvoidanceTrigger.OTHER) ? (freeText ?? null) : null;

  return { triggers, customText };
}

/**
 * Calibrate support style from Q5 response.
 * Maps preferred support style to "Best Approach" suggestions.
 *
 * - "Space and minimal interaction" → SPACE
 * - "Emotional reassurance and empathy" → EMOTIONAL_REASSURANCE
 * - "Practical help" → PRACTICAL_HELP
 * - "Distraction / fun activities" → DISTRACTION
 * - "I prefer different things depending on the day" → VARIABLE
 *
 * Validates: Requirement 20.15
 */
export function calibrateSupportStyle(selectedOption: string): SupportStyle {
  return Q5_SUPPORT_MAP[selectedOption] ?? SupportStyle.VARIABLE;
}

/**
 * Calibrate communication approach from Q6 response.
 * Maps communication boundaries to check-in frequency and conversation depth.
 *
 * - "Check in gently" → GENTLE_CHECKIN (low frequency, shallow depth)
 * - "Be direct and ask" → DIRECT_ASK (moderate frequency, direct depth)
 * - "Give me space" → GIVE_SPACE (minimal frequency, no initiation)
 * - "Stay emotionally present" → PRESENT_LOW_PRESSURE (moderate frequency, low pressure)
 * - "It depends" → SITUATIONAL (context-dependent)
 *
 * Validates: Requirement 20.16
 */
export function calibrateCommunicationApproach(selectedOption: string): CommunicationApproach {
  return Q6_COMMUNICATION_MAP[selectedOption] ?? CommunicationApproach.SITUATIONAL;
}

// ─── Main Calibration Engine ────────────────────────────────────────────────

/**
 * Generate a complete calibration profile from survey responses.
 * This is the main entry point for the calibration engine.
 *
 * Takes all 6 survey responses and produces a CalibrationProfile that
 * downstream services (InsightsService, GuidanceService, NotificationService)
 * use to personalize partner-facing content.
 *
 * @param responses - Array of survey responses (must contain questions 1-6)
 * @returns CalibrationProfile or null if responses are incomplete
 *
 * Validates: Requirements 20.10, 20.11, 20.12, 20.13, 20.14, 20.15, 20.16
 */
export function generateCalibrationProfile(responses: SurveyResponse[]): CalibrationProfile | null {
  // Ensure we have all 6 responses
  if (responses.length < 6) {
    return null;
  }

  const responseMap = new Map<number, SurveyResponse>();
  for (const response of responses) {
    responseMap.set(response.question_number, response);
  }

  // Verify all questions are present
  for (let q = 1; q <= 6; q++) {
    if (!responseMap.has(q)) {
      return null;
    }
  }

  const q1 = responseMap.get(1) as SurveyResponse;
  const q2 = responseMap.get(2) as SurveyResponse;
  const q3 = responseMap.get(3) as SurveyResponse;
  const q4 = responseMap.get(4) as SurveyResponse;
  const q5 = responseMap.get(5) as SurveyResponse;
  const q6 = responseMap.get(6) as SurveyResponse;

  // Q1 → confidence level
  const confidenceLevel = calibrateConfidenceLevel(q1.selected_options[0] ?? '');

  // Q2 → emotional emphasis
  const emotionalEmphasis = calibrateEmotionalEmphasis(q2.selected_options[0] ?? '');

  // Q3 → social energy recommendations
  const socialEnergyRecommendation = calibrateSocialEnergy(q3.selected_options[0] ?? '');

  // Q4 → avoidance triggers (multi-select)
  const { triggers: avoidanceTriggers, customText: customTriggerText } = calibrateAvoidanceTriggers(
    q4.selected_options,
    q4.free_text,
  );

  // Q5 → support style
  const supportStyle = calibrateSupportStyle(q5.selected_options[0] ?? '');

  // Q6 → communication approach
  const communicationApproach = calibrateCommunicationApproach(q6.selected_options[0] ?? '');

  return {
    confidenceLevel,
    emotionalEmphasis,
    socialEnergyRecommendation,
    avoidanceTriggers,
    customTriggerText,
    supportStyle,
    communicationApproach,
  };
}
