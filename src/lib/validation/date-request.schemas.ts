import { z } from 'zod';

import { LOCATION_MAX_LENGTH, MOOD_MAX_LENGTH, PERSONAL_NOTE_MAX_LENGTH } from '@/lib/constants';

export const dateRequestSchema = z.object({
  location: z
    .string()
    .max(LOCATION_MAX_LENGTH, `Location must be at most ${LOCATION_MAX_LENGTH} characters`)
    .nullable()
    .optional(),
  mood: z
    .string()
    .max(MOOD_MAX_LENGTH, `Mood must be at most ${MOOD_MAX_LENGTH} characters`)
    .nullable()
    .optional(),
  preferred_date: z.string().nullable().optional(),
  window_start: z.string().nullable().optional(),
  window_end: z.string().nullable().optional(),
  personal_notes: z
    .string()
    .max(
      PERSONAL_NOTE_MAX_LENGTH,
      `Personal notes must be at most ${PERSONAL_NOTE_MAX_LENGTH} characters`,
    )
    .nullable()
    .optional(),
});

export type DateRequestInput = z.infer<typeof dateRequestSchema>;
