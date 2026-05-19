/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { CyclePhase } from '@/lib/types';
import {
  buildEmailSections,
  formatDateRequestEmailContent,
  formatDateRequestEmailHtml,
  DateRequestSubmission,
} from '@/services/date-request-service';

/**
 * Property 22: Date Request Email Structure
 *
 * *For any* Date_Request with a non-empty set of specified fields (location, mood,
 * timing, personal notes), the formatted email SHALL contain a labeled section for
 * each specified field and a phase-context section describing current Cycle_Phase
 * tendencies.
 *
 * **Validates: Requirements 11.7**
 */
describe('Property 22: Date Request Email Structure', () => {
  const cyclePhaseArb = fc.constantFrom(
    CyclePhase.MENSTRUAL,
    CyclePhase.FOLLICULAR,
    CyclePhase.OVULATION,
    CyclePhase.EARLY_LUTEAL,
    CyclePhase.LATE_LUTEAL,
  );

  // Arbitrary for optional non-empty string fields (1-200 chars for location/mood)
  const optionalShortStringArb = fc.oneof(
    fc.constant(undefined as string | undefined),
    fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
  );

  // Arbitrary for optional personal notes (1-500 chars)
  const optionalNotesArb = fc.oneof(
    fc.constant(undefined as string | undefined),
    fc.string({ minLength: 1, maxLength: 500 }).filter((s) => s.trim().length > 0),
  );

  // Arbitrary for optional date string (YYYY-MM-DD format)
  const optionalDateArb = fc.oneof(
    fc.constant(undefined as string | undefined),
    fc
      .tuple(
        fc.integer({ min: 2020, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
      )
      .map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`),
  );

  // Arbitrary for a DateRequestSubmission with at least one non-empty field
  const submissionWithFieldsArb = fc
    .record({
      location: optionalShortStringArb,
      mood: optionalShortStringArb,
      preferredDate: optionalDateArb,
      windowStart: optionalDateArb,
      windowEnd: optionalDateArb,
      personalNotes: optionalNotesArb,
    })
    .filter(
      (s) =>
        !!(
          s.location ||
          s.mood ||
          s.preferredDate ||
          s.windowStart ||
          s.windowEnd ||
          s.personalNotes
        ),
    )
    .map((fields) => ({
      primaryUserId: 'test-user-id',
      ...fields,
    })) as fc.Arbitrary<DateRequestSubmission>;

  // Deterministic terms that should NOT appear in phase context
  const deterministicPatterns = [
    /\bshe will feel\b/i,
    /\balways\b/i,
    /\bnever\b/i,
    /\bdefinitely\b/i,
    /\bcertainly\b/i,
  ];

  it('buildEmailSections returns a labeled section for each specified field', () => {
    fc.assert(
      fc.property(submissionWithFieldsArb, (submission) => {
        const sections = buildEmailSections(submission);

        // Check location section
        if (submission.location) {
          const locationSection = sections.find((s) => s.label === 'Preferred Location');
          expect(locationSection).toBeDefined();
          expect(locationSection!.content).toBe(submission.location);
        }

        // Check mood section
        if (submission.mood) {
          const moodSection = sections.find((s) => s.label === 'Desired Mood & Vibe');
          expect(moodSection).toBeDefined();
          expect(moodSection!.content).toBe(submission.mood);
        }

        // Check timing section (preferredDate takes priority over window)
        const hasTiming = !!(
          submission.preferredDate ||
          submission.windowStart ||
          submission.windowEnd
        );
        if (hasTiming) {
          const timingSection = sections.find((s) => s.label === 'Timing');
          expect(timingSection).toBeDefined();
          expect(timingSection!.content.length).toBeGreaterThan(0);
        }

        // Check personal notes section
        if (submission.personalNotes) {
          const notesSection = sections.find((s) => s.label === 'Personal Notes');
          expect(notesSection).toBeDefined();
          expect(notesSection!.content).toBe(submission.personalNotes);
        }
      }),
    );
  });

  it('formatDateRequestEmailContent produces non-empty phaseContext for all phases', () => {
    fc.assert(
      fc.property(submissionWithFieldsArb, cyclePhaseArb, (submission, phase) => {
        const content = formatDateRequestEmailContent(submission, phase);

        expect(content.phaseContext).toBeDefined();
        expect(content.phaseContext.length).toBeGreaterThan(0);
      }),
    );
  });

  it('formatDateRequestEmailHtml contains labeled sections for each specified field and a phase-context section', () => {
    fc.assert(
      fc.property(submissionWithFieldsArb, cyclePhaseArb, (submission, phase) => {
        const content = formatDateRequestEmailContent(submission, phase);
        const html = formatDateRequestEmailHtml(content, phase);

        // Verify labeled sections appear in HTML
        if (submission.location) {
          expect(html).toContain('Preferred Location');
          expect(html).toContain(submission.location);
        }

        if (submission.mood) {
          expect(html).toContain('Desired Mood & Vibe');
          expect(html).toContain(submission.mood);
        }

        const hasTiming = !!(
          submission.preferredDate ||
          submission.windowStart ||
          submission.windowEnd
        );
        if (hasTiming) {
          expect(html).toContain('Timing');
        }

        if (submission.personalNotes) {
          expect(html).toContain('Personal Notes');
          expect(html).toContain(submission.personalNotes);
        }

        // Verify phase-context section exists
        expect(html).toContain('Phase Context');
        expect(html).toContain(content.phaseContext);
      }),
    );
  });

  it('phase-context section uses probabilistic language and avoids deterministic terms', () => {
    fc.assert(
      fc.property(submissionWithFieldsArb, cyclePhaseArb, (submission, phase) => {
        const content = formatDateRequestEmailContent(submission, phase);

        // Phase context should not contain deterministic language
        for (const pattern of deterministicPatterns) {
          expect(pattern.test(content.phaseContext)).toBe(false);
        }

        // Phase context should contain at least one probabilistic qualifier
        const hasProbabilistic = /\b(may|might|could|can|potentially|possibly)\b/i.test(
          content.phaseContext,
        );
        expect(hasProbabilistic).toBe(true);
      }),
    );
  });
});
