import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { CyclePhase, NotificationLog } from '@/lib/types';

import { NotificationService } from '../notification-service';
import type { EmailProvider, NotificationRepository } from '../notification-service';

/**
 * Property 27: Email Notification Content Structure
 *
 * *For any* triggered Email_Notification, the email body SHALL contain:
 * the current phase name with a summary of max 3 sentences, 1-3 emotional/behavioral
 * insights, 1-3 "Do" recommendations, 1-3 "Don't" recommendations, and interaction
 * guidance of max 2 sentences.
 *
 * **Validates: Requirements 17.1, 17.2, 17.3, 17.4**
 */
describe('Property 27: Email Notification Content Structure', () => {
  // Minimal stubs for repository and email provider (not used by composeEmailContent)
  const mockRepository: NotificationRepository = {
    createNotificationLog: async () => ({}) as unknown as NotificationLog,
    updateNotificationLog: async () => ({}) as unknown as NotificationLog,
    getPendingRetries: async () => [],
    wasNotificationSentToday: async () => false,
  };

  const mockEmailProvider: EmailProvider = {
    sendEmail: async () => ({ success: true }),
  };

  const service = new NotificationService(mockRepository, mockEmailProvider);

  const cyclePhaseArb = fc.constantFrom(
    CyclePhase.MENSTRUAL,
    CyclePhase.FOLLICULAR,
    CyclePhase.OVULATION,
    CyclePhase.EARLY_LUTEAL,
    CyclePhase.LATE_LUTEAL,
  );

  /**
   * Helper to count sentences in a text string.
   * A sentence ends with '.', '!', or '?'.
   */
  function countSentences(text: string): number {
    const matches = text.match(/[.!?]+/g);
    return matches ? matches.length : 0;
  }

  it('phaseSummary should have max 3 sentences for any phase', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const content = service.composeEmailContent(phase);
        expect(content.phaseSummary).toBeDefined();
        expect(content.phaseSummary.length).toBeGreaterThan(0);
        expect(countSentences(content.phaseSummary)).toBeLessThanOrEqual(3);
      }),
    );
  });

  it('insights array should have 1-3 items for any phase', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const content = service.composeEmailContent(phase);
        expect(content.insights.length).toBeGreaterThanOrEqual(1);
        expect(content.insights.length).toBeLessThanOrEqual(3);
      }),
    );
  });

  it('doRecommendations array should have 1-3 items for any phase', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const content = service.composeEmailContent(phase);
        expect(content.doRecommendations.length).toBeGreaterThanOrEqual(1);
        expect(content.doRecommendations.length).toBeLessThanOrEqual(3);
      }),
    );
  });

  it('dontRecommendations array should have 1-3 items for any phase', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const content = service.composeEmailContent(phase);
        expect(content.dontRecommendations.length).toBeGreaterThanOrEqual(1);
        expect(content.dontRecommendations.length).toBeLessThanOrEqual(3);
      }),
    );
  });

  it('interactionGuidance should have max 2 sentences for any phase', () => {
    fc.assert(
      fc.property(cyclePhaseArb, (phase) => {
        const content = service.composeEmailContent(phase);
        expect(content.interactionGuidance).toBeDefined();
        expect(content.interactionGuidance.length).toBeGreaterThan(0);
        expect(countSentences(content.interactionGuidance)).toBeLessThanOrEqual(2);
      }),
    );
  });
});
