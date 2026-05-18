import { z } from 'zod';

import {
  ANNOTATION_MIN_LENGTH,
  ANNOTATION_MAX_LENGTH,
  SUSPENSION_REASON_MAX_LENGTH,
  ADMIN_SEARCH_RESULT_LIMIT,
} from '@/lib/constants';
import { CyclePhase } from '@/lib/types';

export const adminSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(ADMIN_SEARCH_RESULT_LIMIT, `Maximum ${ADMIN_SEARCH_RESULT_LIMIT} results per query`)
    .default(ADMIN_SEARCH_RESULT_LIMIT),
});

export const suspendAccountSchema = z.object({
  reason: z
    .string()
    .min(1, 'Suspension reason is required')
    .max(
      SUSPENSION_REASON_MAX_LENGTH,
      `Suspension reason must be at most ${SUSPENSION_REASON_MAX_LENGTH} characters`,
    ),
});

export const adminAnnotationSchema = z.object({
  cycle_record_id: z.string().uuid('Invalid cycle record ID'),
  phase: z.nativeEnum(CyclePhase).nullable().optional(),
  content: z
    .string()
    .min(ANNOTATION_MIN_LENGTH, `Annotation must be at least ${ANNOTATION_MIN_LENGTH} character`)
    .max(ANNOTATION_MAX_LENGTH, `Annotation must be at most ${ANNOTATION_MAX_LENGTH} characters`),
});

export const adminOverrideSchema = z.object({
  cycle_record_id: z.string().uuid('Invalid cycle record ID'),
  phase: z.nativeEnum(CyclePhase),
  replacement_content: z
    .string()
    .min(
      ANNOTATION_MIN_LENGTH,
      `Override content must be at least ${ANNOTATION_MIN_LENGTH} character`,
    )
    .max(
      ANNOTATION_MAX_LENGTH,
      `Override content must be at most ${ANNOTATION_MAX_LENGTH} characters`,
    ),
});

export const updateAnnotationSchema = z.object({
  content: z
    .string()
    .min(ANNOTATION_MIN_LENGTH, `Annotation must be at least ${ANNOTATION_MIN_LENGTH} character`)
    .max(ANNOTATION_MAX_LENGTH, `Annotation must be at most ${ANNOTATION_MAX_LENGTH} characters`),
});

export const updateOverrideSchema = z.object({
  replacement_content: z
    .string()
    .min(
      ANNOTATION_MIN_LENGTH,
      `Override content must be at least ${ANNOTATION_MIN_LENGTH} character`,
    )
    .max(
      ANNOTATION_MAX_LENGTH,
      `Override content must be at most ${ANNOTATION_MAX_LENGTH} characters`,
    ),
});

export type AdminSearchInput = z.infer<typeof adminSearchSchema>;
export type SuspendAccountInput = z.infer<typeof suspendAccountSchema>;
export type AdminAnnotationInput = z.infer<typeof adminAnnotationSchema>;
export type AdminOverrideInput = z.infer<typeof adminOverrideSchema>;
export type UpdateAnnotationInput = z.infer<typeof updateAnnotationSchema>;
export type UpdateOverrideInput = z.infer<typeof updateOverrideSchema>;
