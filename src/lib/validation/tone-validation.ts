/**
 * Tone and Language Compliance Validation Utility
 *
 * Validates user-facing generated content (phase descriptions, guidance, daily summaries,
 * email notifications) for tone compliance per Requirement 19 and Property 31.
 *
 * Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5, 13.6, 14.5, 14.6
 */

// ─── Deterministic Language Patterns ────────────────────────────────────────

/**
 * Phrases and patterns that constitute deterministic language.
 * These must never appear in user-facing generated content.
 *
 * Includes:
 * - Absolute statements ("she will feel", "she always does", "she never wants")
 * - Certainty markers ("definitely", "certainly", "without doubt")
 * - Universal quantifiers applied to emotions/behavior ("every time", "always", "never")
 */
export const DETERMINISTIC_PATTERNS: RegExp[] = [
  /\bshe will feel\b/i,
  /\bshe always\b/i,
  /\bshe never\b/i,
  /\balways\b/i,
  /\bnever\b/i,
  /\bdefinitely\b/i,
  /\bcertainly\b/i,
  /\bwithout doubt\b/i,
  /\bevery time\b/i,
  /\bwithout exception\b/i,
  /\bguaranteed\b/i,
  /\babsolutely\b/i,
];

// ─── Probabilistic Qualifier Patterns ───────────────────────────────────────

/**
 * Phrases that qualify statements as probabilistic/tendency-based.
 * At least one must appear per emotional/behavioral statement.
 */
export const PROBABILISTIC_QUALIFIERS: RegExp[] = [
  /\bmay\b/i,
  /\bmight\b/i,
  /\bcould\b/i,
  /\btend(?:s)? to\b/i,
  /\boften\b/i,
  /\bsometimes\b/i,
  /\bcommonly\b/i,
  /\btypically\b/i,
  /\bgenerally\b/i,
  /\blikely\b/i,
  /\bpossibly\b/i,
  /\bperhaps\b/i,
  /\bsome women\b/i,
  /\bcommon tendencies\b/i,
  /\bmay experience\b/i,
  /\bmay notice\b/i,
  /\bmay feel\b/i,
  /\bcould be\b/i,
  /\btends to\b/i,
  /\bcan\b/i,
  /\bfrequently\b/i,
  /\boccasionally\b/i,
  /\bpotentially\b/i,
  /\bis often associated with\b/i,
];

// ─── Directive Framing Patterns ─────────────────────────────────────────────

/**
 * Directive/instructional framing that should NOT appear in content.
 * Content should use collaborative framing instead.
 */
export const DIRECTIVE_PATTERNS: RegExp[] = [
  /\byou must\b/i,
  /\byou need to\b/i,
  /\byou have to\b/i,
  /\byou should\b/i,
  /\bdo this\b/i,
  /\balways do\b/i,
  /\bnever do\b/i,
  /\byou are required\b/i,
];

// ─── Collaborative Framing Patterns ────────────────────────────────────────

/**
 * Collaborative/suggestion-oriented framing patterns.
 * Content should use these instead of directive framing.
 */
export const COLLABORATIVE_PATTERNS: RegExp[] = [
  /\byou might\b/i,
  /\bconsider\b/i,
  /\byou could\b/i,
  /\bthis could be a good time\b/i,
  /\byou may want to\b/i,
  /\bit might help\b/i,
  /\btry\b/i,
  /\bperhaps\b/i,
  /\bthink about\b/i,
  /\bone option is\b/i,
  /\bit can help\b/i,
  /\byou may find\b/i,
];

// ─── Individual Variation Acknowledgment Patterns ───────────────────────────

/**
 * Phrases that acknowledge individual variation.
 * At least one must appear per phase description.
 */
export const INDIVIDUAL_VARIATION_PATTERNS: RegExp[] = [
  /\bevery(?:one| person| woman| individual) is different\b/i,
  /\byour partner'?s experience may vary\b/i,
  /\bindividual(?:ly)?\b/i,
  /\bvaries? (?:from|between|for)\b/i,
  /\bunique\b/i,
  /\bpersonal(?:ly)?\b/i,
  /\bher own\b/i,
  /\bnot everyone\b/i,
  /\bexperiences? (?:may |can |will )?differ\b/i,
  /\bmay vary\b/i,
  /\bspecific to (?:her|each|your)\b/i,
  /\bnot all women\b/i,
  /\beach person\b/i,
  /\beach woman\b/i,
];

// ─── Validation Result Types ────────────────────────────────────────────────

export interface ToneViolation {
  /** Type of violation */
  type:
    | 'deterministic_language'
    | 'missing_probabilistic_qualifier'
    | 'directive_framing'
    | 'missing_variation_acknowledgment';
  /** Human-readable description of the violation */
  message: string;
  /** The offending text or context (if applicable) */
  offendingText?: string;
}

export interface ToneValidationResult {
  /** Whether the content passes all tone compliance checks */
  valid: boolean;
  /** List of violations found (empty if valid) */
  violations: ToneViolation[];
}

// ─── Core Validation Functions ──────────────────────────────────────────────

/**
 * Checks content for deterministic language.
 * Returns any deterministic patterns found.
 *
 * Validates: Requirement 19.1
 */
export function checkDeterministicLanguage(content: string): ToneViolation[] {
  const violations: ToneViolation[] = [];

  for (const pattern of DETERMINISTIC_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      violations.push({
        type: 'deterministic_language',
        message: `Content contains deterministic language: "${match[0]}"`,
        offendingText: match[0],
      });
    }
  }

  return violations;
}

/**
 * Checks that each emotional/behavioral statement contains at least one
 * probabilistic qualifier.
 *
 * A "statement" is defined as a sentence (split by period, exclamation, or question mark)
 * that references emotional states or behavioral patterns.
 *
 * Sentences that serve as individual variation acknowledgments are excluded from this check,
 * as they serve a different purpose (acknowledging that patterns vary per person).
 *
 * Validates: Requirement 19.2
 */
export function checkProbabilisticQualifiers(content: string): ToneViolation[] {
  const violations: ToneViolation[] = [];
  const sentences = splitIntoSentences(content);

  for (const sentence of sentences) {
    if (isEmotionalOrBehavioralStatement(sentence) && !isVariationAcknowledgment(sentence)) {
      const hasQualifier = PROBABILISTIC_QUALIFIERS.some((pattern) => pattern.test(sentence));
      if (!hasQualifier) {
        violations.push({
          type: 'missing_probabilistic_qualifier',
          message: `Emotional/behavioral statement lacks a probabilistic qualifier: "${truncate(sentence, 80)}"`,
          offendingText: sentence.trim(),
        });
      }
    }
  }

  return violations;
}

/**
 * Checks that content uses collaborative framing rather than directive framing.
 * Detects directive patterns ("you must", "you need to") and verifies
 * collaborative alternatives are used instead.
 *
 * Validates: Requirements 19.4, 14.5, 14.6
 */
export function checkCollaborativeFraming(content: string): ToneViolation[] {
  const violations: ToneViolation[] = [];

  for (const pattern of DIRECTIVE_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      violations.push({
        type: 'directive_framing',
        message: `Content uses directive framing: "${match[0]}". Use collaborative framing instead (e.g., "you might", "consider").`,
        offendingText: match[0],
      });
    }
  }

  return violations;
}

/**
 * Checks that content includes at least one individual variation acknowledgment.
 * This is required per phase description.
 *
 * Validates: Requirement 19.5
 */
export function checkIndividualVariationAcknowledgment(content: string): ToneViolation[] {
  const hasAcknowledgment = INDIVIDUAL_VARIATION_PATTERNS.some((pattern) => pattern.test(content));

  if (!hasAcknowledgment) {
    return [
      {
        type: 'missing_variation_acknowledgment',
        message:
          'Content lacks an individual variation acknowledgment (e.g., "every person is different", "your partner\'s experience may vary").',
      },
    ];
  }

  return [];
}

// ─── Composite Validation Functions ─────────────────────────────────────────

/**
 * Validates a single content string for full tone compliance.
 * Checks all four tone requirements:
 * (a) No deterministic language
 * (b) Probabilistic qualifiers on emotional/behavioral statements
 * (c) Collaborative (not directive) framing
 * (d) Individual variation acknowledgment
 *
 * Validates: Property 31 (a, b, c, d)
 */
export function validateToneCompliance(content: string): ToneValidationResult {
  const violations: ToneViolation[] = [
    ...checkDeterministicLanguage(content),
    ...checkProbabilisticQualifiers(content),
    ...checkCollaborativeFraming(content),
    ...checkIndividualVariationAcknowledgment(content),
  ];

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Validates a phase description for tone compliance.
 * Same as validateToneCompliance but explicitly named for phase descriptions
 * where individual variation acknowledgment is mandatory.
 *
 * Validates: Requirements 13.6, 19.5
 */
export function validatePhaseDescriptionTone(content: string): ToneValidationResult {
  return validateToneCompliance(content);
}

/**
 * Validates guidance content for tone compliance.
 * Focuses on collaborative framing and probabilistic qualifiers.
 *
 * Validates: Requirements 14.5, 14.6, 19.4
 */
export function validateGuidanceTone(content: string): ToneValidationResult {
  const violations: ToneViolation[] = [
    ...checkDeterministicLanguage(content),
    ...checkProbabilisticQualifiers(content),
    ...checkCollaborativeFraming(content),
  ];

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Validates an array of content strings (e.g., list of guidance items).
 * Each item is checked individually for deterministic language and directive framing.
 * The combined content is checked for probabilistic qualifiers.
 */
export function validateContentList(items: string[]): ToneValidationResult {
  const allViolations: ToneViolation[] = [];

  for (const item of items) {
    allViolations.push(...checkDeterministicLanguage(item));
    allViolations.push(...checkCollaborativeFraming(item));
    allViolations.push(...checkProbabilisticQualifiers(item));
  }

  return {
    valid: allViolations.length === 0,
    violations: allViolations,
  };
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Splits content into individual sentences.
 * Handles common sentence-ending punctuation.
 */
export function splitIntoSentences(content: string): string[] {
  return content
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Determines if a sentence serves as an individual variation acknowledgment.
 * These sentences are excluded from the probabilistic qualifier check since
 * they serve a different purpose (acknowledging that patterns vary per person).
 */
export function isVariationAcknowledgment(sentence: string): boolean {
  return INDIVIDUAL_VARIATION_PATTERNS.some((pattern) => pattern.test(sentence));
}

/**
 * Determines if a sentence is about emotional states or behavioral patterns.
 * Used to identify statements that require probabilistic qualifiers.
 */
export function isEmotionalOrBehavioralStatement(sentence: string): boolean {
  const emotionalBehavioralIndicators: RegExp[] = [
    /\bfeel(?:s|ing)?\b/i,
    /\bemotion(?:s|al|ally)?\b/i,
    /\bmood(?:s|y)?\b/i,
    /\benergy\b/i,
    /\bbehav(?:e|es|ior|iour|ioral|ioural)\b/i,
    /\btendenc(?:y|ies)\b/i,
    /\bsensitiv(?:e|ity)\b/i,
    /\banxi(?:ous|ety)\b/i,
    /\birritab(?:le|ility)\b/i,
    /\bwithdr(?:aw|awal|awn)\b/i,
    /\bsocial\b/i,
    /\bcommunicat(?:e|ion|ing)\b/i,
    /\bconfiden(?:t|ce)\b/i,
    /\bintrospec(?:t|tive|tion)\b/i,
    /\bvulnerab(?:le|ility)\b/i,
    /\bcognitiv(?:e|ely)\b/i,
    /\bfocus(?:ed)?\b/i,
    /\bproductiv(?:e|ity)\b/i,
    /\bcreativ(?:e|ity)\b/i,
    /\bpattern(?:s)?\b/i,
    /\breact(?:s|ion|ive|ivity)?\b/i,
    /\bstress(?:ed|ful)?\b/i,
  ];

  return emotionalBehavioralIndicators.some((pattern) => pattern.test(sentence));
}

/**
 * Truncates a string to a maximum length, appending "..." if truncated.
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
