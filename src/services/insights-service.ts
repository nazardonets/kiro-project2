import { CyclePhase, SurveyResponse } from '@/lib/types';
import {
  ConfidenceLevel,
  EmotionalEmphasis,
  SocialEnergyRecommendation,
  SupportStyle,
  CommunicationApproach,
  generateCalibrationProfile,
} from '@/services/survey-calibration-engine';

// ─── Insights Content Types ─────────────────────────────────────────────────

/** Energy level scale */
export type EnergyLevel = 'Low' | 'Moderate' | 'High';

/** Energy level indicator with descriptive summary */
export interface EnergyIndicator {
  level: EnergyLevel;
  summary: string;
}

/** Phase insights content structure */
export interface PhaseInsights {
  phase: CyclePhase;
  emotionalTendencies: string[];
  cognitiveTendencies: string[];
  behavioralTendencies: string[];
  energyLevel: EnergyIndicator;
  communicationTendencies: string[];
}

/** Calibrated phase insights (after survey modifiers are applied) */
export interface CalibratedPhaseInsights extends PhaseInsights {
  calibrationApplied: boolean;
}

// ─── Base Phase Content ─────────────────────────────────────────────────────

/**
 * Base emotional tendencies for each phase.
 * Uses probabilistic framing ("may experience", "common tendencies include").
 */
const BASE_EMOTIONAL_TENDENCIES: Record<CyclePhase, string[]> = {
  [CyclePhase.MENSTRUAL]: [
    'She may experience a desire for quiet reflection and emotional withdrawal.',
    'Common tendencies include heightened sensitivity and a need for comfort.',
    'She might feel more introspective and emotionally vulnerable during this time.',
    'Some women notice a sense of release or emotional reset at the start of their cycle.',
  ],
  [CyclePhase.FOLLICULAR]: [
    'She may feel a renewed sense of optimism and emotional lightness.',
    'Common tendencies include increased curiosity and openness to new experiences.',
    'She might notice growing confidence and emotional resilience.',
    'Many women experience a gradual lift in mood and motivation during this phase.',
  ],
  [CyclePhase.OVULATION]: [
    'She may experience heightened confidence and emotional expressiveness.',
    'Common tendencies include feeling more socially connected and outgoing.',
    'She might feel more emotionally generous and empathetic toward others.',
    'Many women notice peak emotional warmth and desire for connection.',
  ],
  [CyclePhase.EARLY_LUTEAL]: [
    'She may experience a shift toward focused, task-oriented emotional energy.',
    'Common tendencies include a desire for productivity and accomplishment.',
    'She might feel more emotionally steady but less socially driven.',
    'Some women notice a preference for structured routines during this phase.',
  ],
  [CyclePhase.LATE_LUTEAL]: [
    'She may experience heightened emotional sensitivity and intensity.',
    'Common tendencies include feeling more easily overwhelmed or frustrated.',
    'She might notice increased emotional reactivity to everyday situations.',
    'Many women experience a need for extra patience and understanding during this time.',
  ],
};

/**
 * Base cognitive tendencies for each phase.
 */
const BASE_COGNITIVE_TENDENCIES: Record<CyclePhase, string[]> = {
  [CyclePhase.MENSTRUAL]: [
    'Thought patterns may lean toward introspection and self-evaluation.',
    'She might find it harder to concentrate on complex tasks and prefer simpler activities.',
    'Some women notice a tendency toward reflective or philosophical thinking.',
  ],
  [CyclePhase.FOLLICULAR]: [
    'Thought patterns may become more creative and solution-oriented.',
    'She might find it easier to learn new things and absorb information.',
    'Many women notice sharper mental clarity and improved focus during this phase.',
  ],
  [CyclePhase.OVULATION]: [
    'Thought patterns may be more outward-focused and communicative.',
    'She might find verbal expression comes more naturally and fluidly.',
    'Some women notice enhanced social awareness and quick thinking.',
  ],
  [CyclePhase.EARLY_LUTEAL]: [
    'Thought patterns may become more detail-oriented and analytical.',
    'She might prefer structured planning and completing existing projects.',
    'Many women notice a shift toward practical, methodical thinking.',
  ],
  [CyclePhase.LATE_LUTEAL]: [
    'Thought patterns may become more ruminative or self-critical.',
    'She might find it harder to let go of worries or perceived slights.',
    'Some women notice difficulty with decision-making or mental fog.',
  ],
};

/**
 * Base behavioral tendencies for each phase.
 */
const BASE_BEHAVIORAL_TENDENCIES: Record<CyclePhase, string[]> = {
  [CyclePhase.MENSTRUAL]: [
    'She may prefer staying home and engaging in low-key activities.',
    'Common behaviors include seeking physical comfort like warm drinks or soft blankets.',
    'She might gravitate toward familiar routines rather than new experiences.',
  ],
  [CyclePhase.FOLLICULAR]: [
    'She may be more inclined to try new activities or explore new places.',
    'Common behaviors include increased social engagement and planning ahead.',
    'She might show more initiative in starting projects or making plans.',
  ],
  [CyclePhase.OVULATION]: [
    'She may seek out social gatherings and enjoy being around others.',
    'Common behaviors include increased physical activity and expressiveness.',
    'She might be more spontaneous and open to last-minute plans.',
  ],
  [CyclePhase.EARLY_LUTEAL]: [
    'She may focus on completing tasks and organizing her environment.',
    'Common behaviors include nesting activities and attention to detail.',
    'She might prefer planned activities over spontaneous ones.',
  ],
  [CyclePhase.LATE_LUTEAL]: [
    'She may withdraw from social situations and prefer solitude.',
    'Common behaviors include comfort-seeking and reduced tolerance for disruption.',
    'She might be less patient with unexpected changes to plans.',
  ],
};

/**
 * Base energy level indicators for each phase.
 */
const BASE_ENERGY_LEVELS: Record<CyclePhase, EnergyIndicator> = {
  [CyclePhase.MENSTRUAL]: {
    level: 'Low',
    summary:
      'Energy tends to be at its lowest during this phase. She may need more rest and gentler pacing throughout the day.',
  },
  [CyclePhase.FOLLICULAR]: {
    level: 'Moderate',
    summary:
      'Energy typically builds gradually during this phase. She may feel increasingly capable and motivated as the days progress.',
  },
  [CyclePhase.OVULATION]: {
    level: 'High',
    summary:
      'Energy often peaks around ovulation. She may feel vibrant, social, and ready for activity.',
  },
  [CyclePhase.EARLY_LUTEAL]: {
    level: 'Moderate',
    summary:
      'Energy may remain steady but shift toward focused productivity. She might prefer channeling energy into specific tasks.',
  },
  [CyclePhase.LATE_LUTEAL]: {
    level: 'Low',
    summary:
      'Energy often dips during this phase. She may tire more easily and benefit from a slower pace.',
  },
};

/**
 * Base communication tendencies for each phase.
 */
const BASE_COMMUNICATION_TENDENCIES: Record<CyclePhase, string[]> = {
  [CyclePhase.MENSTRUAL]: [
    'She may prefer shorter, gentler conversations without pressure to engage deeply.',
    'Communication style might lean toward quiet presence rather than active discussion.',
    'She may appreciate check-ins that are brief and low-demand.',
  ],
  [CyclePhase.FOLLICULAR]: [
    'She may be more open to longer conversations and sharing ideas.',
    'Communication style might become more enthusiastic and future-oriented.',
    'She may enjoy brainstorming and collaborative discussions.',
  ],
  [CyclePhase.OVULATION]: [
    'She may communicate more openly and expressively than usual.',
    'Communication style might be warm, engaging, and emotionally generous.',
    'She may enjoy deeper conversations and feel more connected through dialogue.',
  ],
  [CyclePhase.EARLY_LUTEAL]: [
    'She may prefer clear, direct communication without ambiguity.',
    'Communication style might be more task-focused and practical.',
    'She may appreciate conversations that have a clear purpose or outcome.',
  ],
  [CyclePhase.LATE_LUTEAL]: [
    'She may be more sensitive to tone and word choice in conversations.',
    'Communication style might require extra gentleness and patience.',
    'She may need more reassurance and feel hurt more easily by casual remarks.',
  ],
};

// ─── Calibration Modifiers ──────────────────────────────────────────────────

/**
 * Applies confidence level modifier to content.
 * High confidence: uses more direct phase-based language.
 * Low confidence: adds variability qualifiers.
 */
function applyConfidenceModifier(content: string[], confidenceLevel: ConfidenceLevel): string[] {
  if (confidenceLevel === 'high') {
    return content;
  }

  if (confidenceLevel === 'low') {
    return content.map((item) => {
      if (!item.includes('every person is different') && !item.includes('may vary')) {
        return item.replace(/\.$/, ', though every person is different.');
      }
      return item;
    });
  }

  // moderate - no changes
  return content;
}

/**
 * Applies emotional emphasis modifier.
 * Reduced: filters to fewer emotional tendencies.
 * Heightened/Very heightened: adds emphasis context.
 */
function applyEmotionalEmphasisModifier(
  tendencies: string[],
  emphasis: EmotionalEmphasis,
): string[] {
  if (emphasis === 'reduced') {
    // Return minimum required (3 items) with softened language
    return tendencies.slice(0, 3).map((t) => t.replace('heightened', 'subtle'));
  }

  if (emphasis === 'very_heightened') {
    // Add additional context about emotional intensity
    return [
      ...tendencies,
      'Emotional shifts may be particularly noticeable and impactful during this phase.',
    ];
  }

  if (emphasis === 'heightened') {
    return [...tendencies, 'Emotional awareness may be especially important during this phase.'];
  }

  // moderate/standard - no changes
  return tendencies;
}

/**
 * Applies social energy modifier to behavioral tendencies.
 */
function applySocialEnergyModifier(
  tendencies: string[],
  socialEnergy: SocialEnergyRecommendation,
  phase: CyclePhase,
): string[] {
  const isHighEnergyPhase = phase === CyclePhase.OVULATION || phase === CyclePhase.FOLLICULAR;
  const isLowEnergyPhase = phase === CyclePhase.MENSTRUAL || phase === CyclePhase.LATE_LUTEAL;

  if (socialEnergy === 'give_space' && isLowEnergyPhase) {
    return [
      ...tendencies,
      'She may particularly value alone time and personal space during this phase.',
    ];
  }

  if (socialEnergy === 'engage_more' && isHighEnergyPhase) {
    return [
      ...tendencies,
      'She may especially enjoy social connection and shared activities during this phase.',
    ];
  }

  return tendencies;
}

/**
 * Applies communication approach modifier.
 */
function applyCommunicationModifier(
  tendencies: string[],
  approach: CommunicationApproach,
): string[] {
  switch (approach) {
    case 'gentle_checkin':
      return [
        ...tendencies,
        'Consider gentle, brief check-ins rather than initiating deep conversations.',
      ];
    case 'direct_ask':
      return [
        ...tendencies,
        'She may appreciate direct questions about what she needs rather than guessing.',
      ];
    case 'give_space':
      return [
        ...tendencies,
        'She may prefer to initiate conversations herself when she feels ready.',
      ];
    case 'present_low_pressure':
      return [
        ...tendencies,
        'Being emotionally present without pressure to talk may be most appreciated.',
      ];
    default:
      return tendencies;
  }
}

// ─── InsightsService ────────────────────────────────────────────────────────

/**
 * InsightsService generates phase-based insights content and applies survey calibration.
 *
 * Responsibilities:
 * - Generate emotional tendencies (at least 3 per phase)
 * - Generate cognitive tendencies (at least 2 per phase)
 * - Generate behavioral tendencies (at least 2 per phase)
 * - Generate energy level indicator with descriptive summary
 * - Generate communication tendencies (at least 2 per phase)
 * - Ensure consistent structure across all 5 phases
 * - Apply survey calibration modifiers
 *
 * All content uses probabilistic framing ("may experience", "common tendencies include")
 * rather than deterministic statements.
 *
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.7, 13.8
 */
export class InsightsService {
  /**
   * Generate phase-based insights for a given cycle phase without calibration.
   * Returns base content with consistent structure.
   *
   * @param phase - The cycle phase to generate insights for
   * @returns PhaseInsights with all content categories populated
   */
  generateBaseInsights(phase: CyclePhase): PhaseInsights {
    return {
      phase,
      emotionalTendencies: [...BASE_EMOTIONAL_TENDENCIES[phase]],
      cognitiveTendencies: [...BASE_COGNITIVE_TENDENCIES[phase]],
      behavioralTendencies: [...BASE_BEHAVIORAL_TENDENCIES[phase]],
      energyLevel: { ...BASE_ENERGY_LEVELS[phase] },
      communicationTendencies: [...BASE_COMMUNICATION_TENDENCIES[phase]],
    };
  }

  /**
   * Generate phase-based insights for all 5 phases without calibration.
   * Ensures consistent structure across all phases.
   *
   * @returns Array of PhaseInsights for all 5 cycle phases
   */
  generateAllBaseInsights(): PhaseInsights[] {
    return [
      this.generateBaseInsights(CyclePhase.MENSTRUAL),
      this.generateBaseInsights(CyclePhase.FOLLICULAR),
      this.generateBaseInsights(CyclePhase.OVULATION),
      this.generateBaseInsights(CyclePhase.EARLY_LUTEAL),
      this.generateBaseInsights(CyclePhase.LATE_LUTEAL),
    ];
  }

  /**
   * Generate calibrated phase insights by applying survey calibration modifiers.
   *
   * Survey calibration rules:
   * - Q1 → confidence level (high/low confidence framing)
   * - Q2 → emotional emphasis (reduced/heightened)
   * - Q3 → social energy recommendations (give space/engage more)
   * - Q4 → avoidance triggers (prioritize in content)
   * - Q5 → support style (align suggestions)
   * - Q6 → communication approach (check-in frequency, conversation depth)
   *
   * @param phase - The cycle phase to generate insights for
   * @param surveyResponses - The primary user's survey responses
   * @returns CalibratedPhaseInsights with modifiers applied
   *
   * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.7, 13.8
   */
  generateCalibratedInsights(
    phase: CyclePhase,
    surveyResponses: SurveyResponse[],
  ): CalibratedPhaseInsights {
    const baseInsights = this.generateBaseInsights(phase);
    const profile = generateCalibrationProfile(surveyResponses);

    if (!profile) {
      return {
        ...baseInsights,
        calibrationApplied: false,
      };
    }

    // Apply Q1: confidence level modifier
    let emotionalTendencies = applyConfidenceModifier(
      baseInsights.emotionalTendencies,
      profile.confidenceLevel,
    );
    const cognitiveTendencies = applyConfidenceModifier(
      baseInsights.cognitiveTendencies,
      profile.confidenceLevel,
    );

    // Apply Q2: emotional emphasis modifier
    emotionalTendencies = applyEmotionalEmphasisModifier(
      emotionalTendencies,
      profile.emotionalEmphasis,
    );

    // Apply Q3: social energy modifier to behavioral tendencies
    let behavioralTendencies = applySocialEnergyModifier(
      baseInsights.behavioralTendencies,
      profile.socialEnergyRecommendation,
      phase,
    );

    // Apply Q4: avoidance triggers - add relevant behavioral context
    behavioralTendencies = this.applyAvoidanceTriggers(
      behavioralTendencies,
      profile.avoidanceTriggers,
      profile.customTriggerText,
      phase,
    );

    // Apply Q5: support style - adjust behavioral tendencies
    behavioralTendencies = this.applySupportStyleModifier(
      behavioralTendencies,
      profile.supportStyle,
      phase,
    );

    // Apply Q6: communication approach modifier
    const communicationTendencies = applyCommunicationModifier(
      baseInsights.communicationTendencies,
      profile.communicationApproach,
    );

    return {
      phase,
      emotionalTendencies,
      cognitiveTendencies,
      behavioralTendencies,
      energyLevel: baseInsights.energyLevel,
      communicationTendencies,
      calibrationApplied: true,
    };
  }

  /**
   * Generate calibrated insights for all 5 phases.
   *
   * @param surveyResponses - The primary user's survey responses
   * @returns Array of CalibratedPhaseInsights for all 5 cycle phases
   */
  generateAllCalibratedInsights(surveyResponses: SurveyResponse[]): CalibratedPhaseInsights[] {
    return [
      this.generateCalibratedInsights(CyclePhase.MENSTRUAL, surveyResponses),
      this.generateCalibratedInsights(CyclePhase.FOLLICULAR, surveyResponses),
      this.generateCalibratedInsights(CyclePhase.OVULATION, surveyResponses),
      this.generateCalibratedInsights(CyclePhase.EARLY_LUTEAL, surveyResponses),
      this.generateCalibratedInsights(CyclePhase.LATE_LUTEAL, surveyResponses),
    ];
  }

  /**
   * Apply avoidance triggers from Q4 to behavioral tendencies.
   * Prioritizes selected triggers in content for sensitive phases.
   */
  private applyAvoidanceTriggers(
    tendencies: string[],
    triggers: string[],
    customText: string | null,
    phase: CyclePhase,
  ): string[] {
    const isSensitivePhase = phase === CyclePhase.LATE_LUTEAL || phase === CyclePhase.MENSTRUAL;

    if (!isSensitivePhase || triggers.length === 0) {
      return tendencies;
    }

    // Skip if only "no_clear_triggers" is present
    if (triggers.length === 1 && triggers[0] === 'no_clear_triggers') {
      return tendencies;
    }

    const triggerContext: string[] = [];

    if (triggers.includes('feeling_unheard')) {
      triggerContext.push(
        'She may be particularly sensitive to feeling unheard or dismissed during this phase.',
      );
    }
    if (triggers.includes('stress_workload')) {
      triggerContext.push('Stress and workload pressures may feel more overwhelming than usual.');
    }
    if (triggers.includes('social_overstimulation')) {
      triggerContext.push(
        'Social situations and overstimulation may be especially draining right now.',
      );
    }
    if (triggers.includes('relationship_dynamics')) {
      triggerContext.push(
        'She may be more sensitive to relationship dynamics and communication tone.',
      );
    }
    if (triggers.includes('other') && customText) {
      triggerContext.push(
        `She may be particularly affected by personal triggers during this phase.`,
      );
    }

    return [...tendencies, ...triggerContext];
  }

  /**
   * Apply support style from Q5 to behavioral tendencies.
   * Aligns suggestions with the primary user's stated support preferences.
   */
  private applySupportStyleModifier(
    tendencies: string[],
    supportStyle: SupportStyle,
    phase: CyclePhase,
  ): string[] {
    const isLowEnergyPhase = phase === CyclePhase.MENSTRUAL || phase === CyclePhase.LATE_LUTEAL;

    if (!isLowEnergyPhase) {
      return tendencies;
    }

    switch (supportStyle) {
      case 'space':
        return [
          ...tendencies,
          'She may appreciate having space and minimal interaction when feeling low.',
        ];
      case 'emotional_reassurance':
        return [
          ...tendencies,
          'She may respond well to emotional reassurance and empathetic presence.',
        ];
      case 'practical_help':
        return [
          ...tendencies,
          'Practical help with tasks and routines may be especially appreciated.',
        ];
      case 'distraction':
        return [...tendencies, 'Light, fun distractions may help lift her mood during this phase.'];
      default:
        return tendencies;
    }
  }
}
