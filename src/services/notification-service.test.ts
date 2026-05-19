import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  CyclePhase,
  NotificationFrequency,
  NotificationStatus,
  NotificationType,
  DeliveryTime,
  NotificationPreferences,
  SharingPreferences,
  NotificationLog,
} from '@/lib/types';

import {
  NotificationService,
  NotificationRepository,
  EmailProvider,
  NotificationContext,
  EmailNotificationContent,
} from './notification-service';

// ─── Test Helpers ───────────────────────────────────────────────────────────

function createMockRepository(): NotificationRepository {
  return {
    createNotificationLog: vi.fn().mockResolvedValue({
      id: 'log-1',
      partner_user_id: 'partner-1',
      type: NotificationType.DAILY_SUMMARY,
      status: NotificationStatus.RETRYING,
      retry_count: 0,
      sent_at: new Date().toISOString(),
      next_retry_at: null,
    }),
    updateNotificationLog: vi.fn().mockResolvedValue({
      id: 'log-1',
      partner_user_id: 'partner-1',
      type: NotificationType.DAILY_SUMMARY,
      status: NotificationStatus.SENT,
      retry_count: 0,
      sent_at: new Date().toISOString(),
      next_retry_at: null,
    }),
    getPendingRetries: vi.fn().mockResolvedValue([]),
    wasNotificationSentToday: vi.fn().mockResolvedValue(false),
  };
}

function createMockEmailProvider(success = true): EmailProvider {
  return {
    sendEmail: vi
      .fn()
      .mockResolvedValue({ success, error: success ? undefined : 'Delivery failed' }),
  };
}

function createDefaultNotificationPreferences(
  overrides?: Partial<NotificationPreferences>,
): NotificationPreferences {
  return {
    id: 'pref-1',
    partner_user_id: 'partner-1',
    frequency: NotificationFrequency.DAILY,
    delivery_time: DeliveryTime.MORNING,
    reminders_enabled: false,
    reminder_time: '09:00',
    timezone: 'America/New_York',
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createDefaultSharingPreferences(
  overrides?: Partial<SharingPreferences>,
): SharingPreferences {
  return {
    id: 'share-1',
    primary_user_id: 'primary-1',
    emotional_tendencies: true,
    behavioral_patterns: true,
    energy_levels: true,
    communication_guidance: true,
    daily_summaries: true,
    phase_alerts: true,
    partner_reminders: true,
    email_notifications_enabled: true,
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createDefaultContext(overrides?: Partial<NotificationContext>): NotificationContext {
  return {
    partnerUserId: 'partner-1',
    partnerEmail: 'partner@example.com',
    primaryUserId: 'primary-1',
    currentPhase: CyclePhase.FOLLICULAR,
    notificationPreferences: createDefaultNotificationPreferences(),
    sharingPreferences: createDefaultSharingPreferences(),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('NotificationService', () => {
  let service: NotificationService;
  let repository: NotificationRepository;
  let emailProvider: EmailProvider;

  beforeEach(() => {
    repository = createMockRepository();
    emailProvider = createMockEmailProvider();
    service = new NotificationService(repository, emailProvider);
  });

  describe('composeEmailContent', () => {
    it('should compose content with all required sections for each phase', () => {
      const phases = Object.values(CyclePhase);

      for (const phase of phases) {
        const content = service.composeEmailContent(phase);

        // Phase summary present (Req 17.1)
        expect(content.phaseSummary).toBeTruthy();
        expect(content.phaseSummary.length).toBeGreaterThan(0);

        // 1-3 insights (Req 17.2)
        expect(content.insights.length).toBeGreaterThanOrEqual(1);
        expect(content.insights.length).toBeLessThanOrEqual(3);

        // 1-3 "Do" recommendations (Req 17.3)
        expect(content.doRecommendations.length).toBeGreaterThanOrEqual(1);
        expect(content.doRecommendations.length).toBeLessThanOrEqual(3);

        // 1-3 "Don't" recommendations (Req 17.3)
        expect(content.dontRecommendations.length).toBeGreaterThanOrEqual(1);
        expect(content.dontRecommendations.length).toBeLessThanOrEqual(3);

        // Interaction guidance present (Req 17.4)
        expect(content.interactionGuidance).toBeTruthy();
        expect(content.interactionGuidance.length).toBeGreaterThan(0);
      }
    });

    it('should limit phase summary to max 3 sentences', () => {
      const phases = Object.values(CyclePhase);

      for (const phase of phases) {
        const content = service.composeEmailContent(phase);
        const sentenceCount = (content.phaseSummary.match(/[.!?]+/g) || []).length;
        expect(sentenceCount).toBeLessThanOrEqual(3);
      }
    });

    it('should limit interaction guidance to max 2 sentences', () => {
      const phases = Object.values(CyclePhase);

      for (const phase of phases) {
        const content = service.composeEmailContent(phase);
        const sentenceCount = (content.interactionGuidance.match(/[.!?]+/g) || []).length;
        expect(sentenceCount).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('validateEmailContent', () => {
    it('should validate correct content', () => {
      const content = service.composeEmailContent(CyclePhase.MENSTRUAL);
      expect(service.validateEmailContent(content)).toBe(true);
    });

    it('should reject content with empty phase summary', () => {
      const content: EmailNotificationContent = {
        phaseSummary: '',
        insights: ['insight 1'],
        doRecommendations: ['do 1'],
        dontRecommendations: ['dont 1'],
        interactionGuidance: 'Some guidance.',
      };
      expect(service.validateEmailContent(content)).toBe(false);
    });

    it('should reject content with too many insights', () => {
      const content: EmailNotificationContent = {
        phaseSummary: 'Phase summary.',
        insights: ['a', 'b', 'c', 'd'],
        doRecommendations: ['do 1'],
        dontRecommendations: ['dont 1'],
        interactionGuidance: 'Some guidance.',
      };
      expect(service.validateEmailContent(content)).toBe(false);
    });

    it('should reject content with zero insights', () => {
      const content: EmailNotificationContent = {
        phaseSummary: 'Phase summary.',
        insights: [],
        doRecommendations: ['do 1'],
        dontRecommendations: ['dont 1'],
        interactionGuidance: 'Some guidance.',
      };
      expect(service.validateEmailContent(content)).toBe(false);
    });

    it('should reject content with too many do recommendations', () => {
      const content: EmailNotificationContent = {
        phaseSummary: 'Phase summary.',
        insights: ['insight 1'],
        doRecommendations: ['a', 'b', 'c', 'd'],
        dontRecommendations: ['dont 1'],
        interactionGuidance: 'Some guidance.',
      };
      expect(service.validateEmailContent(content)).toBe(false);
    });

    it('should reject content with empty interaction guidance', () => {
      const content: EmailNotificationContent = {
        phaseSummary: 'Phase summary.',
        insights: ['insight 1'],
        doRecommendations: ['do 1'],
        dontRecommendations: ['dont 1'],
        interactionGuidance: '',
      };
      expect(service.validateEmailContent(content)).toBe(false);
    });
  });

  describe('formatEmailHtml', () => {
    it('should produce valid HTML with all sections', () => {
      const content = service.composeEmailContent(CyclePhase.OVULATION);
      const html = service.formatEmailHtml(content, CyclePhase.OVULATION);

      expect(html).toContain('Ovulation Phase');
      expect(html).toContain('Insights');
      expect(html).toContain('Do');
      expect(html).toContain("Don't");
      expect(html).toContain('Interaction Guidance');
      expect(html).toContain(content.phaseSummary);
      expect(html).toContain(content.interactionGuidance);
    });
  });

  describe('shouldSendNotification', () => {
    it('should return false when email notifications are disabled by Primary_User', async () => {
      const context = createDefaultContext({
        sharingPreferences: createDefaultSharingPreferences({
          email_notifications_enabled: false,
        }),
      });

      const result = await service.shouldSendNotification(context, 'daily');
      expect(result).toBe(false);
    });

    it('should return true for daily frequency on daily trigger when not already sent', async () => {
      const context = createDefaultContext();
      const result = await service.shouldSendNotification(context, 'daily');
      expect(result).toBe(true);
    });

    it('should return false for daily frequency when already sent today', async () => {
      (repository.wasNotificationSentToday as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      const context = createDefaultContext();
      const result = await service.shouldSendNotification(context, 'daily');
      expect(result).toBe(false);
    });

    it('should return true for phase-based frequency on phase change', async () => {
      const context = createDefaultContext({
        notificationPreferences: createDefaultNotificationPreferences({
          frequency: NotificationFrequency.PHASE_BASED,
        }),
        previousPhase: CyclePhase.MENSTRUAL,
        currentPhase: CyclePhase.FOLLICULAR,
      });

      const result = await service.shouldSendNotification(context, 'phase_change');
      expect(result).toBe(true);
    });

    it('should return false for phase-based frequency when phase has not changed', async () => {
      const context = createDefaultContext({
        notificationPreferences: createDefaultNotificationPreferences({
          frequency: NotificationFrequency.PHASE_BASED,
        }),
        previousPhase: CyclePhase.FOLLICULAR,
        currentPhase: CyclePhase.FOLLICULAR,
      });

      const result = await service.shouldSendNotification(context, 'phase_change');
      expect(result).toBe(false);
    });

    it('should return false for phase-based frequency on daily trigger', async () => {
      const context = createDefaultContext({
        notificationPreferences: createDefaultNotificationPreferences({
          frequency: NotificationFrequency.PHASE_BASED,
        }),
      });

      const result = await service.shouldSendNotification(context, 'daily');
      expect(result).toBe(false);
    });

    it('should return true for custom frequency on daily trigger when not already sent', async () => {
      const context = createDefaultContext({
        notificationPreferences: createDefaultNotificationPreferences({
          frequency: NotificationFrequency.CUSTOM,
        }),
      });

      const result = await service.shouldSendNotification(context, 'daily');
      expect(result).toBe(true);
    });
  });

  describe('isWithinDeliveryWindow', () => {
    it('should return true for morning delivery between 6-9 AM', () => {
      const prefs = createDefaultNotificationPreferences({
        delivery_time: DeliveryTime.MORNING,
        frequency: NotificationFrequency.DAILY,
      });

      expect(service.isWithinDeliveryWindow(prefs, 6)).toBe(true);
      expect(service.isWithinDeliveryWindow(prefs, 7)).toBe(true);
      expect(service.isWithinDeliveryWindow(prefs, 8)).toBe(true);
    });

    it('should return false for morning delivery outside 6-9 AM', () => {
      const prefs = createDefaultNotificationPreferences({
        delivery_time: DeliveryTime.MORNING,
        frequency: NotificationFrequency.DAILY,
      });

      expect(service.isWithinDeliveryWindow(prefs, 5)).toBe(false);
      expect(service.isWithinDeliveryWindow(prefs, 9)).toBe(false);
      expect(service.isWithinDeliveryWindow(prefs, 12)).toBe(false);
    });

    it('should return true for evening delivery between 6-9 PM', () => {
      const prefs = createDefaultNotificationPreferences({
        delivery_time: DeliveryTime.EVENING,
        frequency: NotificationFrequency.DAILY,
      });

      expect(service.isWithinDeliveryWindow(prefs, 18)).toBe(true);
      expect(service.isWithinDeliveryWindow(prefs, 19)).toBe(true);
      expect(service.isWithinDeliveryWindow(prefs, 20)).toBe(true);
    });

    it('should return false for evening delivery outside 6-9 PM', () => {
      const prefs = createDefaultNotificationPreferences({
        delivery_time: DeliveryTime.EVENING,
        frequency: NotificationFrequency.DAILY,
      });

      expect(service.isWithinDeliveryWindow(prefs, 17)).toBe(false);
      expect(service.isWithinDeliveryWindow(prefs, 21)).toBe(false);
      expect(service.isWithinDeliveryWindow(prefs, 12)).toBe(false);
    });

    it('should return true for phase-based frequency regardless of time', () => {
      const prefs = createDefaultNotificationPreferences({
        frequency: NotificationFrequency.PHASE_BASED,
      });

      expect(service.isWithinDeliveryWindow(prefs, 3)).toBe(true);
      expect(service.isWithinDeliveryWindow(prefs, 14)).toBe(true);
      expect(service.isWithinDeliveryWindow(prefs, 23)).toBe(true);
    });

    it('should respect custom frequency delivery time', () => {
      const prefs = createDefaultNotificationPreferences({
        frequency: NotificationFrequency.CUSTOM,
        delivery_time: DeliveryTime.EVENING,
      });

      expect(service.isWithinDeliveryWindow(prefs, 18)).toBe(true);
      expect(service.isWithinDeliveryWindow(prefs, 7)).toBe(false);
    });
  });

  describe('sendNotification', () => {
    it('should send email successfully and log as sent', async () => {
      const context = createDefaultContext();
      const result = await service.sendNotification(context);

      expect(result.success).toBe(true);
      expect(result.notificationLogId).toBe('log-1');
      expect(emailProvider.sendEmail).toHaveBeenCalledTimes(1);
      expect(repository.createNotificationLog).toHaveBeenCalledTimes(1);
      expect(repository.updateNotificationLog).toHaveBeenCalledWith(
        'log-1',
        expect.objectContaining({
          status: NotificationStatus.SENT,
        }),
      );
    });

    it('should handle email delivery failure and mark for retry', async () => {
      emailProvider = createMockEmailProvider(false);
      service = new NotificationService(repository, emailProvider);

      const context = createDefaultContext();
      const result = await service.sendNotification(context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EMAIL_DELIVERY_FAILED');
      expect(repository.updateNotificationLog).toHaveBeenCalledWith(
        'log-1',
        expect.objectContaining({
          status: NotificationStatus.FAILED,
          retry_count: 1,
        }),
      );
    });

    it('should include correct subject line with phase name', async () => {
      const context = createDefaultContext({ currentPhase: CyclePhase.LATE_LUTEAL });
      await service.sendNotification(context);

      expect(emailProvider.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'partner@example.com',
          subject: 'Cycle Update: Late Luteal Phase',
        }),
      );
    });

    it('should use phase-alert type for phase-based frequency', async () => {
      const context = createDefaultContext({
        notificationPreferences: createDefaultNotificationPreferences({
          frequency: NotificationFrequency.PHASE_BASED,
        }),
      });

      await service.sendNotification(context);

      expect(repository.createNotificationLog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.PHASE_ALERT,
        }),
      );
    });
  });

  describe('processPendingRetries', () => {
    it('should mark notifications as failed after max retries', async () => {
      const failedLog: NotificationLog = {
        id: 'log-retry',
        partner_user_id: 'partner-1',
        type: NotificationType.DAILY_SUMMARY,
        status: NotificationStatus.FAILED,
        retry_count: 3,
        sent_at: new Date().toISOString(),
        next_retry_at: new Date(Date.now() - 60000).toISOString(),
      };

      (repository.getPendingRetries as ReturnType<typeof vi.fn>).mockResolvedValue([failedLog]);

      const context = createDefaultContext();
      const results = await service.processPendingRetries(context);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error?.code).toBe('MAX_RETRIES_EXCEEDED');
      expect(repository.updateNotificationLog).toHaveBeenCalledWith(
        'log-retry',
        expect.objectContaining({
          status: NotificationStatus.FAILED,
          next_retry_at: null,
        }),
      );
    });

    it('should skip retries that are not yet due', async () => {
      const futureLog: NotificationLog = {
        id: 'log-future',
        partner_user_id: 'partner-1',
        type: NotificationType.DAILY_SUMMARY,
        status: NotificationStatus.RETRYING,
        retry_count: 1,
        sent_at: new Date().toISOString(),
        next_retry_at: new Date(Date.now() + 300000).toISOString(), // 5 min in future
      };

      (repository.getPendingRetries as ReturnType<typeof vi.fn>).mockResolvedValue([futureLog]);

      const context = createDefaultContext();
      const results = await service.processPendingRetries(context);

      expect(results).toHaveLength(0);
      expect(emailProvider.sendEmail).not.toHaveBeenCalled();
    });

    it('should retry notifications that are due and succeed', async () => {
      const dueLog: NotificationLog = {
        id: 'log-due',
        partner_user_id: 'partner-1',
        type: NotificationType.DAILY_SUMMARY,
        status: NotificationStatus.RETRYING,
        retry_count: 1,
        sent_at: new Date().toISOString(),
        next_retry_at: new Date(Date.now() - 60000).toISOString(), // 1 min ago
      };

      (repository.getPendingRetries as ReturnType<typeof vi.fn>).mockResolvedValue([dueLog]);

      const context = createDefaultContext();
      const results = await service.processPendingRetries(context);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(emailProvider.sendEmail).toHaveBeenCalledTimes(1);
    });
  });
});
