import { describe, it, expect } from 'vitest';

import {
  checkDeterministicLanguage,
  checkProbabilisticQualifiers,
  checkCollaborativeFraming,
  checkIndividualVariationAcknowledgment,
  validateToneCompliance,
  validatePhaseDescriptionTone,
  validateGuidanceTone,
  validateContentList,
  splitIntoSentences,
  isEmotionalOrBehavioralStatement,
} from './tone-validation';

describe('Tone Validation Utility', () => {
  // ─── checkDeterministicLanguage ─────────────────────────────────────────

  describe('checkDeterministicLanguage', () => {
    it('should detect "she will feel" as deterministic language', () => {
      const violations = checkDeterministicLanguage('She will feel tired during this phase.');
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].type).toBe('deterministic_language');
    });

    it('should detect "always" as deterministic language', () => {
      const violations = checkDeterministicLanguage(
        'She always experiences mood swings during this phase.',
      );
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.offendingText?.toLowerCase() === 'always')).toBe(true);
    });

    it('should detect "never" as deterministic language', () => {
      const violations = checkDeterministicLanguage('She never wants to go out during this time.');
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.offendingText?.toLowerCase() === 'never')).toBe(true);
    });

    it('should detect "definitely" as deterministic language', () => {
      const violations = checkDeterministicLanguage(
        'She will definitely be more emotional this week.',
      );
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.offendingText?.toLowerCase() === 'definitely')).toBe(true);
    });

    it('should detect "certainly" as deterministic language', () => {
      const violations = checkDeterministicLanguage(
        'She certainly needs more rest during menstruation.',
      );
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.offendingText?.toLowerCase() === 'certainly')).toBe(true);
    });

    it('should detect "every time" as deterministic language', () => {
      const violations = checkDeterministicLanguage(
        'Every time this phase occurs, she gets irritable.',
      );
      expect(violations.length).toBeGreaterThan(0);
    });

    it('should return no violations for compliant content', () => {
      const violations = checkDeterministicLanguage(
        'She may experience heightened sensitivity during this phase.',
      );
      expect(violations).toHaveLength(0);
    });

    it('should return no violations for probabilistic content', () => {
      const violations = checkDeterministicLanguage(
        'Common tendencies include a desire for quiet reflection.',
      );
      expect(violations).toHaveLength(0);
    });
  });

  // ─── checkProbabilisticQualifiers ───────────────────────────────────────

  describe('checkProbabilisticQualifiers', () => {
    it('should pass when emotional statement has a probabilistic qualifier', () => {
      const violations = checkProbabilisticQualifiers(
        'She may feel more introspective during this phase.',
      );
      expect(violations).toHaveLength(0);
    });

    it('should pass when behavioral statement uses "tends to"', () => {
      const violations = checkProbabilisticQualifiers(
        'She tends to withdraw socially during this time.',
      );
      expect(violations).toHaveLength(0);
    });

    it('should flag emotional statement without qualifier', () => {
      const violations = checkProbabilisticQualifiers(
        'She feels tired and withdrawn during this phase.',
      );
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].type).toBe('missing_probabilistic_qualifier');
    });

    it('should pass non-emotional statements without qualifiers', () => {
      const violations = checkProbabilisticQualifiers(
        'The follicular phase lasts approximately 8 days.',
      );
      expect(violations).toHaveLength(0);
    });

    it('should handle multiple sentences independently', () => {
      const content =
        'She may feel more energetic. She experiences mood swings. She might notice increased creativity.';
      const violations = checkProbabilisticQualifiers(content);
      // Second sentence lacks a qualifier
      expect(violations.length).toBe(1);
      expect(violations[0].offendingText).toContain('experiences mood swings');
    });
  });

  // ─── checkCollaborativeFraming ──────────────────────────────────────────

  describe('checkCollaborativeFraming', () => {
    it('should detect "you must" as directive framing', () => {
      const violations = checkCollaborativeFraming('You must give her space during this time.');
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].type).toBe('directive_framing');
    });

    it('should detect "you need to" as directive framing', () => {
      const violations = checkCollaborativeFraming(
        'You need to be more patient during this phase.',
      );
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].type).toBe('directive_framing');
    });

    it('should detect "you have to" as directive framing', () => {
      const violations = checkCollaborativeFraming(
        'You have to avoid bringing up stressful topics.',
      );
      expect(violations.length).toBeGreaterThan(0);
    });

    it('should pass collaborative framing with "you might"', () => {
      const violations = checkCollaborativeFraming(
        'You might notice she prefers quieter evenings.',
      );
      expect(violations).toHaveLength(0);
    });

    it('should pass collaborative framing with "consider"', () => {
      const violations = checkCollaborativeFraming(
        'Consider offering a warm drink or a quiet evening together.',
      );
      expect(violations).toHaveLength(0);
    });

    it('should pass collaborative framing with "you could"', () => {
      const violations = checkCollaborativeFraming(
        'You could try planning a low-key activity together.',
      );
      expect(violations).toHaveLength(0);
    });
  });

  // ─── checkIndividualVariationAcknowledgment ─────────────────────────────

  describe('checkIndividualVariationAcknowledgment', () => {
    it('should pass when content acknowledges individual variation', () => {
      const violations = checkIndividualVariationAcknowledgment(
        'During the menstrual phase, she may feel withdrawn. Every person is different, so observe her specific patterns.',
      );
      expect(violations).toHaveLength(0);
    });

    it('should pass with "your partner\'s experience may vary"', () => {
      const violations = checkIndividualVariationAcknowledgment(
        "Energy levels tend to drop. Your partner's experience may vary based on individual factors.",
      );
      expect(violations).toHaveLength(0);
    });

    it('should pass with "individual" acknowledgment', () => {
      const violations = checkIndividualVariationAcknowledgment(
        'These are general tendencies and individual experiences differ.',
      );
      expect(violations).toHaveLength(0);
    });

    it('should flag content without any variation acknowledgment', () => {
      const violations = checkIndividualVariationAcknowledgment(
        'During this phase, she may feel tired and withdrawn. Energy levels tend to be low.',
      );
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('missing_variation_acknowledgment');
    });
  });

  // ─── validateToneCompliance (composite) ─────────────────────────────────

  describe('validateToneCompliance', () => {
    it('should pass fully compliant content', () => {
      const content =
        'She may experience heightened sensitivity during this phase. You might consider offering extra support. Every person is different, so observe her unique patterns.';
      const result = validateToneCompliance(content);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail content with deterministic language', () => {
      const content =
        'She will definitely feel tired. Every person is different. You might try being supportive.';
      const result = validateToneCompliance(content);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.type === 'deterministic_language')).toBe(true);
    });

    it('should fail content with directive framing', () => {
      const content = 'She may feel tired. You must give her space. Every person is different.';
      const result = validateToneCompliance(content);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.type === 'directive_framing')).toBe(true);
    });

    it('should fail content missing variation acknowledgment', () => {
      const content =
        'She may experience heightened sensitivity. You might consider offering extra support.';
      const result = validateToneCompliance(content);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.type === 'missing_variation_acknowledgment')).toBe(
        true,
      );
    });
  });

  // ─── validatePhaseDescriptionTone ───────────────────────────────────────

  describe('validatePhaseDescriptionTone', () => {
    it('should validate phase descriptions with all requirements', () => {
      const content =
        'During the follicular phase, she may feel a renewed sense of energy. Common tendencies include increased curiosity and openness. Each person is different, so these are general patterns.';
      const result = validatePhaseDescriptionTone(content);
      expect(result.valid).toBe(true);
    });

    it('should fail phase descriptions with deterministic language', () => {
      const content =
        'She always feels energetic during the follicular phase. Each person is different.';
      const result = validatePhaseDescriptionTone(content);
      expect(result.valid).toBe(false);
    });
  });

  // ─── validateGuidanceTone ───────────────────────────────────────────────

  describe('validateGuidanceTone', () => {
    it('should pass guidance with collaborative framing', () => {
      const content =
        'You might try planning a quiet evening together. She may appreciate low-key activities during this time.';
      const result = validateGuidanceTone(content);
      expect(result.valid).toBe(true);
    });

    it('should fail guidance with directive framing', () => {
      const content = 'You need to give her space. She may feel overwhelmed.';
      const result = validateGuidanceTone(content);
      expect(result.valid).toBe(false);
    });
  });

  // ─── validateContentList ────────────────────────────────────────────────

  describe('validateContentList', () => {
    it('should pass a list of compliant items', () => {
      const items = [
        'She may tend to prefer quieter activities.',
        'You might consider offering a warm drink.',
        'Energy levels could be lower than usual.',
      ];
      const result = validateContentList(items);
      expect(result.valid).toBe(true);
    });

    it('should fail if any item contains deterministic language', () => {
      const items = [
        'She may tend to prefer quieter activities.',
        'She always gets irritable during this phase.',
        'You might consider offering support.',
      ];
      const result = validateContentList(items);
      expect(result.valid).toBe(false);
    });
  });

  // ─── Helper Functions ───────────────────────────────────────────────────

  describe('splitIntoSentences', () => {
    it('should split on periods', () => {
      const sentences = splitIntoSentences('First sentence. Second sentence. Third.');
      expect(sentences).toHaveLength(3);
    });

    it('should split on exclamation marks', () => {
      const sentences = splitIntoSentences('Great news! She might feel better.');
      expect(sentences).toHaveLength(2);
    });

    it('should split on question marks', () => {
      const sentences = splitIntoSentences('How is she feeling? She may be tired.');
      expect(sentences).toHaveLength(2);
    });

    it('should handle empty string', () => {
      const sentences = splitIntoSentences('');
      expect(sentences).toHaveLength(0);
    });
  });

  describe('isEmotionalOrBehavioralStatement', () => {
    it('should identify statements about feelings', () => {
      expect(isEmotionalOrBehavioralStatement('She feels tired and withdrawn.')).toBe(true);
    });

    it('should identify statements about emotions', () => {
      expect(isEmotionalOrBehavioralStatement('Emotional sensitivity is heightened.')).toBe(true);
    });

    it('should identify statements about behavior', () => {
      expect(isEmotionalOrBehavioralStatement('Behavioral patterns shift during this phase.')).toBe(
        true,
      );
    });

    it('should identify statements about energy', () => {
      expect(isEmotionalOrBehavioralStatement('Energy levels tend to drop.')).toBe(true);
    });

    it('should identify statements about mood', () => {
      expect(isEmotionalOrBehavioralStatement('Mood changes are common.')).toBe(true);
    });

    it('should not flag factual/structural statements', () => {
      expect(isEmotionalOrBehavioralStatement('The follicular phase lasts 8 days.')).toBe(false);
    });

    it('should not flag simple date/time statements', () => {
      expect(isEmotionalOrBehavioralStatement('This phase begins on day 6.')).toBe(false);
    });
  });
});
