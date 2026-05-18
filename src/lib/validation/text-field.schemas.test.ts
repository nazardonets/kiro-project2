import { describe, it, expect } from 'vitest';

import {
  createTextFieldSchema,
  validateTextField,
  personalNotesFieldSchema,
  locationFieldSchema,
  moodFieldSchema,
  annotationFieldSchema,
  overrideFieldSchema,
  suspensionReasonFieldSchema,
  behavioralPromptFieldSchema,
  TEXT_FIELD_CONFIGS,
} from './text-field.schemas';

describe('createTextFieldSchema', () => {
  it('creates a schema that accepts strings within bounds', () => {
    const schema = createTextFieldSchema({
      fieldName: 'Test',
      minLength: 1,
      maxLength: 10,
    });
    expect(schema.safeParse('hello').success).toBe(true);
  });

  it('creates a schema that rejects strings below min length', () => {
    const schema = createTextFieldSchema({
      fieldName: 'Test',
      minLength: 1,
      maxLength: 10,
    });
    const result = schema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('creates a schema that rejects strings above max length', () => {
    const schema = createTextFieldSchema({
      fieldName: 'Test',
      minLength: 0,
      maxLength: 5,
    });
    const result = schema.safeParse('123456');
    expect(result.success).toBe(false);
  });

  it('includes field name in error messages', () => {
    const schema = createTextFieldSchema({
      fieldName: 'My Field',
      minLength: 1,
      maxLength: 10,
    });
    const result = schema.safeParse('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('My Field');
    }
  });

  it('allows empty strings when minLength is 0', () => {
    const schema = createTextFieldSchema({
      fieldName: 'Optional',
      minLength: 0,
      maxLength: 100,
    });
    expect(schema.safeParse('').success).toBe(true);
  });
});

describe('validateTextField', () => {
  it('returns success for valid input within bounds', () => {
    const result = validateTextField('hello', {
      fieldName: 'Test',
      minLength: 1,
      maxLength: 10,
    });
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns min_length constraint violation for too-short input', () => {
    const result = validateTextField('', {
      fieldName: 'Reason',
      minLength: 1,
      maxLength: 500,
    });
    expect(result.success).toBe(false);
    expect(result.error?.constraint).toBe('min_length');
    expect(result.error?.message).toContain('Reason');
    expect(result.error?.message).toContain('at least 1');
  });

  it('returns max_length constraint violation for too-long input', () => {
    const result = validateTextField('a'.repeat(501), {
      fieldName: 'Personal notes',
      minLength: 0,
      maxLength: 500,
    });
    expect(result.success).toBe(false);
    expect(result.error?.constraint).toBe('max_length');
    expect(result.error?.message).toContain('Personal notes');
    expect(result.error?.message).toContain('at most 500');
  });

  it('accepts input at exact max length', () => {
    const result = validateTextField('a'.repeat(500), {
      fieldName: 'Notes',
      minLength: 0,
      maxLength: 500,
    });
    expect(result.success).toBe(true);
  });

  it('accepts input at exact min length', () => {
    const result = validateTextField('a', {
      fieldName: 'Content',
      minLength: 1,
      maxLength: 2000,
    });
    expect(result.success).toBe(true);
  });

  it('allows empty strings when minLength is 0', () => {
    const result = validateTextField('', {
      fieldName: 'Optional',
      minLength: 0,
      maxLength: 200,
    });
    expect(result.success).toBe(true);
  });
});

describe('Pre-configured field schemas', () => {
  describe('personalNotesFieldSchema (max 500, optional)', () => {
    it('accepts empty string', () => {
      expect(personalNotesFieldSchema.safeParse('').success).toBe(true);
    });

    it('accepts 500 characters', () => {
      expect(personalNotesFieldSchema.safeParse('a'.repeat(500)).success).toBe(true);
    });

    it('rejects 501 characters', () => {
      expect(personalNotesFieldSchema.safeParse('a'.repeat(501)).success).toBe(false);
    });
  });

  describe('locationFieldSchema (max 200, optional)', () => {
    it('accepts empty string', () => {
      expect(locationFieldSchema.safeParse('').success).toBe(true);
    });

    it('accepts 200 characters', () => {
      expect(locationFieldSchema.safeParse('a'.repeat(200)).success).toBe(true);
    });

    it('rejects 201 characters', () => {
      expect(locationFieldSchema.safeParse('a'.repeat(201)).success).toBe(false);
    });
  });

  describe('moodFieldSchema (max 200, optional)', () => {
    it('accepts empty string', () => {
      expect(moodFieldSchema.safeParse('').success).toBe(true);
    });

    it('accepts 200 characters', () => {
      expect(moodFieldSchema.safeParse('a'.repeat(200)).success).toBe(true);
    });

    it('rejects 201 characters', () => {
      expect(moodFieldSchema.safeParse('a'.repeat(201)).success).toBe(false);
    });
  });

  describe('annotationFieldSchema (1-2000, required)', () => {
    it('rejects empty string', () => {
      expect(annotationFieldSchema.safeParse('').success).toBe(false);
    });

    it('accepts 1 character', () => {
      expect(annotationFieldSchema.safeParse('a').success).toBe(true);
    });

    it('accepts 2000 characters', () => {
      expect(annotationFieldSchema.safeParse('a'.repeat(2000)).success).toBe(true);
    });

    it('rejects 2001 characters', () => {
      expect(annotationFieldSchema.safeParse('a'.repeat(2001)).success).toBe(false);
    });
  });

  describe('overrideFieldSchema (1-2000, required)', () => {
    it('rejects empty string', () => {
      expect(overrideFieldSchema.safeParse('').success).toBe(false);
    });

    it('accepts 1 character', () => {
      expect(overrideFieldSchema.safeParse('a').success).toBe(true);
    });

    it('accepts 2000 characters', () => {
      expect(overrideFieldSchema.safeParse('a'.repeat(2000)).success).toBe(true);
    });

    it('rejects 2001 characters', () => {
      expect(overrideFieldSchema.safeParse('a'.repeat(2001)).success).toBe(false);
    });
  });

  describe('suspensionReasonFieldSchema (1-500, required)', () => {
    it('rejects empty string', () => {
      expect(suspensionReasonFieldSchema.safeParse('').success).toBe(false);
    });

    it('accepts 1 character', () => {
      expect(suspensionReasonFieldSchema.safeParse('a').success).toBe(true);
    });

    it('accepts 500 characters', () => {
      expect(suspensionReasonFieldSchema.safeParse('a'.repeat(500)).success).toBe(true);
    });

    it('rejects 501 characters', () => {
      expect(suspensionReasonFieldSchema.safeParse('a'.repeat(501)).success).toBe(false);
    });
  });

  describe('behavioralPromptFieldSchema (max 280, optional)', () => {
    it('accepts empty string', () => {
      expect(behavioralPromptFieldSchema.safeParse('').success).toBe(true);
    });

    it('accepts 280 characters', () => {
      expect(behavioralPromptFieldSchema.safeParse('a'.repeat(280)).success).toBe(true);
    });

    it('rejects 281 characters', () => {
      expect(behavioralPromptFieldSchema.safeParse('a'.repeat(281)).success).toBe(false);
    });
  });
});

describe('TEXT_FIELD_CONFIGS', () => {
  it('has correct config for personalNotes', () => {
    expect(TEXT_FIELD_CONFIGS.personalNotes).toEqual({
      fieldName: 'Personal notes',
      minLength: 0,
      maxLength: 500,
    });
  });

  it('has correct config for location', () => {
    expect(TEXT_FIELD_CONFIGS.location).toEqual({
      fieldName: 'Location',
      minLength: 0,
      maxLength: 200,
    });
  });

  it('has correct config for mood', () => {
    expect(TEXT_FIELD_CONFIGS.mood).toEqual({
      fieldName: 'Mood',
      minLength: 0,
      maxLength: 200,
    });
  });

  it('has correct config for annotation', () => {
    expect(TEXT_FIELD_CONFIGS.annotation).toEqual({
      fieldName: 'Annotation',
      minLength: 1,
      maxLength: 2000,
    });
  });

  it('has correct config for override', () => {
    expect(TEXT_FIELD_CONFIGS.override).toEqual({
      fieldName: 'Override',
      minLength: 1,
      maxLength: 2000,
    });
  });

  it('has correct config for suspensionReason', () => {
    expect(TEXT_FIELD_CONFIGS.suspensionReason).toEqual({
      fieldName: 'Suspension reason',
      minLength: 1,
      maxLength: 500,
    });
  });

  it('has correct config for behavioralPrompt', () => {
    expect(TEXT_FIELD_CONFIGS.behavioralPrompt).toEqual({
      fieldName: 'Behavioral prompt',
      minLength: 0,
      maxLength: 280,
    });
  });
});
