import { z } from 'zod';

import {
  CYCLE_DATE_MAX_AGE_DAYS,
  DEFAULT_CYCLE_LENGTH,
  PERSONAL_NOTE_MAX_LENGTH,
} from '@/lib/constants';
import { CyclePhase } from '@/lib/types';

/** Minimum phase duration in days */
export const MIN_PHASE_DURATION = 1;
/** Maximum phase duration in days */
export const MAX_PHASE_DURATION = 14;

/** Validation result for cycle start date */
export interface CycleStartDateValidationResult {
  success: boolean;
  error?: string;
}

/**
 * Validates a cycle start date.
 * Accepts dates within [today - 365 days, today].
 * Rejects future dates and dates older than 365 days with specific error messages.
 *
 * @param dateStr - The date string to validate (ISO format or parseable date string)
 * @param referenceDate - Optional reference date for "today" (useful for testing)
 * @returns Validation result with success flag and optional error message
 */
export function validateCycleStartDate(
  dateStr: string,
  referenceDate?: Date,
): CycleStartDateValidationResult {
  const date = new Date(dateStr);

  if (isNaN(date.getTime())) {
    return {
      success: false,
      error: 'Invalid date format',
    };
  }

  const today = referenceDate ? new Date(referenceDate) : new Date();
  today.setHours(0, 0, 0, 0);

  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() - CYCLE_DATE_MAX_AGE_DAYS);

  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  if (dateOnly > today) {
    return {
      success: false,
      error: 'Start date must be today or earlier',
    };
  }

  if (dateOnly < minDate) {
    return {
      success: false,
      error: `Start date must be within the last ${CYCLE_DATE_MAX_AGE_DAYS} days`,
    };
  }

  return { success: true };
}

/** Cycle start date must be within [today - 365 days, today] */
export const cycleStartDateSchema = z.string().refine(
  (dateStr) => {
    const result = validateCycleStartDate(dateStr);
    return result.success;
  },
  (dateStr) => {
    const result = validateCycleStartDate(dateStr);
    return { message: result.error ?? 'Invalid start date' };
  },
);

export const submitCycleStartDateSchema = z.object({
  start_date: cycleStartDateSchema,
  cycle_length_days: z
    .number()
    .int()
    .min(21, 'Cycle length must be at least 21 days')
    .max(45, 'Cycle length must be at most 45 days')
    .default(DEFAULT_CYCLE_LENGTH),
});

export const cyclePhaseEnum = z.nativeEnum(CyclePhase);

/** Phase customization: each duration 1-14 days */
export const phaseCustomizationSchema = z.object({
  menstrual_days: z
    .number()
    .int()
    .min(1, 'Phase duration must be at least 1 day')
    .max(14, 'Phase duration must be at most 14 days'),
  follicular_days: z
    .number()
    .int()
    .min(1, 'Phase duration must be at least 1 day')
    .max(14, 'Phase duration must be at most 14 days'),
  ovulation_days: z
    .number()
    .int()
    .min(1, 'Phase duration must be at least 1 day')
    .max(14, 'Phase duration must be at most 14 days'),
  early_luteal_days: z
    .number()
    .int()
    .min(1, 'Phase duration must be at least 1 day')
    .max(14, 'Phase duration must be at most 14 days'),
  late_luteal_days: z
    .number()
    .int()
    .min(1, 'Phase duration must be at least 1 day')
    .max(14, 'Phase duration must be at most 14 days'),
});

export const personalNoteSchema = z.object({
  phase: cyclePhaseEnum,
  content: z
    .string()
    .min(1, 'Note content is required')
    .max(PERSONAL_NOTE_MAX_LENGTH, `Note must be at most ${PERSONAL_NOTE_MAX_LENGTH} characters`),
});

/** Validation error for phase duration */
export interface PhaseDurationValidationError {
  field?: string;
  constraint: string;
  message: string;
}

/** Validation result for phase durations */
export interface PhaseDurationValidationResult {
  success: boolean;
  errors: PhaseDurationValidationError[];
}

/**
 * Validates phase durations: each must be an integer between 1 and 14,
 * and the sum must equal the total cycle length.
 */
export function validatePhaseDurations(
  durations: PhaseCustomizationInput,
  cycleLength: number,
): PhaseDurationValidationResult {
  const errors: PhaseDurationValidationError[] = [];
  const fields = [
    'menstrual_days',
    'follicular_days',
    'ovulation_days',
    'early_luteal_days',
    'late_luteal_days',
  ] as const;

  for (const field of fields) {
    const value = durations[field];

    if (!Number.isInteger(value)) {
      errors.push({
        field,
        constraint: 'integer',
        message: `${field} must be a whole number`,
      });
      continue;
    }

    if (value < MIN_PHASE_DURATION) {
      errors.push({
        field,
        constraint: 'min_duration',
        message: `${field} must be at least ${MIN_PHASE_DURATION} day`,
      });
    }

    if (value > MAX_PHASE_DURATION) {
      errors.push({
        field,
        constraint: 'max_duration',
        message: `${field} must be at most ${MAX_PHASE_DURATION} days`,
      });
    }
  }

  const sum = fields.reduce((acc, field) => acc + durations[field], 0);
  if (sum !== cycleLength) {
    errors.push({
      constraint: 'sum_equals_cycle_length',
      message: `Phase durations must sum to ${cycleLength} days (currently ${sum})`,
    });
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

export type SubmitCycleStartDateInput = z.infer<typeof submitCycleStartDateSchema>;
export type PhaseCustomizationInput = z.infer<typeof phaseCustomizationSchema>;
export type PersonalNoteInput = z.infer<typeof personalNoteSchema>;
