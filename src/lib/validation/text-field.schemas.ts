import { z } from 'zod';

import {
  PERSONAL_NOTE_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  MOOD_MAX_LENGTH,
  ANNOTATION_MIN_LENGTH,
  ANNOTATION_MAX_LENGTH,
  SUSPENSION_REASON_MAX_LENGTH,
  BEHAVIORAL_PROMPT_MAX_LENGTH,
} from '@/lib/constants';

/**
 * Configuration for a text field length constraint.
 */
export interface TextFieldConfig {
  /** Human-readable field name for error messages */
  fieldName: string;
  /** Minimum length (0 = optional, >0 = required) */
  minLength: number;
  /** Maximum allowed length */
  maxLength: number;
}

/**
 * Result of a text field validation.
 */
export interface TextFieldValidationResult {
  success: boolean;
  error?: {
    message: string;
    constraint: 'min_length' | 'max_length';
  };
}

/**
 * Factory function that creates a Zod schema for a text field with the given constraints.
 * Returns a schema that validates string length and provides field-specific error messages.
 */
export function createTextFieldSchema(config: TextFieldConfig) {
  const { fieldName, minLength, maxLength } = config;

  let schema = z.string();

  if (minLength > 0) {
    schema = schema.min(
      minLength,
      `${fieldName} must be at least ${minLength} character${minLength > 1 ? 's' : ''}`,
    );
  }

  schema = schema.max(maxLength, `${fieldName} must be at most ${maxLength} characters`);

  return schema;
}

/**
 * Validates a text field value against the given configuration.
 * Returns a result object with success status and field-specific error details.
 */
export function validateTextField(
  value: string,
  config: TextFieldConfig,
): TextFieldValidationResult {
  const { fieldName, minLength, maxLength } = config;

  if (minLength > 0 && value.length < minLength) {
    return {
      success: false,
      error: {
        message: `${fieldName} must be at least ${minLength} character${minLength > 1 ? 's' : ''}`,
        constraint: 'min_length',
      },
    };
  }

  if (value.length > maxLength) {
    return {
      success: false,
      error: {
        message: `${fieldName} must be at most ${maxLength} characters`,
        constraint: 'max_length',
      },
    };
  }

  return { success: true };
}

// --- Pre-configured field schemas ---

/** Personal notes: optional, max 500 characters */
export const personalNotesFieldSchema = createTextFieldSchema({
  fieldName: 'Personal notes',
  minLength: 0,
  maxLength: PERSONAL_NOTE_MAX_LENGTH,
});

/** Location: optional, max 200 characters */
export const locationFieldSchema = createTextFieldSchema({
  fieldName: 'Location',
  minLength: 0,
  maxLength: LOCATION_MAX_LENGTH,
});

/** Mood: optional, max 200 characters */
export const moodFieldSchema = createTextFieldSchema({
  fieldName: 'Mood',
  minLength: 0,
  maxLength: MOOD_MAX_LENGTH,
});

/** Annotations: required, 1-2000 characters */
export const annotationFieldSchema = createTextFieldSchema({
  fieldName: 'Annotation',
  minLength: ANNOTATION_MIN_LENGTH,
  maxLength: ANNOTATION_MAX_LENGTH,
});

/** Overrides: required, 1-2000 characters */
export const overrideFieldSchema = createTextFieldSchema({
  fieldName: 'Override',
  minLength: ANNOTATION_MIN_LENGTH,
  maxLength: ANNOTATION_MAX_LENGTH,
});

/** Suspension reason: required, 1-500 characters */
export const suspensionReasonFieldSchema = createTextFieldSchema({
  fieldName: 'Suspension reason',
  minLength: 1,
  maxLength: SUSPENSION_REASON_MAX_LENGTH,
});

/** Behavioral prompts: optional, max 280 characters */
export const behavioralPromptFieldSchema = createTextFieldSchema({
  fieldName: 'Behavioral prompt',
  minLength: 0,
  maxLength: BEHAVIORAL_PROMPT_MAX_LENGTH,
});

// --- Pre-configured field configs (for use with validateTextField) ---

export const TEXT_FIELD_CONFIGS = {
  personalNotes: {
    fieldName: 'Personal notes',
    minLength: 0,
    maxLength: PERSONAL_NOTE_MAX_LENGTH,
  },
  location: {
    fieldName: 'Location',
    minLength: 0,
    maxLength: LOCATION_MAX_LENGTH,
  },
  mood: {
    fieldName: 'Mood',
    minLength: 0,
    maxLength: MOOD_MAX_LENGTH,
  },
  annotation: {
    fieldName: 'Annotation',
    minLength: ANNOTATION_MIN_LENGTH,
    maxLength: ANNOTATION_MAX_LENGTH,
  },
  override: {
    fieldName: 'Override',
    minLength: ANNOTATION_MIN_LENGTH,
    maxLength: ANNOTATION_MAX_LENGTH,
  },
  suspensionReason: {
    fieldName: 'Suspension reason',
    minLength: 1,
    maxLength: SUSPENSION_REASON_MAX_LENGTH,
  },
  behavioralPrompt: {
    fieldName: 'Behavioral prompt',
    minLength: 0,
    maxLength: BEHAVIORAL_PROMPT_MAX_LENGTH,
  },
} as const satisfies Record<string, TextFieldConfig>;
