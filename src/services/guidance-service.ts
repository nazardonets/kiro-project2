import { CyclePhase, SurveyResponse } from '@/lib/types';
import { BEHAVIORAL_PROMPT_MAX_LENGTH } from '@/lib/constants';
import {
  AvoidanceTrigger,
  CalibrationProfile,
  ConfidenceLevel,
  EmotionalEmphasis,
  SocialEnergyRecommendation,
  SupportStyle,
  CommunicationApproach,
  generateCalibrationProfile,
} from '@/services/survey-calibration-engine';

// ─── Guidance Content Types ─────────────────────────────────────────────────

/** A single guidance content item with contextual detail */
export interface GuidanceItem {
  text: string;
}

/** Complete guidance content for a cycle phase */
export interface GuidanceContent {
  phase: CyclePhase;
  supportiveActions: string[];
  triggersToAvoid: string[];
  communicationStrategies: string[];
  discouragedPatterns: string[];
}

/** Calibrated guidance content (after survey modifiers are applied) */
export interface CalibratedGuidanceContent extends GuidanceContent {
  calibrationApplied: boolean;
}

// ─── Daily Summary Types ────────────────────────────────────────────────────

/**
 * Daily Summary structure containing today's state, best approach, and avoid this sections.
 *
 * Validates: Requirements 15.1, 15.2, 15.3
 */
export interface DailySummaryContent {
  /** Current phase state description (phase name + emotional tendencies + energy level, max 3 sentences) */
  todaysState: string;
  /** Recommended supportive behaviors (1-3 items) */
  bestApproach: string[];
  /** Behaviors to avoid (1-3 items) */
  avoidThis: string[];
  /** The phase used for generation */
  phase: CyclePhase;
}

// ─── Decision Support Types ─────────────────────────────────────────────────

/** A situational recommendation addressing a specific relationship scenario */
export interface SituationalRecommendation {
  scenario: string;
  recommendation: string;
}

/** Decision support content for a given cycle phase */
export interface DecisionSupport {
  phase: CyclePhase;
  behavioralPrompts: string[];
  situationalRecommendations: SituationalRecommendation[];
}

// ─── Decision Support Content Bounds ────────────────────────────────────────

/** Minimum number of behavioral prompts per phase */
export const MIN_BEHAVIORAL_PROMPTS = 3;

/** Maximum number of behavioral prompts per phase */
export const MAX_BEHAVIORAL_PROMPTS = 5;

/** Maximum number of sentences per behavioral prompt */
export const MAX_PROMPT_SENTENCES = 2;

/** Minimum number of situational recommendations per phase */
export const MIN_SITUATIONAL_RECOMMENDATIONS = 2;

/** Maximum number of situational recommendations per phase */
export const MAX_SITUATIONAL_RECOMMENDATIONS = 4;

// ─── Base Guidance Content ──────────────────────────────────────────────────

/**
 * Base supportive actions for each phase.
 * Uses suggestion-oriented language ("consider", "you might try").
 * 3-5 items per phase.
 */
const BASE_SUPPORTIVE_ACTIONS: Record<CyclePhase, string[]> = {
  [CyclePhase.MENSTRUAL]: [
    'Consider offering a warm drink or preparing a cozy space without being asked.',
    'You might try handling a few extra household tasks to lighten her load.',
    'A gentle check-in like "Is there anything I can do for you?" may be appreciated.',
    'You could suggest a quiet evening together with minimal planning required.',
    'Consider giving her space to rest without taking it personally.',
  ],
  [CyclePhase.FOLLICULAR]: [
    'You might suggest trying a new activity or restaurant together.',
    'Consider being open to spontaneous plans — she may feel more adventurous.',
    'You could share an idea or project you have been thinking about to spark conversation.',
    'Supporting her new initiatives or goals with encouragement may go a long way.',
    'Consider planning a date that involves something novel or creative.',
  ],
  [CyclePhase.OVULATION]: [
    'You might plan a social outing or gathering with friends she enjoys.',
    'Consider expressing appreciation and affection more openly during this time.',
    'You could initiate deeper conversations about your relationship or future plans.',
    'Being physically present and engaged may feel especially meaningful to her.',
    'Consider suggesting an active date like a walk, dance class, or outdoor activity.',
  ],
  [CyclePhase.EARLY_LUTEAL]: [
    'You might help her stay organized by offering to assist with planning or logistics.',
    'Consider respecting her focus time and avoiding unnecessary interruptions.',
    'You could acknowledge her productivity and express appreciation for her efforts.',
    'Suggesting structured quality time with a clear plan may work well.',
  ],
  [CyclePhase.LATE_LUTEAL]: [
    'Consider being extra patient and avoiding taking her reactions personally.',
    'You might offer comfort without trying to fix or solve her feelings.',
    'A simple "I am here for you" without pressure to talk may be reassuring.',
    'Consider reducing expectations for social plans or high-energy activities.',
    'You could prepare her favorite comfort food or suggest a relaxing activity.',
  ],
};

/**
 * Base triggers to avoid for each phase.
 * Uses probabilistic framing ("may be sensitive to", "could feel overwhelming").
 * 2-4 items per phase.
 */
const BASE_TRIGGERS_TO_AVOID: Record<CyclePhase, string[]> = {
  [CyclePhase.MENSTRUAL]: [
    'Pushing for social plans or high-energy activities may feel overwhelming right now.',
    'Commenting on her energy level or mood could come across as dismissive.',
    'Making demands on her time or attention may increase stress during this phase.',
  ],
  [CyclePhase.FOLLICULAR]: [
    'Being overly cautious or protective may feel stifling when she is feeling energized.',
    'Dismissing her new ideas or plans could dampen her growing enthusiasm.',
    'Bringing up heavy emotional topics may not align with her current lighter mood.',
  ],
  [CyclePhase.OVULATION]: [
    'Withdrawing socially when she wants connection could feel like rejection.',
    'Being dismissive of her desire to go out or be active may cause frustration.',
    'Avoiding eye contact or physical closeness may feel hurtful during this phase.',
  ],
  [CyclePhase.EARLY_LUTEAL]: [
    'Disrupting her routines or plans without notice may cause unnecessary stress.',
    'Being vague or indecisive when she prefers clarity could be frustrating.',
    'Adding unplanned obligations to her schedule may feel overwhelming.',
  ],
  [CyclePhase.LATE_LUTEAL]: [
    'Telling her to "calm down" or "relax" may feel invalidating.',
    'Bringing up sensitive topics or unresolved conflicts could escalate quickly.',
    'Making jokes at her expense may land differently than intended during this phase.',
    'Pointing out that her reactions might be "hormonal" can feel deeply dismissive.',
  ],
};

/**
 * Base communication strategies for each phase.
 * Includes recommended tone and language examples.
 * 2-4 items per phase.
 */
const BASE_COMMUNICATION_STRATEGIES: Record<CyclePhase, string[]> = {
  [CyclePhase.MENSTRUAL]: [
    'Consider using a softer, quieter tone — she may appreciate gentleness over enthusiasm.',
    'Short, caring messages like "Thinking of you" may feel more supportive than long conversations.',
    'You might try validating her feelings with phrases like "That makes sense" rather than offering solutions.',
  ],
  [CyclePhase.FOLLICULAR]: [
    'Matching her energy with an upbeat, curious tone may strengthen your connection.',
    'You could try asking open-ended questions about her plans or ideas to show interest.',
    'Sharing your own excitement about things may resonate well during this phase.',
  ],
  [CyclePhase.OVULATION]: [
    'Being expressive and emotionally open in conversation may feel natural and welcome.',
    'You might try complimenting her specifically — she may be more receptive to appreciation.',
    'Engaging in playful, flirtatious communication could strengthen your bond.',
    'Active listening with eye contact and full attention may feel especially meaningful.',
  ],
  [CyclePhase.EARLY_LUTEAL]: [
    'Clear, direct communication without ambiguity may be most effective right now.',
    'You might try keeping conversations focused and purposeful rather than open-ended.',
    'Acknowledging her accomplishments with specific praise could be well-received.',
  ],
  [CyclePhase.LATE_LUTEAL]: [
    'Speaking slowly and calmly, with extra patience for pauses, may help her feel safe.',
    'You might try leading with empathy: "I can see this is hard" before offering any input.',
    'Avoiding sarcasm or teasing — even playful — may prevent misunderstandings.',
    'Asking "Would you like me to just listen, or would advice help?" shows respect for her needs.',
  ],
};

/**
 * Base discouraged language patterns for each phase.
 * Patterns to avoid in communication.
 * 2-4 items per phase.
 */
const BASE_DISCOURAGED_PATTERNS: Record<CyclePhase, string[]> = {
  [CyclePhase.MENSTRUAL]: [
    'Avoid phrases like "You should just..." or "Why don\'t you..." which may feel dismissive of her experience.',
    'Language that minimizes her feelings, such as "It\'s not that bad" or "You\'ll be fine," may feel invalidating.',
    'Directive statements like "You need to get up and do something" could add pressure she does not need.',
  ],
  [CyclePhase.FOLLICULAR]: [
    'Cautionary language like "Are you sure about that?" may dampen her growing confidence.',
    'Phrases that imply she is being unrealistic, such as "That seems like a lot," could feel unsupportive.',
  ],
  [CyclePhase.OVULATION]: [
    'Dismissive responses like "Not now" or "Maybe later" may feel like rejection during this social phase.',
    'Language that shuts down conversation, such as "I don\'t want to talk about it," could feel hurtful.',
    'Being overly brief or disengaged in responses may signal disinterest.',
  ],
  [CyclePhase.EARLY_LUTEAL]: [
    'Vague or noncommittal language like "We\'ll see" or "Whatever you want" may feel frustrating.',
    'Interrupting her focus with "Can we talk about something?" without context may feel disruptive.',
    'Phrases that undermine her planning, such as "Why does it matter?" could feel dismissive.',
  ],
  [CyclePhase.LATE_LUTEAL]: [
    'Phrases like "You\'re overreacting" or "It\'s not a big deal" may feel deeply invalidating.',
    'Defensive language such as "I didn\'t do anything wrong" may escalate tension.',
    'Sarcastic remarks or jokes about her mood could feel hurtful and dismissive.',
    'Telling her "You always get like this" uses deterministic language that may feel reductive.',
  ],
};

// ─── Base Behavioral Prompts (Decision Support) ─────────────────────────────

/**
 * Base behavioral prompts for each phase.
 * Each prompt is max 280 characters and max 2 sentences.
 * Uses probabilistic/suggestion-oriented language.
 * 3-5 prompts per phase.
 */
const BASE_BEHAVIORAL_PROMPTS: Record<CyclePhase, string[]> = {
  [CyclePhase.MENSTRUAL]: [
    'Consider offering a warm drink or cozy blanket without being asked. Small gestures of comfort can mean a lot right now.',
    'You might keep conversations light and brief today. She may appreciate quiet companionship over active engagement.',
    'Try giving her extra space for rest without taking it personally. Her need for solitude likely reflects her energy, not your relationship.',
    'Consider handling a household task she usually manages. Practical support may feel especially meaningful during this phase.',
    'You might check in with a simple, caring question without pressing for details. A gentle presence can be enough.',
  ],
  [CyclePhase.FOLLICULAR]: [
    'This could be a great time to suggest a new activity together. She may be feeling more adventurous and open to exploration.',
    'Consider sharing an idea or plan you have been thinking about. She might be especially receptive to future-oriented conversations.',
    'You might propose a spontaneous outing or date. Her energy and curiosity may be building during this phase.',
    'Try engaging her in a creative project or brainstorming session. She may enjoy collaborative thinking right now.',
    'Consider asking about her goals or interests. She might appreciate feeling seen and supported in her aspirations.',
  ],
  [CyclePhase.OVULATION]: [
    'This may be an ideal time for deeper conversations or meaningful connection. She might feel especially open and expressive.',
    'Consider planning a social activity together. She may enjoy being around others and sharing experiences with you.',
    'You might express appreciation or affection more openly. She could be particularly receptive to emotional warmth right now.',
    'Try initiating quality time without distractions. She may value focused attention and genuine connection during this phase.',
    'Consider being more playful and spontaneous. She might respond well to lighthearted energy and shared laughter.',
  ],
  [CyclePhase.EARLY_LUTEAL]: [
    'You might support her focus by minimizing unnecessary interruptions. She may be in a productive flow during this phase.',
    'Consider helping with practical tasks or errands. She might appreciate actions that support her sense of accomplishment.',
    'Try respecting her need for structure and routine. Unexpected changes may feel more disruptive than usual.',
    'You might offer to handle logistics for shared plans. She may prefer clear, organized communication right now.',
  ],
  [CyclePhase.LATE_LUTEAL]: [
    'Consider being extra patient and gentle with your words. She may be more sensitive to tone and phrasing right now.',
    'You might avoid bringing up stressful topics or decisions today. Timing conversations thoughtfully can make a real difference.',
    'Try offering reassurance without being prompted. She may need to hear that things are okay between you.',
    'Consider creating a calm, low-pressure environment at home. Reducing stimulation may help her feel more at ease.',
    'You might acknowledge her feelings without trying to fix them. Sometimes being heard is more valuable than solutions.',
  ],
};

// ─── Base Situational Recommendations (Decision Support) ────────────────────

/**
 * Base situational recommendations for each phase.
 * Each addresses a specific relationship scenario.
 * Uses suggestion-oriented language.
 * 2-4 recommendations per phase.
 */
const BASE_SITUATIONAL_RECOMMENDATIONS: Record<CyclePhase, SituationalRecommendation[]> = {
  [CyclePhase.MENSTRUAL]: [
    {
      scenario: 'Planning an evening together',
      recommendation:
        'Consider a quiet night in with her favorite comfort food and a low-key movie. She may prefer familiar, cozy settings over anything that requires energy or social effort.',
    },
    {
      scenario: 'Handling a disagreement',
      recommendation:
        'You might gently suggest revisiting the conversation in a day or two. She may find it harder to process conflict when her energy is low, and waiting could lead to a more productive discussion.',
    },
    {
      scenario: 'Initiating conversation',
      recommendation:
        'Try a brief, warm check-in like "Is there anything I can do for you today?" without expecting a long response. She may appreciate the thought without the pressure to engage deeply.',
    },
  ],
  [CyclePhase.FOLLICULAR]: [
    {
      scenario: 'Planning an evening together',
      recommendation:
        'Consider suggesting something new — a restaurant you have not tried, a class, or an outdoor activity. She may be feeling adventurous and open to fresh experiences.',
    },
    {
      scenario: 'Handling a disagreement',
      recommendation:
        'This could be a good time to address unresolved issues calmly. She may have more emotional bandwidth and openness to finding solutions together.',
    },
    {
      scenario: 'Initiating conversation',
      recommendation:
        'You might bring up future plans or shared goals. She could be feeling optimistic and enjoy dreaming together about what is ahead.',
    },
    {
      scenario: 'Showing appreciation',
      recommendation:
        'Consider expressing gratitude for something specific she has done recently. She may be especially receptive to positive feedback during this energized phase.',
    },
  ],
  [CyclePhase.OVULATION]: [
    {
      scenario: 'Planning an evening together',
      recommendation:
        'Consider a social outing or double date. She may enjoy being around others and feel energized by group connection during this phase.',
    },
    {
      scenario: 'Handling a disagreement',
      recommendation:
        'Try addressing it directly but warmly. She may be more communicative and willing to work through things together right now.',
    },
    {
      scenario: 'Initiating conversation',
      recommendation:
        'You might share something personal or vulnerable. She could be feeling emotionally generous and open to deeper connection.',
    },
    {
      scenario: 'Planning a surprise',
      recommendation:
        'This may be a great time for a thoughtful surprise or spontaneous gesture. She might be especially appreciative of romantic effort during this phase.',
    },
  ],
  [CyclePhase.EARLY_LUTEAL]: [
    {
      scenario: 'Planning an evening together',
      recommendation:
        'Consider a structured activity like cooking a meal together or working on a shared project. She may enjoy purposeful, collaborative time over unstructured socializing.',
    },
    {
      scenario: 'Handling a disagreement',
      recommendation:
        'You might approach it with a clear, practical focus on solutions rather than emotions. She may prefer direct, efficient communication during this phase.',
    },
    {
      scenario: 'Initiating conversation',
      recommendation:
        'Try discussing practical matters or shared responsibilities. She may appreciate conversations that feel productive and purposeful.',
    },
  ],
  [CyclePhase.LATE_LUTEAL]: [
    {
      scenario: 'Planning an evening together',
      recommendation:
        'Consider a calm, familiar activity with minimal decision-making required. She may prefer comfort and predictability over novelty right now.',
    },
    {
      scenario: 'Handling a disagreement',
      recommendation:
        'You might acknowledge her feelings first before discussing solutions. She may need to feel heard and validated before she can engage with problem-solving.',
    },
    {
      scenario: 'Initiating conversation',
      recommendation:
        'Try leading with empathy and reassurance. A simple "I am here for you" may resonate more than trying to cheer her up or offer advice.',
    },
    {
      scenario: 'Managing expectations',
      recommendation:
        'Consider lowering expectations for social plans or productivity. She may feel overwhelmed by obligations, and flexibility could reduce her stress.',
    },
  ],
};

// ─── Calibration Modifiers ──────────────────────────────────────────────────

/**
 * Applies confidence level modifier to guidance content.
 * Low confidence: adds variability qualifiers to acknowledge individual differences.
 */
function applyConfidenceModifier(content: string[], confidenceLevel: ConfidenceLevel): string[] {
  if (confidenceLevel === 'low') {
    // Add a variability acknowledgment to the last item
    const lastIndex = content.length - 1;
    if (lastIndex >= 0 && !content[lastIndex].includes('every person is different')) {
      const modified = [...content];
      modified[lastIndex] = modified[lastIndex].replace(
        /\.$/,
        ' — though every person is different.',
      );
      return modified;
    }
  }

  return content;
}

/**
 * Applies emotional emphasis modifier to triggers and discouraged patterns.
 * Heightened/Very heightened: adds extra sensitivity context.
 */
function applyEmotionalEmphasisToTriggers(
  triggers: string[],
  emphasis: EmotionalEmphasis,
): string[] {
  if (emphasis === 'very_heightened') {
    return [
      ...triggers,
      'Emotional responses may be particularly intense — extra gentleness is likely appreciated.',
    ];
  }

  if (emphasis === 'heightened') {
    return [
      ...triggers,
      'She may be more emotionally sensitive than usual — consider being extra mindful.',
    ];
  }

  return triggers;
}

/**
 * Applies social energy modifier to supportive actions.
 */
function applySocialEnergyToActions(
  actions: string[],
  socialEnergy: SocialEnergyRecommendation,
  phase: CyclePhase,
): string[] {
  const isHighEnergyPhase = phase === CyclePhase.OVULATION || phase === CyclePhase.FOLLICULAR;
  const isLowEnergyPhase = phase === CyclePhase.MENSTRUAL || phase === CyclePhase.LATE_LUTEAL;

  if (socialEnergy === 'give_space' && isLowEnergyPhase) {
    return [
      ...actions,
      'Offering her uninterrupted alone time may be especially valued during this phase.',
    ];
  }

  if (socialEnergy === 'engage_more' && isHighEnergyPhase) {
    return [
      ...actions,
      'Initiating shared social activities may align well with her energy right now.',
    ];
  }

  return actions;
}

/**
 * Applies support style modifier to supportive actions.
 */
function applySupportStyleToActions(
  actions: string[],
  supportStyle: SupportStyle,
  phase: CyclePhase,
): string[] {
  const isLowEnergyPhase = phase === CyclePhase.MENSTRUAL || phase === CyclePhase.LATE_LUTEAL;

  if (!isLowEnergyPhase) {
    return actions;
  }

  switch (supportStyle) {
    case 'space':
      return [
        ...actions,
        'Giving her physical and emotional space without hovering may be what she needs most.',
      ];
    case 'emotional_reassurance':
      return [
        ...actions,
        'Verbal reassurance and empathetic presence may be especially comforting right now.',
      ];
    case 'practical_help':
      return [
        ...actions,
        'Taking care of practical tasks like cooking or tidying may show support in a tangible way.',
      ];
    case 'distraction':
      return [
        ...actions,
        'Suggesting a lighthearted activity or funny show may help shift her mood gently.',
      ];
    default:
      return actions;
  }
}

/**
 * Applies communication approach modifier to communication strategies.
 */
function applyCommunicationApproachToStrategies(
  strategies: string[],
  approach: CommunicationApproach,
): string[] {
  switch (approach) {
    case 'gentle_checkin':
      return [
        ...strategies,
        'Brief, gentle check-ins without expecting a long response may work best for her.',
      ];
    case 'direct_ask':
      return [
        ...strategies,
        'Asking directly "What do you need from me right now?" may be appreciated.',
      ];
    case 'give_space':
      return [
        ...strategies,
        'Letting her initiate conversations when she is ready may feel most respectful.',
      ];
    case 'present_low_pressure':
      return [
        ...strategies,
        'Being quietly present without pressure to engage may feel most supportive.',
      ];
    default:
      return strategies;
  }
}

/**
 * Applies avoidance triggers from Q4 to triggers-to-avoid content.
 */
function applyAvoidanceTriggersToContent(
  triggers: string[],
  avoidanceTriggers: string[],
  customText: string | null,
  phase: CyclePhase,
): string[] {
  const isSensitivePhase = phase === CyclePhase.LATE_LUTEAL || phase === CyclePhase.MENSTRUAL;

  if (!isSensitivePhase || avoidanceTriggers.length === 0) {
    return triggers;
  }

  // Skip if only "no_clear_triggers" is present
  if (avoidanceTriggers.length === 1 && avoidanceTriggers[0] === 'no_clear_triggers') {
    return triggers;
  }

  const additions: string[] = [];

  if (avoidanceTriggers.includes('feeling_unheard')) {
    additions.push(
      'She may be particularly sensitive to feeling unheard — consider giving her your full attention.',
    );
  }
  if (avoidanceTriggers.includes('stress_workload')) {
    additions.push(
      'Mentioning workload or adding responsibilities may feel especially heavy right now.',
    );
  }
  if (avoidanceTriggers.includes('social_overstimulation')) {
    additions.push(
      'Suggesting busy social plans may feel overwhelming — quieter options could work better.',
    );
  }
  if (avoidanceTriggers.includes('relationship_dynamics')) {
    additions.push(
      'Bringing up relationship concerns or critiques may land harder during this phase.',
    );
  }
  if (avoidanceTriggers.includes('other') && customText) {
    additions.push(
      'Personal sensitivity triggers may be more pronounced — consider being extra thoughtful.',
    );
  }

  return [...triggers, ...additions];
}

// ─── Content Bounds Enforcement ─────────────────────────────────────────────

/**
 * Enforce minimum and maximum bounds on content arrays.
 * When content exceeds max, keeps the last items (calibration additions)
 * by removing from the middle of the base content.
 */
function enforceBounds(
  content: string[],
  min: number,
  max: number,
  baseCount?: number,
): string[] {
  if (content.length <= max) {
    return content;
  }

  // If we know how many base items there are, preserve calibration additions at the end
  if (baseCount !== undefined && baseCount < content.length) {
    const calibrationItems = content.slice(baseCount);
    const baseItems = content.slice(0, baseCount);
    const baseSlots = max - calibrationItems.length;
    if (baseSlots > 0) {
      return [...baseItems.slice(0, baseSlots), ...calibrationItems];
    }
    // If calibration items alone exceed max, take what fits
    return calibrationItems.slice(0, max);
  }

  return content.slice(0, max);
}

// ─── Daily Summary Base Content ─────────────────────────────────────────────

/**
 * Base "Today's State" content for each phase.
 * Each entry contains the phase name, emotional tendencies, and energy level
 * in exactly 3 sentences using probabilistic language.
 *
 * Validates: Requirement 15.1
 */
const BASE_TODAYS_STATE: Record<CyclePhase, string> = {
  [CyclePhase.MENSTRUAL]:
    "She's currently in her Menstrual Phase. She may tend toward introspection and heightened sensitivity, with energy likely at its lowest. Gentle pacing and quiet comfort may be most appreciated right now.",
  [CyclePhase.FOLLICULAR]:
    "She's currently in her Follicular Phase. She may feel a growing sense of optimism and curiosity, with energy gradually building. This can be a time of renewed motivation and openness to new experiences.",
  [CyclePhase.OVULATION]:
    "She's currently in her Ovulation Phase. She may feel confident, socially energized, and emotionally expressive, with energy likely at its peak. Connection and shared activities may feel especially rewarding right now.",
  [CyclePhase.EARLY_LUTEAL]:
    "She's currently in her Early Luteal Phase. She may lean toward focused productivity and steady emotional energy. This can be a time when structured routines and task completion feel satisfying.",
  [CyclePhase.LATE_LUTEAL]:
    "She's currently in her Late Luteal Phase. She may experience heightened emotional sensitivity and lower energy levels. Extra patience and understanding may go a long way during this time.",
};

/**
 * Base supportive behaviors for each phase (1-3 items).
 * Uses collaborative, suggestion-oriented language.
 *
 * Validates: Requirement 15.2
 */
const BASE_DAILY_BEST_APPROACH: Record<CyclePhase, string[]> = {
  [CyclePhase.MENSTRUAL]: [
    'Consider offering quiet companionship without pressure to engage in conversation.',
    'You might help with practical tasks like preparing a warm drink or handling errands.',
    'Being present and patient, even in silence, can feel deeply supportive.',
  ],
  [CyclePhase.FOLLICULAR]: [
    'You might suggest a new activity or outing she has been curious about.',
    'Consider engaging in collaborative planning or brainstorming together.',
    'Showing enthusiasm for her ideas and energy can strengthen your connection.',
  ],
  [CyclePhase.OVULATION]: [
    'Consider planning a social activity or date that involves connection.',
    'You might match her energy by being more expressive and engaged.',
    'Active listening and deeper conversations may feel especially rewarding now.',
  ],
  [CyclePhase.EARLY_LUTEAL]: [
    'Consider supporting her focus by minimizing unexpected disruptions.',
    'You might help with organizing or completing shared tasks together.',
    'Respecting her need for structure and routine can be appreciated.',
  ],
  [CyclePhase.LATE_LUTEAL]: [
    'Consider offering reassurance and emotional validation without trying to fix things.',
    'You might reduce expectations and allow for a slower pace.',
    'Being gentle with your tone and word choice can make a meaningful difference.',
  ],
};

/**
 * Base behaviors to avoid for each phase (1-3 items).
 * Uses suggestion-oriented language.
 *
 * Validates: Requirement 15.3
 */
const BASE_DAILY_AVOID_THIS: Record<CyclePhase, string[]> = {
  [CyclePhase.MENSTRUAL]: [
    'Try to avoid pushing for high-energy activities or social plans.',
    'It may be best to avoid dismissing her need for rest or quiet time.',
    'Consider avoiding critical or demanding conversations during this time.',
  ],
  [CyclePhase.FOLLICULAR]: [
    'Try to avoid dampening her enthusiasm or dismissing new ideas.',
    'It may be best to avoid being overly cautious when she wants to try something new.',
    'Consider avoiding rigid routines that limit her growing sense of exploration.',
  ],
  [CyclePhase.OVULATION]: [
    'Try to avoid withdrawing or being emotionally unavailable during this time.',
    'It may be best to avoid canceling social plans without good reason.',
    'Consider avoiding being dismissive of her desire for connection and conversation.',
  ],
  [CyclePhase.EARLY_LUTEAL]: [
    'Try to avoid introducing sudden changes to plans or routines.',
    'It may be best to avoid interrupting her focus with non-urgent matters.',
    'Consider avoiding disorganization in shared spaces or responsibilities.',
  ],
  [CyclePhase.LATE_LUTEAL]: [
    'Try to avoid making casual remarks that could be taken personally.',
    'It may be best to avoid bringing up sensitive topics or unresolved conflicts.',
    'Consider avoiding being impatient or rushing her through decisions.',
  ],
};

// ─── Daily Summary Calibration Modifiers ────────────────────────────────────

/**
 * Applies Q4 avoidance trigger calibration to the "Avoid This" section.
 * Prioritizes the user's stated triggers in the avoid list.
 */
function applyDailyAvoidanceTriggerCalibration(
  avoidItems: string[],
  triggers: AvoidanceTrigger[],
  customText: string | null,
  phase: CyclePhase,
): string[] {
  // Skip if no meaningful triggers
  if (triggers.length === 0) return avoidItems;
  if (triggers.length === 1 && triggers[0] === AvoidanceTrigger.NO_CLEAR_TRIGGERS) {
    return avoidItems;
  }

  const isSensitivePhase = phase === CyclePhase.LATE_LUTEAL || phase === CyclePhase.MENSTRUAL;
  if (!isSensitivePhase) return avoidItems;

  const calibratedItems = [...avoidItems];

  // Replace the last item with a trigger-specific one to stay within 1-3 bounds
  if (triggers.includes(AvoidanceTrigger.FEELING_UNHEARD)) {
    calibratedItems[calibratedItems.length - 1] =
      'Try to avoid situations where she might feel unheard or dismissed.';
  } else if (triggers.includes(AvoidanceTrigger.STRESS_WORKLOAD)) {
    calibratedItems[calibratedItems.length - 1] =
      'Try to avoid adding to her workload or stress levels right now.';
  } else if (triggers.includes(AvoidanceTrigger.SOCIAL_OVERSTIMULATION)) {
    calibratedItems[calibratedItems.length - 1] =
      'Try to avoid planning overly social or stimulating activities.';
  } else if (triggers.includes(AvoidanceTrigger.RELATIONSHIP_DYNAMICS)) {
    calibratedItems[calibratedItems.length - 1] =
      'Try to avoid bringing up relationship tensions or communication issues.';
  } else if (triggers.includes(AvoidanceTrigger.OTHER) && customText) {
    calibratedItems[calibratedItems.length - 1] =
      'Try to avoid known personal triggers that may feel amplified during this phase.';
  }

  return calibratedItems;
}

/**
 * Applies Q5 support style calibration to the "Best Approach" section.
 * Aligns recommendations with the user's stated support preferences.
 */
function applyDailySupportStyleCalibration(
  approachItems: string[],
  supportStyle: SupportStyle,
  phase: CyclePhase,
): string[] {
  const isLowEnergyPhase = phase === CyclePhase.MENSTRUAL || phase === CyclePhase.LATE_LUTEAL;
  if (!isLowEnergyPhase) return approachItems;

  const calibratedItems = [...approachItems];

  // Replace the first item with a support-style-specific recommendation
  switch (supportStyle) {
    case SupportStyle.SPACE:
      calibratedItems[0] =
        'Consider giving her space and keeping interactions brief and low-pressure.';
      break;
    case SupportStyle.EMOTIONAL_REASSURANCE:
      calibratedItems[0] =
        'Consider offering warm reassurance and letting her know you understand.';
      break;
    case SupportStyle.PRACTICAL_HELP:
      calibratedItems[0] =
        'Consider taking on practical tasks or routines to lighten her load.';
      break;
    case SupportStyle.DISTRACTION:
      calibratedItems[0] =
        'Consider suggesting a light, fun activity to help shift her mood.';
      break;
    case SupportStyle.VARIABLE:
      // No modification for variable - keep base content
      break;
  }

  return calibratedItems;
}

// ─── GuidanceService ────────────────────────────────────────────────────────

/**
 * GuidanceService generates partner guidance content for the Guidance_Panel
 * and Daily Summaries.
 *
 * Responsibilities:
 * - Generate 3-5 recommended supportive actions per phase
 * - Generate 2-4 triggers to avoid per phase
 * - Generate 2-4 communication strategies per phase
 * - Generate 2-4 discouraged language patterns per phase
 * - Apply survey calibration modifiers for personalization
 * - Use probabilistic/suggestion-oriented language (Requirement 19)
 *
 * All content uses suggestion-oriented framing ("consider", "you might try")
 * rather than directive statements ("you must", "always do").
 *
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4
 */
export class GuidanceService {
  /**
   * Generate base guidance content for a given cycle phase without calibration.
   * Returns content with consistent structure and enforced count bounds.
   *
   * @param phase - The cycle phase to generate guidance for
   * @returns GuidanceContent with all categories populated within bounds
   */
  generateBaseGuidance(phase: CyclePhase): GuidanceContent {
    return {
      phase,
      supportiveActions: enforceBounds([...BASE_SUPPORTIVE_ACTIONS[phase]], 3, 5),
      triggersToAvoid: enforceBounds([...BASE_TRIGGERS_TO_AVOID[phase]], 2, 4),
      communicationStrategies: enforceBounds([...BASE_COMMUNICATION_STRATEGIES[phase]], 2, 4),
      discouragedPatterns: enforceBounds([...BASE_DISCOURAGED_PATTERNS[phase]], 2, 4),
    };
  }

  /**
   * Generate base guidance content for all 5 phases without calibration.
   * Ensures consistent structure across all phases.
   *
   * @returns Array of GuidanceContent for all 5 cycle phases
   */
  generateAllBaseGuidance(): GuidanceContent[] {
    return [
      this.generateBaseGuidance(CyclePhase.MENSTRUAL),
      this.generateBaseGuidance(CyclePhase.FOLLICULAR),
      this.generateBaseGuidance(CyclePhase.OVULATION),
      this.generateBaseGuidance(CyclePhase.EARLY_LUTEAL),
      this.generateBaseGuidance(CyclePhase.LATE_LUTEAL),
    ];
  }

  /**
   * Generate calibrated guidance content by applying survey calibration modifiers.
   *
   * Survey calibration rules:
   * - Q1 → confidence level (variability qualifiers for low confidence)
   * - Q2 → emotional emphasis (extra sensitivity context for heightened)
   * - Q3 → social energy (space/engage recommendations)
   * - Q4 → avoidance triggers (prioritized in triggers-to-avoid)
   * - Q5 → support style (aligned supportive actions)
   * - Q6 → communication approach (strategy additions)
   *
   * @param phase - The cycle phase to generate guidance for
   * @param surveyResponses - The primary user's survey responses
   * @returns CalibratedGuidanceContent with modifiers applied and bounds enforced
   *
   * Validates: Requirements 14.1, 14.2, 14.3, 14.4
   */
  generateCalibratedGuidance(
    phase: CyclePhase,
    surveyResponses: SurveyResponse[],
  ): CalibratedGuidanceContent {
    const baseGuidance = this.generateBaseGuidance(phase);
    const profile = generateCalibrationProfile(surveyResponses);

    if (!profile) {
      return {
        ...baseGuidance,
        calibrationApplied: false,
      };
    }

    // Apply Q1: confidence level modifier to all content
    let supportiveActions = applyConfidenceModifier(
      baseGuidance.supportiveActions,
      profile.confidenceLevel,
    );

    // Apply Q3: social energy modifier to supportive actions
    supportiveActions = applySocialEnergyToActions(
      supportiveActions,
      profile.socialEnergyRecommendation,
      phase,
    );

    // Apply Q5: support style modifier to supportive actions
    supportiveActions = applySupportStyleToActions(supportiveActions, profile.supportStyle, phase);

    // Apply Q2: emotional emphasis modifier to triggers
    let triggersToAvoid = applyEmotionalEmphasisToTriggers(
      baseGuidance.triggersToAvoid,
      profile.emotionalEmphasis,
    );

    // Apply Q4: avoidance triggers to triggers-to-avoid
    triggersToAvoid = applyAvoidanceTriggersToContent(
      triggersToAvoid,
      profile.avoidanceTriggers,
      profile.customTriggerText,
      phase,
    );

    // Apply Q6: communication approach modifier to strategies
    const communicationStrategies = applyCommunicationApproachToStrategies(
      baseGuidance.communicationStrategies,
      profile.communicationApproach,
    );

    // Apply Q1: confidence level modifier to discouraged patterns
    const discouragedPatterns = applyConfidenceModifier(
      baseGuidance.discouragedPatterns,
      profile.confidenceLevel,
    );

    // Enforce count bounds after calibration, preserving calibration additions
    const baseActionsCount = baseGuidance.supportiveActions.length;
    const baseTriggersCount = baseGuidance.triggersToAvoid.length;
    const baseStrategiesCount = baseGuidance.communicationStrategies.length;
    const basePatternsCount = baseGuidance.discouragedPatterns.length;

    return {
      phase,
      supportiveActions: enforceBounds(supportiveActions, 3, 5, baseActionsCount),
      triggersToAvoid: enforceBounds(triggersToAvoid, 2, 4, baseTriggersCount),
      communicationStrategies: enforceBounds(communicationStrategies, 2, 4, baseStrategiesCount),
      discouragedPatterns: enforceBounds(discouragedPatterns, 2, 4, basePatternsCount),
      calibrationApplied: true,
    };
  }

  /**
   * Generate calibrated guidance for all 5 phases.
   *
   * @param surveyResponses - The primary user's survey responses
   * @returns Array of CalibratedGuidanceContent for all 5 cycle phases
   */
  generateAllCalibratedGuidance(surveyResponses: SurveyResponse[]): CalibratedGuidanceContent[] {
    return [
      this.generateCalibratedGuidance(CyclePhase.MENSTRUAL, surveyResponses),
      this.generateCalibratedGuidance(CyclePhase.FOLLICULAR, surveyResponses),
      this.generateCalibratedGuidance(CyclePhase.OVULATION, surveyResponses),
      this.generateCalibratedGuidance(CyclePhase.EARLY_LUTEAL, surveyResponses),
      this.generateCalibratedGuidance(CyclePhase.LATE_LUTEAL, surveyResponses),
    ];
  }

  // ─── Daily Summary Methods ──────────────────────────────────────────────

  /**
   * Generate a Daily Summary for the given cycle phase without calibration.
   * Returns base content with:
   * - todaysState: phase name + emotional tendencies + energy level (max 3 sentences)
   * - bestApproach: 1-3 recommended supportive behaviors
   * - avoidThis: 1-3 behaviors to avoid
   *
   * @param phase - The current cycle phase
   * @returns DailySummaryContent with all sections populated
   *
   * Validates: Requirements 15.1, 15.2, 15.3
   */
  generateDailySummary(phase: CyclePhase): DailySummaryContent {
    return {
      todaysState: BASE_TODAYS_STATE[phase],
      bestApproach: [...BASE_DAILY_BEST_APPROACH[phase]],
      avoidThis: [...BASE_DAILY_AVOID_THIS[phase]],
      phase,
    };
  }

  /**
   * Generate a calibrated Daily Summary by applying survey calibration modifiers.
   *
   * Survey calibration applied:
   * - Q4 (avoidance triggers) → modifies "Avoid This" section for sensitive phases
   * - Q5 (support style) → modifies "Best Approach" section for low-energy phases
   *
   * @param phase - The current cycle phase
   * @param surveyResponses - The primary user's survey responses
   * @returns DailySummaryContent with calibration applied
   *
   * Validates: Requirements 15.1, 15.2, 15.3
   */
  generateCalibratedDailySummary(
    phase: CyclePhase,
    surveyResponses: SurveyResponse[],
  ): DailySummaryContent {
    const baseSummary = this.generateDailySummary(phase);
    const profile = generateCalibrationProfile(surveyResponses);

    if (!profile) {
      return baseSummary;
    }

    return this.applySurveyCalibrationToDailySummary(baseSummary, profile);
  }

  /**
   * Apply a calibration profile to a base daily summary.
   * Useful when the profile has already been computed externally.
   *
   * @param baseSummary - The base daily summary content
   * @param profile - The calibration profile to apply
   * @returns DailySummaryContent with calibration applied
   */
  applySurveyCalibrationToDailySummary(
    baseSummary: DailySummaryContent,
    profile: CalibrationProfile,
  ): DailySummaryContent {
    const phase = baseSummary.phase;

    // Apply Q4: avoidance triggers to "Avoid This"
    const calibratedAvoidThis = applyDailyAvoidanceTriggerCalibration(
      baseSummary.avoidThis,
      profile.avoidanceTriggers,
      profile.customTriggerText,
      phase,
    );

    // Apply Q5: support style to "Best Approach"
    const calibratedBestApproach = applyDailySupportStyleCalibration(
      baseSummary.bestApproach,
      profile.supportStyle,
      phase,
    );

    return {
      todaysState: baseSummary.todaysState,
      bestApproach: calibratedBestApproach,
      avoidThis: calibratedAvoidThis,
      phase,
    };
  }

  // ─── Decision Support Layer ───────────────────────────────────────────────

  /**
   * Generate decision support content for a given cycle phase.
   * Returns behavioral prompts and situational recommendations.
   *
   * - 3-5 behavioral prompts per phase (max 280 chars, max 2 sentences each)
   * - 2-4 situational recommendations per phase
   *
   * @param phase - The cycle phase to generate decision support for
   * @returns DecisionSupport with prompts and recommendations
   *
   * Validates: Requirements 16.1, 16.2, 16.3
   */
  generateDecisionSupport(phase: CyclePhase): DecisionSupport {
    const prompts = [...BASE_BEHAVIORAL_PROMPTS[phase]];
    const recommendations = [...BASE_SITUATIONAL_RECOMMENDATIONS[phase]];

    return {
      phase,
      behavioralPrompts: prompts,
      situationalRecommendations: recommendations,
    };
  }

  /**
   * Generate decision support content for all 5 cycle phases.
   *
   * @returns Array of DecisionSupport for all 5 cycle phases
   */
  generateAllDecisionSupport(): DecisionSupport[] {
    return [
      this.generateDecisionSupport(CyclePhase.MENSTRUAL),
      this.generateDecisionSupport(CyclePhase.FOLLICULAR),
      this.generateDecisionSupport(CyclePhase.OVULATION),
      this.generateDecisionSupport(CyclePhase.EARLY_LUTEAL),
      this.generateDecisionSupport(CyclePhase.LATE_LUTEAL),
    ];
  }

  /**
   * Validate that a behavioral prompt meets the content constraints.
   * - Max 280 characters
   * - Max 2 sentences
   *
   * @param prompt - The behavioral prompt to validate
   * @returns true if the prompt meets all constraints
   */
  validateBehavioralPrompt(prompt: string): boolean {
    if (prompt.length > BEHAVIORAL_PROMPT_MAX_LENGTH) {
      return false;
    }

    const sentenceCount = countSentences(prompt);
    if (sentenceCount > MAX_PROMPT_SENTENCES) {
      return false;
    }

    return true;
  }

  /**
   * Validate that decision support content meets all bounds.
   * - 3-5 behavioral prompts
   * - Each prompt max 280 chars and max 2 sentences
   * - 2-4 situational recommendations
   *
   * @param support - The decision support content to validate
   * @returns true if all constraints are met
   */
  validateDecisionSupport(support: DecisionSupport): boolean {
    const { behavioralPrompts, situationalRecommendations } = support;

    // Check behavioral prompt count bounds
    if (
      behavioralPrompts.length < MIN_BEHAVIORAL_PROMPTS ||
      behavioralPrompts.length > MAX_BEHAVIORAL_PROMPTS
    ) {
      return false;
    }

    // Check each prompt meets character and sentence limits
    for (const prompt of behavioralPrompts) {
      if (!this.validateBehavioralPrompt(prompt)) {
        return false;
      }
    }

    // Check situational recommendation count bounds
    if (
      situationalRecommendations.length < MIN_SITUATIONAL_RECOMMENDATIONS ||
      situationalRecommendations.length > MAX_SITUATIONAL_RECOMMENDATIONS
    ) {
      return false;
    }

    return true;
  }
}

// ─── Utility Functions ──────────────────────────────────────────────────────

/**
 * Count the number of sentences in a text.
 * A sentence is defined as text ending with '.', '!', or '?'.
 *
 * @param text - The text to count sentences in
 * @returns The number of sentences
 */
export function countSentences(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }

  // Match sentence-ending punctuation followed by space or end of string
  const sentences = text.match(/[^.!?]*[.!?]+/g);
  return sentences ? sentences.length : 0;
}
