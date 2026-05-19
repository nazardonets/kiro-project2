import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { CyclePhase, SurveyResponse } from '@/lib/types';

import {
  generateCalibrationProfile,
  CalibrationProfile,
  Q1_OPTIONS,
  Q2_OPTIONS,
  Q3_OPTIONS,
  Q4_OPTIONS,
  Q5_OPTIONS,
  Q6_OPTIONS,
} from './survey-calibration';

// ─── Survey Question Texts (raw data that must never appear in partner content) ─

/**
 * All raw survey question prompts as defined in Requirement 20.
 * These must NEVER appear in partner-facing content.
 */
const SURVEY_QUESTION_TEXTS = [
  'How would you describe your typical cycle experience?',
  'During your cycle, how much do your emotions tend to change?',
  'How does your social energy typically change during your cycle?',
  'What tends to affect your mood most during sensitive phases?',
  "When you're feeling low or sensitive, what kind of support helps most?",
  'How would you like your partner to engage with you during difficult phases?',
] as const;

/**
 * All raw survey option labels across all 6 questions.
 * These must NEVER appear verbatim in partner-facing content.
 */
const ALL_RAW_OPTION_LABELS: string[] = [
  // Q1 options (full text from requirements)
  'Very predictable (I usually notice clear patterns each month)',
  'Somewhat predictable (I notice patterns, but they vary)',
  'Unpredictable (each cycle feels different)',
  'Not sure yet',
  // Q2 options (full text from requirements)
  'Slightly (subtle shifts, still stable overall)',
  'Moderately (noticeable mood changes)',
  'Strongly (clear emotional shifts across phases)',
  'Very strongly (emotions feel significantly different day to day)',
  // Q3 options
  'Mostly consistent across all phases',
  'I need more alone time in certain phases',
  'I become significantly more social in some phases',
  'It varies a lot and is hard to predict',
  // Q4 options
  'Feeling unheard or not understood',
  'Stress / workload / fatigue',
  'Social situations or overstimulation',
  'Relationship dynamics or communication tone',
  "I don't notice clear triggers",
  // Q5 options
  'Space and minimal interaction',
  'Emotional reassurance and empathy',
  'Practical help (tasks, comfort, routines)',
  'Distraction / fun activities',
  'I prefer different things depending on the day',
  // Q6 options
  "Check in gently, but don't push for deep conversation",
  'Be direct and ask what I need',
  'Give me space unless I initiate contact',
  'Stay emotionally present but low-pressure',
  'It depends on the situation',
  // Short form options used in calibration engine
  ...Q1_OPTIONS,
  ...Q2_OPTIONS,
  ...Q3_OPTIONS,
  ...Q4_OPTIONS,
  ...Q5_OPTIONS,
  ...Q6_OPTIONS,
];

/**
 * Deduplicated set of all raw option labels (some short forms overlap with full forms).
 */
const UNIQUE_RAW_OPTIONS = [...new Set(ALL_RAW_OPTION_LABELS)];

// ─── Partner-Facing Content Generator (simulates InsightsService/GuidanceService) ─

/**
 * Represents all partner-facing content types that must not contain raw survey data.
 */
interface PartnerFacingContent {
  insightsDashboard: string[];
  guidancePanel: string[];
  dailySummary: {
    todaysState: string;
    bestApproach: string[];
    avoidThis: string[];
  };
  emailNotification: string[];
}

/**
 * Generates partner-facing content from a CalibrationProfile.
 * This simulates what InsightsService, GuidanceService, and NotificationService
 * would produce. The key property is that the output uses calibrated guidance
 * language, NOT raw survey question text or option labels.
 */
function generatePartnerFacingContent(
  profile: CalibrationProfile,
  phase: CyclePhase,
): PartnerFacingContent {
  const insights: string[] = [];
  const guidance: string[] = [];
  const bestApproach: string[] = [];
  const avoidThis: string[] = [];
  const emailContent: string[] = [];

  // Confidence level → framing style
  switch (profile.confidenceLevel) {
    case 'high':
      insights.push('Your partner may tend to follow consistent patterns during this phase.');
      break;
    case 'moderate':
      insights.push('Your partner often notices some patterns, though they can vary.');
      break;
    case 'low':
      insights.push(
        'Every cycle can feel different for your partner. Stay flexible and attentive.',
      );
      break;
  }

  // Emotional emphasis → emotional guidance intensity
  switch (profile.emotionalEmphasis) {
    case 'reduced':
      insights.push('Emotional shifts may be subtle during this phase.');
      break;
    case 'standard':
      insights.push('You might notice some emotional changes during this phase.');
      break;
    case 'heightened':
      insights.push('Emotional shifts may be more noticeable. Consider being extra attentive.');
      break;
    case 'intensive':
      insights.push(
        'Emotions may feel significantly different. Extra patience and understanding could help.',
      );
      break;
  }

  // Social energy → engagement recommendations
  switch (profile.socialEnergyRecommendation) {
    case 'maintain_engagement':
      guidance.push('Social energy tends to stay consistent. Continue engaging as usual.');
      break;
    case 'give_space':
      guidance.push(
        'Your partner may appreciate more alone time during certain phases. Consider giving space.',
      );
      break;
    case 'engage_more':
      guidance.push(
        'Your partner may feel more social during this phase. Consider planning activities together.',
      );
      break;
    case 'vary_approach':
      guidance.push(
        'Social energy can vary. Check in gently to gauge how your partner is feeling.',
      );
      break;
  }

  // Avoidance triggers → "Avoid This" content
  for (const trigger of profile.avoidanceTriggers) {
    switch (trigger) {
      case 'feeling_unheard':
        avoidThis.push('Try to actively listen and validate feelings.');
        break;
      case 'stress_workload':
        avoidThis.push('Consider reducing pressure around tasks and responsibilities.');
        break;
      case 'social_overstimulation':
        avoidThis.push('Be mindful of social demands and overstimulation.');
        break;
      case 'relationship_dynamics':
        avoidThis.push('Be aware of communication tone and relationship dynamics.');
        break;
      default:
        break;
    }
  }

  // Support style → "Best Approach" content
  switch (profile.supportStyle) {
    case 'space':
      bestApproach.push('Offer space and minimal interaction unless asked.');
      break;
    case 'emotional_reassurance':
      bestApproach.push('Offer emotional reassurance and empathetic listening.');
      break;
    case 'practical_help':
      bestApproach.push('Consider helping with practical tasks or routines.');
      break;
    case 'distraction':
      bestApproach.push('Light-hearted activities or fun distractions may help.');
      break;
    case 'adaptive':
      bestApproach.push('Support needs may vary day to day. Ask what would help most.');
      break;
  }

  // Communication approach → interaction guidance
  switch (profile.communicationApproach.initiationBehavior) {
    case 'partner_initiates':
      if (profile.communicationApproach.conversationDepth === 'shallow') {
        guidance.push('Consider checking in gently without pushing for deep conversation.');
      } else {
        guidance.push('You might try being direct about asking what your partner needs.');
      }
      break;
    case 'user_initiates':
      guidance.push('Your partner may prefer to initiate contact. Give space until then.');
      break;
    case 'mutual':
      guidance.push('Stay emotionally present but keep interactions low-pressure.');
      break;
    case 'situational':
      guidance.push('Communication needs may vary by situation. Stay attentive to cues.');
      break;
  }

  // Phase-specific content
  const phaseLabel = phase.replace('_', ' ');
  const todaysState = `Your partner is currently in the ${phaseLabel} phase. ${insights[0] ?? ''}`;

  emailContent.push(
    `Phase: ${phaseLabel}`,
    ...insights,
    ...guidance.slice(0, 2),
    ...bestApproach.slice(0, 2),
  );

  return {
    insightsDashboard: insights,
    guidancePanel: guidance,
    dailySummary: {
      todaysState,
      bestApproach: bestApproach.length > 0 ? bestApproach : ['Be supportive and attentive.'],
      avoidThis: avoidThis.length > 0 ? avoidThis : ['Avoid being dismissive of feelings.'],
    },
    emailNotification: emailContent,
  };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a random Q1 option */
const q1OptionArb = fc.constantFrom(...Q1_OPTIONS);

/** Generate a random Q2 option */
const q2OptionArb = fc.constantFrom(...Q2_OPTIONS);

/** Generate a random Q3 option */
const q3OptionArb = fc.constantFrom(...Q3_OPTIONS);

/** Generate a random Q4 option set (1 or more selections) */
const q4OptionsArb = fc.subarray([...Q4_OPTIONS], { minLength: 1 }).map((arr) => [...arr]);

/** Generate a random Q5 option */
const q5OptionArb = fc.constantFrom(...Q5_OPTIONS);

/** Generate a random Q6 option */
const q6OptionArb = fc.constantFrom(...Q6_OPTIONS);

/** Generate optional free text for Q4 (when "Other" is selected) */
const freeTextArb = fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null });

/** Generate a random cycle phase */
const cyclePhaseArb = fc.constantFrom(
  CyclePhase.MENSTRUAL,
  CyclePhase.FOLLICULAR,
  CyclePhase.OVULATION,
  CyclePhase.EARLY_LUTEAL,
  CyclePhase.LATE_LUTEAL,
);

/** Generate a complete set of survey responses */
const surveyResponsesArb = fc
  .tuple(q1OptionArb, q2OptionArb, q3OptionArb, q4OptionsArb, q5OptionArb, q6OptionArb, freeTextArb)
  .map(([q1, q2, q3, q4, q5, q6, freeText]): SurveyResponse[] => {
    const now = new Date().toISOString();
    const userId = 'test-user';

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
        selected_options: q4,
        free_text: q4.includes('Other') ? freeText : null,
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

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Collects all text strings from partner-facing content into a single array.
 */
function collectAllPartnerText(content: PartnerFacingContent): string[] {
  return [
    ...content.insightsDashboard,
    ...content.guidancePanel,
    content.dailySummary.todaysState,
    ...content.dailySummary.bestApproach,
    ...content.dailySummary.avoidThis,
    ...content.emailNotification,
  ];
}

/**
 * Checks if any raw survey text appears verbatim in the partner-facing content.
 * Returns the first match found, or null if no raw data leaks.
 */
function findRawSurveyDataLeak(
  partnerTexts: string[],
  rawOptions: string[],
  questionTexts: readonly string[],
): string | null {
  const allPartnerContent = partnerTexts.join(' ');

  // Check for raw question text
  for (const questionText of questionTexts) {
    if (allPartnerContent.includes(questionText)) {
      return `Question text leaked: "${questionText}"`;
    }
  }

  // Check for raw option labels (only check options that are long enough to be meaningful)
  // Short generic words like "Other" are excluded as they may appear naturally in guidance
  for (const option of rawOptions) {
    // Skip very short options that could naturally appear in guidance text
    if (option.length <= 5) continue;

    if (allPartnerContent.includes(option)) {
      return `Option label leaked: "${option}"`;
    }
  }

  return null;
}

// ─── Property 34: Survey Response Privacy ────────────────────────────────────

/**
 * **Validates: Requirements 20.20**
 *
 * Property 34: Survey Response Privacy
 *
 * For any Partner_User-facing content (Insights_Dashboard, Guidance_Panel,
 * Daily_Summary, Email_Notifications), the raw Survey_Response data
 * (question text, selected option labels) SHALL never appear. Only calibrated
 * guidance derived from the responses SHALL be visible.
 */
describe('Property 34: Survey Response Privacy', () => {
  it('partner-facing content never contains raw survey question text', () => {
    fc.assert(
      fc.property(surveyResponsesArb, cyclePhaseArb, (responses, phase) => {
        const profile = generateCalibrationProfile(responses);
        expect(profile).not.toBeNull();

        const content = generatePartnerFacingContent(profile as CalibrationProfile, phase);
        const allTexts = collectAllPartnerText(content);
        const allContent = allTexts.join(' ');

        // No raw question text should appear in partner-facing content
        for (const questionText of SURVEY_QUESTION_TEXTS) {
          expect(allContent).not.toContain(questionText);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('partner-facing content never contains raw survey option labels', () => {
    fc.assert(
      fc.property(surveyResponsesArb, cyclePhaseArb, (responses, phase) => {
        const profile = generateCalibrationProfile(responses);
        expect(profile).not.toBeNull();

        const content = generatePartnerFacingContent(profile as CalibrationProfile, phase);
        const allTexts = collectAllPartnerText(content);

        const leak = findRawSurveyDataLeak(allTexts, UNIQUE_RAW_OPTIONS, []);
        expect(leak).toBeNull();
      }),
      { numRuns: 300 },
    );
  });

  it('even when calibration profile contains trigger data, partner-facing content never exposes raw option labels', () => {
    fc.assert(
      fc.property(surveyResponsesArb, cyclePhaseArb, (responses, phase) => {
        const profile = generateCalibrationProfile(responses);
        expect(profile).not.toBeNull();

        // Even though the profile may internally reference triggers,
        // the partner-facing content must translate them to guidance language
        const content = generatePartnerFacingContent(profile as CalibrationProfile, phase);
        const allTexts = collectAllPartnerText(content);
        const allContent = allTexts.join(' ');

        // Verify no raw Q4 option labels appear in partner content
        const q4RawOptions = [
          'Feeling unheard or not understood',
          'Stress / workload / fatigue',
          'Social situations or overstimulation',
          'Relationship dynamics or communication tone',
          "I don't notice clear triggers",
        ];

        for (const option of q4RawOptions) {
          expect(allContent).not.toContain(option);
        }

        // Verify no raw options from any other question appear either
        for (const option of UNIQUE_RAW_OPTIONS) {
          if (option.length > 5) {
            expect(allContent).not.toContain(option);
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it('for any combination of survey responses, generated content uses only calibrated guidance language', () => {
    fc.assert(
      fc.property(surveyResponsesArb, cyclePhaseArb, (responses, phase) => {
        const profile = generateCalibrationProfile(responses);
        expect(profile).not.toBeNull();

        const content = generatePartnerFacingContent(profile as CalibrationProfile, phase);
        const allTexts = collectAllPartnerText(content);
        const allContent = allTexts.join(' ');

        // Combined check: no raw survey data (questions or options) should leak
        const leak = findRawSurveyDataLeak(allTexts, UNIQUE_RAW_OPTIONS, SURVEY_QUESTION_TEXTS);
        expect(leak).toBeNull();

        // Content should be non-empty (calibration produces actual guidance)
        expect(allTexts.length).toBeGreaterThan(0);
        expect(allContent.length).toBeGreaterThan(0);
      }),
      { numRuns: 300 },
    );
  });
});
