/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { CyclePhase, DateRequestStatus, NotificationStatus, NotificationType } from '@/lib/types';
import {
  DateRequestService,
  DateRequestRepository,
  DateRequestSubmission,
  buildEmailSections,
  formatDateRequestEmailContent,
  formatDateRequestEmailHtml,
  generatePhaseContext,
} from '@/services/date-request-service';
import type { EmailProvider } from '@/services/notification-service';

// ─── Mock Repository ────────────────────────────────────────────────────────

function createMockRepository(overrides?: Partial<DateRequestRepository>): DateRequestRepository {
  return {
    getActivePartnerLink: vi.fn().mockResolvedValue({
      id: 'link-1',
      primary_user_id: 'user-1',
      partner_user_id: 'partner-1',
      status: 'active',
      linked_at: '2024-01-01T00:00:00Z',
      revoked_at: null,
    }),
    getSharingPreferences: vi.fn().mockResolvedValue({
      id: 'prefs-1',
      primary_user_id: 'user-1',
      emotional_tendencies: true,
      behavioral_patterns: true,
      energy_levels: true,
      communication_guidance: true,
      daily_summaries: true,
      phase_alerts: true,
      partner_reminders: true,
      email_notifications_enabled: true,
      updated_at: '2024-01-01T00:00:00Z',
    }),
    getPartnerEmail: vi.fn().mockResolvedValue('partner@example.com'),
    getCurrentCyclePhase: vi.fn().mockResolvedValue(CyclePhase.FOLLICULAR),
    createDateRequest: vi.fn().mockResolvedValue({
      id: 'dr-1',
      primary_user_id: 'user-1',
      location: null,
      mood: null,
      preferred_date: null,
      window_start: null,
      window_end: null,
      personal_notes: null,
      status: DateRequestStatus.PENDING,
      created_at: '2024-01-15T10:00:00Z',
    }),
    updateDateRequestStatus: vi.fn().mockResolvedValue(undefined),
    createNotificationLog: vi.fn().mockResolvedValue({
      id: 'log-1',
      partner_user_id: 'partner-1',
      type: NotificationType.DATE_REQUEST,
      status: NotificationStatus.SENT,
      retry_count: 0,
      sent_at: '2024-01-15T10:00:00Z',
      next_retry_at: null,
    }),
    ...overrides,
  };
}

function createMockEmailProvider(success = true): EmailProvider {
  return {
    sendEmail: vi.fn().mockResolvedValue({ success, error: success ? undefined : 'Send failed' }),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('DateRequestService', () => {
  let service: DateRequestService;
  let repository: DateRequestRepository;
  let emailProvider: EmailProvider;

  beforeEach(() => {
    repository = createMockRepository();
    emailProvider = createMockEmailProvider();
    service = new DateRequestService(repository, emailProvider);
  });

  describe('submitDateRequest', () => {
    it('should successfully submit a date request with all fields', async () => {
      const submission: DateRequestSubmission = {
        primaryUserId: 'user-1',
        location: 'Italian restaurant downtown',
        mood: 'Romantic evening',
        preferredDate: '2024-02-14',
        personalNotes: 'Would love to celebrate together',
      };

      const result = await service.submitDateRequest(submission);

      expect(result.success).toBe(true);
      expect(result.dateRequest).toBeDefined();
      expect(result.dateRequest!.status).toBe(DateRequestStatus.SENT);
      expect(emailProvider.sendEmail).toHaveBeenCalledOnce();
    });

    it('should successfully submit a date request with no optional fields', async () => {
      const submission: DateRequestSubmission = {
        primaryUserId: 'user-1',
      };

      const result = await service.submitDateRequest(submission);

      expect(result.success).toBe(true);
      expect(emailProvider.sendEmail).toHaveBeenCalledOnce();
    });

    it('should successfully submit with a flexible timing window', async () => {
      const submission: DateRequestSubmission = {
        primaryUserId: 'user-1',
        windowStart: '2024-02-10',
        windowEnd: '2024-02-17',
      };

      const result = await service.submitDateRequest(submission);

      expect(result.success).toBe(true);
    });

    it('should reject location exceeding 200 characters', async () => {
      const submission: DateRequestSubmission = {
        primaryUserId: 'user-1',
        location: 'x'.repeat(201),
      };

      const result = await service.submitDateRequest(submission);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('VALIDATION_ERROR');
      expect(result.error!.retainedDetails).toEqual(submission);
    });

    it('should reject mood exceeding 200 characters', async () => {
      const submission: DateRequestSubmission = {
        primaryUserId: 'user-1',
        mood: 'x'.repeat(201),
      };

      const result = await service.submitDateRequest(submission);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('VALIDATION_ERROR');
    });

    it('should reject personal notes exceeding 500 characters', async () => {
      const submission: DateRequestSubmission = {
        primaryUserId: 'user-1',
        personalNotes: 'x'.repeat(501),
      };

      const result = await service.submitDateRequest(submission);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('VALIDATION_ERROR');
    });

    it('should fail when no partner is linked', async () => {
      repository = createMockRepository({
        getActivePartnerLink: vi.fn().mockResolvedValue(null),
      });
      service = new DateRequestService(repository, emailProvider);

      const submission: DateRequestSubmission = {
        primaryUserId: 'user-1',
        location: 'Park',
      };

      const result = await service.submitDateRequest(submission);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NO_PARTNER_LINKED');
      expect(result.error!.retainedDetails).toEqual(submission);
      expect(result.error!.message).toContain('no partner is currently linked');
    });

    it('should fail when sharing permissions are revoked', async () => {
      repository = createMockRepository({
        getSharingPreferences: vi.fn().mockResolvedValue({
          id: 'prefs-1',
          primary_user_id: 'user-1',
          emotional_tendencies: true,
          behavioral_patterns: true,
          energy_levels: true,
          communication_guidance: true,
          daily_summaries: true,
          phase_alerts: true,
          partner_reminders: true,
          email_notifications_enabled: false,
          updated_at: '2024-01-01T00:00:00Z',
        }),
      });
      service = new DateRequestService(repository, emailProvider);

      const submission: DateRequestSubmission = {
        primaryUserId: 'user-1',
        mood: 'Fun outing',
      };

      const result = await service.submitDateRequest(submission);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('SHARING_REVOKED');
      expect(result.error!.retainedDetails).toEqual(submission);
      expect(result.error!.message).toContain('sharing permissions are currently revoked');
    });

    it('should handle email delivery failure', async () => {
      emailProvider = createMockEmailProvider(false);
      service = new DateRequestService(repository, emailProvider);

      const submission: DateRequestSubmission = {
        primaryUserId: 'user-1',
        location: 'Beach',
      };

      const result = await service.submitDateRequest(submission);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('EMAIL_DELIVERY_FAILED');
      expect(result.error!.message).toContain('could not be delivered');
      expect(result.error!.retainedDetails).toEqual(submission);
      expect(result.dateRequest!.status).toBe(DateRequestStatus.FAILED);
    });

    it('should use default phase when no cycle data exists', async () => {
      repository = createMockRepository({
        getCurrentCyclePhase: vi.fn().mockResolvedValue(null),
      });
      service = new DateRequestService(repository, emailProvider);

      const submission: DateRequestSubmission = {
        primaryUserId: 'user-1',
        location: 'Cafe',
      };

      const result = await service.submitDateRequest(submission);

      expect(result.success).toBe(true);
      // Should still send email with default phase context
      expect(emailProvider.sendEmail).toHaveBeenCalledOnce();
    });
  });

  describe('retryDateRequest', () => {
    it('should successfully retry a failed date request', async () => {
      const submission: DateRequestSubmission = {
        primaryUserId: 'user-1',
        location: 'Restaurant',
      };

      const result = await service.retryDateRequest('dr-1', submission);

      expect(result.success).toBe(true);
    });

    it('should fail retry when partner is no longer linked', async () => {
      repository = createMockRepository({
        getActivePartnerLink: vi.fn().mockResolvedValue(null),
      });
      service = new DateRequestService(repository, emailProvider);

      const submission: DateRequestSubmission = {
        primaryUserId: 'user-1',
        location: 'Restaurant',
      };

      const result = await service.retryDateRequest('dr-1', submission);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NO_PARTNER_LINKED');
    });
  });
});

describe('buildEmailSections', () => {
  it('should include all specified fields as labeled sections', () => {
    const submission: DateRequestSubmission = {
      primaryUserId: 'user-1',
      location: 'Italian restaurant',
      mood: 'Romantic',
      preferredDate: '2024-02-14',
      personalNotes: 'Looking forward to this',
    };

    const sections = buildEmailSections(submission);

    expect(sections).toHaveLength(4);
    expect(sections[0]).toEqual({ label: 'Preferred Location', content: 'Italian restaurant' });
    expect(sections[1]).toEqual({ label: 'Desired Mood & Vibe', content: 'Romantic' });
    expect(sections[2]).toEqual({ label: 'Timing', content: '2024-02-14' });
    expect(sections[3]).toEqual({ label: 'Personal Notes', content: 'Looking forward to this' });
  });

  it('should only include sections for non-null fields', () => {
    const submission: DateRequestSubmission = {
      primaryUserId: 'user-1',
      location: 'Park',
    };

    const sections = buildEmailSections(submission);

    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe('Preferred Location');
  });

  it('should return empty array when no optional fields are specified', () => {
    const submission: DateRequestSubmission = {
      primaryUserId: 'user-1',
    };

    const sections = buildEmailSections(submission);

    expect(sections).toHaveLength(0);
  });

  it('should format flexible timing window correctly', () => {
    const submission: DateRequestSubmission = {
      primaryUserId: 'user-1',
      windowStart: '2024-02-10',
      windowEnd: '2024-02-17',
    };

    const sections = buildEmailSections(submission);

    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe('Timing');
    expect(sections[0].content).toBe('2024-02-10 to 2024-02-17');
  });

  it('should prefer preferredDate over window dates', () => {
    const submission: DateRequestSubmission = {
      primaryUserId: 'user-1',
      preferredDate: '2024-02-14',
      windowStart: '2024-02-10',
      windowEnd: '2024-02-17',
    };

    const sections = buildEmailSections(submission);

    const timingSection = sections.find((s) => s.label === 'Timing');
    expect(timingSection!.content).toBe('2024-02-14');
  });
});

describe('generatePhaseContext', () => {
  it('should return phase context for each cycle phase', () => {
    const phases = [
      CyclePhase.MENSTRUAL,
      CyclePhase.FOLLICULAR,
      CyclePhase.OVULATION,
      CyclePhase.EARLY_LUTEAL,
      CyclePhase.LATE_LUTEAL,
    ];

    for (const phase of phases) {
      const context = generatePhaseContext(phase);
      expect(context).toBeTruthy();
      expect(context.length).toBeGreaterThan(0);
    }
  });

  it('should use probabilistic language (may, might, could)', () => {
    const phases = [
      CyclePhase.MENSTRUAL,
      CyclePhase.FOLLICULAR,
      CyclePhase.OVULATION,
      CyclePhase.EARLY_LUTEAL,
      CyclePhase.LATE_LUTEAL,
    ];

    for (const phase of phases) {
      const context = generatePhaseContext(phase);
      const hasProbabilistic = /\b(may|might|could|can|potentially|possibly)\b/i.test(context);
      expect(hasProbabilistic).toBe(true);
    }
  });

  it('should include individual variation acknowledgment', () => {
    const phases = [
      CyclePhase.MENSTRUAL,
      CyclePhase.FOLLICULAR,
      CyclePhase.OVULATION,
      CyclePhase.EARLY_LUTEAL,
      CyclePhase.LATE_LUTEAL,
    ];

    for (const phase of phases) {
      const context = generatePhaseContext(phase);
      const hasVariation =
        /\b(each person|every person|individual|unique|may vary|personal|her own|differ)\b/i.test(
          context,
        );
      expect(hasVariation).toBe(true);
    }
  });

  it('should not contain deterministic language', () => {
    const phases = [
      CyclePhase.MENSTRUAL,
      CyclePhase.FOLLICULAR,
      CyclePhase.OVULATION,
      CyclePhase.EARLY_LUTEAL,
      CyclePhase.LATE_LUTEAL,
    ];

    const deterministicPatterns = [
      /\bshe will feel\b/i,
      /\balways\b/i,
      /\bnever\b/i,
      /\bdefinitely\b/i,
      /\bcertainly\b/i,
    ];

    for (const phase of phases) {
      const context = generatePhaseContext(phase);
      for (const pattern of deterministicPatterns) {
        expect(pattern.test(context)).toBe(false);
      }
    }
  });
});

describe('formatDateRequestEmailContent', () => {
  it('should include both sections and phase context', () => {
    const submission: DateRequestSubmission = {
      primaryUserId: 'user-1',
      location: 'Restaurant',
      mood: 'Relaxed',
    };

    const content = formatDateRequestEmailContent(submission, CyclePhase.OVULATION);

    expect(content.sections).toHaveLength(2);
    expect(content.phaseContext).toBeTruthy();
    expect(content.phaseContext.length).toBeGreaterThan(0);
  });

  it('should include phase context even when no optional fields are specified', () => {
    const submission: DateRequestSubmission = {
      primaryUserId: 'user-1',
    };

    const content = formatDateRequestEmailContent(submission, CyclePhase.MENSTRUAL);

    expect(content.sections).toHaveLength(0);
    expect(content.phaseContext).toBeTruthy();
  });
});

describe('formatDateRequestEmailHtml', () => {
  it('should produce valid HTML with all sections', () => {
    const content = formatDateRequestEmailContent(
      {
        primaryUserId: 'user-1',
        location: 'Park',
        mood: 'Fun',
        preferredDate: '2024-03-01',
        personalNotes: 'Excited!',
      },
      CyclePhase.FOLLICULAR,
    );

    const html = formatDateRequestEmailHtml(content, CyclePhase.FOLLICULAR);

    expect(html).toContain('Date Request');
    expect(html).toContain('Preferred Location');
    expect(html).toContain('Park');
    expect(html).toContain('Desired Mood & Vibe');
    expect(html).toContain('Fun');
    expect(html).toContain('Timing');
    expect(html).toContain('2024-03-01');
    expect(html).toContain('Personal Notes');
    expect(html).toContain('Excited!');
    expect(html).toContain('Phase Context');
    expect(html).toContain('Follicular Phase');
  });

  it('should include phase context section in HTML', () => {
    const content = formatDateRequestEmailContent(
      { primaryUserId: 'user-1' },
      CyclePhase.LATE_LUTEAL,
    );

    const html = formatDateRequestEmailHtml(content, CyclePhase.LATE_LUTEAL);

    expect(html).toContain('Phase Context');
    expect(html).toContain('Late Luteal Phase');
  });
});
