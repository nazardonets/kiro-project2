/**
 * Integration tests for critical user flows.
 * These tests verify end-to-end data flow across services,
 * mocking only the database layer (Supabase) while testing
 * actual service interactions.
 *
 * Validates: Requirements 1.1-1.7, 2.1-2.6, 3.1-3.5, 7.1-7.5, 8.1-8.6
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  CyclePhase,
  CycleRecord,
  DeliveryTime,
  InviteStatus,
  NotificationFrequency,
  NotificationLog,
  NotificationStatus,
  PartnerLinkStatus,
  SharingPreferences,
  UserStatus,
} from '@/lib/types';
import {
  AdminRepository,
  AdminEmailService,
  AdminService,
  AdminAccountDetails,
} from '@/services/admin-service';
import { AuthService } from '@/services/auth-service';
import { CycleService, CycleRepository } from '@/services/cycle-service';
import { InviteService } from '@/services/invite-service';
import {
  NotificationService,
  NotificationRepository,
  EmailProvider,
} from '@/services/notification-service';
import { calculateCurrentPhase, generatePredictions } from '@/services/phase-engine';
import { SharingService, SharingRepository } from '@/services/sharing-service';

// ─── Shared Test Helpers ─────────────────────────────────────────────────────

const PRIMARY_USER_ID = 'primary-user-001';
const PARTNER_USER_ID = 'partner-user-001';

function createMockSupabaseClient(overrides: Record<string, unknown> = {}) {
  const mockFrom = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  return {
    from: mockFrom,
    auth: {
      signUp: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    ...overrides,
  } as unknown;
}

// ─── Flow 1: Auth Flow ───────────────────────────────────────────────────────
// register → invite → accept → linked accounts

describe('Integration: Auth Flow', () => {
  it('should complete full auth flow: register → invite → accept → linked accounts', async () => {
    // Step 1: Register Primary User
    const supabase = createMockSupabaseClient();
    const mockSupabase = supabase as ReturnType<typeof createMockSupabaseClient> & {
      auth: { signUp: ReturnType<typeof vi.fn> };
      from: ReturnType<typeof vi.fn>;
    };

    // Mock successful registration
    (mockSupabase as Record<string, any>).auth.signUp.mockResolvedValueOnce({
      data: {
        user: {
          id: PRIMARY_USER_ID,
          email: 'primary@example.com',
          user_metadata: { role: 'primary' },
        },
      },
      error: null,
    });

    const authService = new AuthService(mockSupabase as any);
    const registerResult = await authService.registerPrimaryUser(
      'primary@example.com',
      'SecurePass1',
    );

    expect(registerResult.success).toBe(true);
    expect(registerResult.data?.userId).toBe(PRIMARY_USER_ID);
    expect(registerResult.data?.role).toBe('primary');

    // Step 2: Generate Invite
    const inviteToken = 'test-invite-token-123';
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    // The invite service calls from() multiple times for different tables.
    // We need to track calls and return appropriate chain results.
    let fromCallCount = 0;
    const inviteSupabase = {
      from: vi.fn().mockImplementation(() => {
        fromCallCount++;
        const chain: Record<string, any> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.insert = vi.fn().mockReturnValue(chain);
        chain.update = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);

        if (fromCallCount === 1) {
          // partner_link check: no active link
          chain.single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
        } else if (fromCallCount === 2) {
          // expire pending invites: no single() needed, returns the chain
          chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
        } else if (fromCallCount === 3) {
          // insert new invite
          chain.single = vi.fn().mockResolvedValue({
            data: { id: 'invite-001', token: inviteToken, expires_at: expiresAt },
            error: null,
          });
        }
        return chain;
      }),
    };

    const inviteService = new InviteService(inviteSupabase as any);
    const inviteResult = await inviteService.generateInvite(PRIMARY_USER_ID);

    expect(inviteResult.success).toBe(true);
    expect(inviteResult.data?.id).toBe('invite-001');
    expect(inviteResult.data?.expiresAt).toBe(expiresAt);

    // Step 3: Accept Invite (Partner Registration)
    const acceptChain = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    // Invite lookup returns valid invite
    acceptChain.single.mockResolvedValueOnce({
      data: {
        id: 'invite-001',
        primary_user_id: PRIMARY_USER_ID,
        token: inviteToken,
        expires_at: expiresAt,
        status: InviteStatus.PENDING,
        created_at: new Date().toISOString(),
      },
      error: null,
    });

    // Partner link insert succeeds
    acceptChain.single.mockResolvedValueOnce({ data: null, error: null });
    // Invite status update succeeds
    acceptChain.single.mockResolvedValueOnce({ data: null, error: null });

    const acceptSupabase = {
      from: vi.fn().mockReturnValue(acceptChain),
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: PARTNER_USER_ID,
              email: 'partner@example.com',
              user_metadata: { role: 'partner' },
            },
          },
          error: null,
        }),
      },
    };

    const acceptAuthService = new AuthService(acceptSupabase as any);
    const acceptResult = await acceptAuthService.registerPartnerViaInvite(
      inviteToken,
      'partner@example.com',
      'PartnerPass1',
    );

    expect(acceptResult.success).toBe(true);
    expect(acceptResult.data?.userId).toBe(PARTNER_USER_ID);
    expect(acceptResult.data?.role).toBe('partner');
  });

  it('should reject expired invite during accept flow', async () => {
    const expiredAt = new Date(Date.now() - 1000).toISOString(); // Already expired

    const chain = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValueOnce({
        data: {
          id: 'invite-002',
          primary_user_id: PRIMARY_USER_ID,
          token: 'expired-token',
          expires_at: expiredAt,
          status: InviteStatus.PENDING,
          created_at: new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString(),
        },
        error: null,
      }),
    };

    const supabase = {
      from: vi.fn().mockReturnValue(chain),
      auth: {
        signUp: vi.fn(),
      },
    };

    const authService = new AuthService(supabase as any);
    const result = await authService.registerPartnerViaInvite(
      'expired-token',
      'partner@example.com',
      'PartnerPass1',
    );

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVITE_EXPIRED');
  });

  it('should reject registration with weak password', async () => {
    const supabase = createMockSupabaseClient();
    const authService = new AuthService(supabase as any);

    const result = await authService.registerPrimaryUser('user@example.com', 'weak');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
  });
});

// ─── Flow 2: Cycle Flow ──────────────────────────────────────────────────────
// input date → phase calculation → predictions → partner view

describe('Integration: Cycle Flow', () => {
  let cycleRepository: CycleRepository;
  let cycleService: CycleService;
  const storedRecords: CycleRecord[] = [];

  beforeEach(() => {
    storedRecords.length = 0;

    cycleRepository = {
      getCycleRecords: vi.fn().mockImplementation(() => Promise.resolve([...storedRecords])),
      getCycleRecordById: vi
        .fn()
        .mockImplementation((id: string) =>
          Promise.resolve(storedRecords.find((r) => r.id === id) || null),
        ),
      createCycleRecord: vi
        .fn()
        .mockImplementation((record: Omit<CycleRecord, 'id' | 'created_at'>) => {
          const newRecord: CycleRecord = {
            id: `cycle-${storedRecords.length + 1}`,
            ...record,
            created_at: new Date().toISOString(),
          };
          storedRecords.push(newRecord);
          return Promise.resolve(newRecord);
        }),
      deleteCycleRecord: vi.fn().mockImplementation((id: string) => {
        const idx = storedRecords.findIndex((r) => r.id === id);
        if (idx >= 0) storedRecords.splice(idx, 1);
        return Promise.resolve();
      }),
    };

    cycleService = new CycleService(cycleRepository);
  });

  it('should complete full cycle flow: input date → phase calculation → predictions', async () => {
    // Step 1: Input a cycle start date (10 days ago)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 10);
    const startDateStr = startDate.toISOString().split('T')[0];

    const createResult = await cycleService.createCycleRecord(PRIMARY_USER_ID, startDateStr, 28);

    expect(createResult.success).toBe(true);
    expect(createResult.record).toBeDefined();
    expect(createResult.record?.start_date).toBe(startDateStr);

    // Step 2: Calculate current phase (day 11 = Follicular phase, days 6-13)
    const phaseResult = calculateCurrentPhase(startDate, new Date());

    expect(phaseResult.phase).toBe(CyclePhase.FOLLICULAR);
    expect(phaseResult.elapsedDays).toBe(11);
    expect(phaseResult.isOverdue).toBe(false);
    expect(phaseResult.dayInPhase).toBe(6); // Day 11 - 5 (menstrual) = day 6 in follicular

    // Step 3: Generate 60-day predictions
    const predictions = generatePredictions(startDate, new Date());

    expect(predictions.length).toBeGreaterThan(0);

    // Verify predictions cover exactly 60 days
    const totalDays = predictions.reduce((sum, p) => sum + (p.endDay - p.startDay + 1), 0);
    expect(totalDays).toBe(60);

    // Verify no gaps between predictions
    for (let i = 1; i < predictions.length; i++) {
      expect(predictions[i].startDay).toBe(predictions[i - 1].endDay + 1);
    }

    // Verify first prediction starts at day 1
    expect(predictions[0].startDay).toBe(1);
  });

  it('should use scaled durations when multiple historical records exist', async () => {
    // Add 2 historical records with 30-day cycles
    const date1 = new Date();
    date1.setDate(date1.getDate() - 60);
    const date2 = new Date();
    date2.setDate(date2.getDate() - 30);

    await cycleService.createCycleRecord(PRIMARY_USER_ID, date1.toISOString().split('T')[0], 30);
    await cycleService.createCycleRecord(PRIMARY_USER_ID, date2.toISOString().split('T')[0], 30);

    // Get effective cycle length (should be 30 from average)
    const effectiveLength = await cycleService.getEffectiveCycleLength(PRIMARY_USER_ID);
    expect(effectiveLength).toBe(30);

    // Generate predictions with historical data
    const predictions = generatePredictions(date2, new Date(), {
      historicalCycleLengths: [30, 30],
    });

    // Verify predictions still cover exactly 60 days
    const totalDays = predictions.reduce((sum, p) => sum + (p.endDay - p.startDay + 1), 0);
    expect(totalDays).toBe(60);
  });

  it('should detect cycle overlap conflicts', async () => {
    // Create first record
    const date1 = new Date();
    date1.setDate(date1.getDate() - 15);
    await cycleService.createCycleRecord(PRIMARY_USER_ID, date1.toISOString().split('T')[0], 28);

    // Try to create overlapping record (within 28 days of first)
    const date2 = new Date();
    date2.setDate(date2.getDate() - 10);
    const overlapResult = await cycleService.createCycleRecord(
      PRIMARY_USER_ID,
      date2.toISOString().split('T')[0],
      28,
    );

    expect(overlapResult.success).toBe(false);
    expect(overlapResult.conflict?.hasConflict).toBe(true);
  });

  it('should enforce max 12 historical records', async () => {
    // Fill up to 12 records
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (i * 30 + 30));
      // Directly push to bypass overlap detection
      storedRecords.push({
        id: `cycle-${i}`,
        primary_user_id: PRIMARY_USER_ID,
        start_date: date.toISOString().split('T')[0],
        cycle_length_days: 28,
        created_at: new Date().toISOString(),
      });
    }

    const date13 = new Date();
    date13.setDate(date13.getDate() - 1);
    const result = await cycleService.createCycleRecord(
      PRIMARY_USER_ID,
      date13.toISOString().split('T')[0],
      28,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Maximum of 12');
  });
});

// ─── Flow 3: Sharing Flow ────────────────────────────────────────────────────
// toggle category → partner dashboard updates within 5 seconds

describe('Integration: Sharing Flow', () => {
  let sharingRepository: SharingRepository;
  let sharingService: SharingService;
  let storedPreferences: SharingPreferences;

  beforeEach(() => {
    storedPreferences = {
      id: 'prefs-001',
      primary_user_id: PRIMARY_USER_ID,
      emotional_tendencies: true,
      behavioral_patterns: true,
      energy_levels: true,
      communication_guidance: true,
      daily_summaries: true,
      phase_alerts: true,
      partner_reminders: true,
      email_notifications_enabled: true,
      updated_at: new Date().toISOString(),
    };

    sharingRepository = {
      getSharingPreferences: vi
        .fn()
        .mockImplementation(() => Promise.resolve({ ...storedPreferences })),
      createDefaultPreferences: vi
        .fn()
        .mockImplementation(() => Promise.resolve({ ...storedPreferences })),
      updateSharingPreferences: vi
        .fn()
        .mockImplementation((_userId: string, updates: Partial<SharingPreferences>) => {
          storedPreferences = { ...storedPreferences, ...updates };
          return Promise.resolve({ ...storedPreferences });
        }),
      hasActivePartnerLink: vi.fn().mockResolvedValue(true),
      getPartnerLinkStatus: vi.fn().mockResolvedValue({
        status: PartnerLinkStatus.ACTIVE,
        partner_user_id: PARTNER_USER_ID,
      }),
      updatePartnerLinkStatus: vi.fn().mockResolvedValue(undefined),
    };

    sharingService = new SharingService(sharingRepository);
  });

  it('should toggle a single category independently without affecting others', async () => {
    // Disable emotional_tendencies
    const result = await sharingService.updateCategories(PRIMARY_USER_ID, {
      emotional_tendencies: false,
    });

    expect(result.success).toBe(true);
    expect(result.data?.emotional_tendencies).toBe(false);
    // Other categories remain unchanged
    expect(result.data?.behavioral_patterns).toBe(true);
    expect(result.data?.energy_levels).toBe(true);
    expect(result.data?.communication_guidance).toBe(true);
  });

  it('should toggle notification types independently', async () => {
    // Disable daily_summaries only
    const result = await sharingService.updateNotifications(PRIMARY_USER_ID, {
      daily_summaries: false,
    });

    expect(result.success).toBe(true);
    expect(result.data?.daily_summaries).toBe(false);
    expect(result.data?.phase_alerts).toBe(true);
    expect(result.data?.partner_reminders).toBe(true);
  });

  it('should support disable → re-enable round trip for categories', async () => {
    // Disable
    await sharingService.updateCategories(PRIMARY_USER_ID, {
      energy_levels: false,
    });

    const afterDisable = await sharingService.getPreferences(PRIMARY_USER_ID);
    expect(afterDisable.data?.energy_levels).toBe(false);

    // Re-enable
    await sharingService.updateCategories(PRIMARY_USER_ID, {
      energy_levels: true,
    });

    const afterEnable = await sharingService.getPreferences(PRIMARY_USER_ID);
    expect(afterEnable.data?.energy_levels).toBe(true);
  });

  it('should detect when all categories are disabled', async () => {
    // Disable all categories
    storedPreferences.emotional_tendencies = false;
    storedPreferences.behavioral_patterns = false;
    storedPreferences.energy_levels = false;
    storedPreferences.communication_guidance = false;

    const result = await sharingService.areAllCategoriesDisabled(PRIMARY_USER_ID);

    expect(result.success).toBe(true);
    expect(result.data).toBe(true);
  });

  it('should unlink partner and revoke access while preserving primary data', async () => {
    const unlinkResult = await sharingService.unlinkPartner(PRIMARY_USER_ID);

    expect(unlinkResult.success).toBe(true);
    expect(unlinkResult.data?.unlinkedPartnerId).toBe(PARTNER_USER_ID);
    expect(sharingRepository.updatePartnerLinkStatus).toHaveBeenCalledWith(
      PRIMARY_USER_ID,
      PartnerLinkStatus.UNLINKED,
    );

    // Sharing preferences still exist (primary data preserved)
    const prefs = await sharingService.getPreferences(PRIMARY_USER_ID);
    expect(prefs.success).toBe(true);
    expect(prefs.data).toBeDefined();
  });

  it('should reject category updates when no partner is linked', async () => {
    vi.mocked(sharingRepository.hasActivePartnerLink).mockResolvedValue(false);

    const result = await sharingService.updateCategories(PRIMARY_USER_ID, {
      emotional_tendencies: false,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NO_ACTIVE_PARTNER');
  });
});

// ─── Flow 4: Notification Flow ───────────────────────────────────────────────
// trigger → compose → send → retry on failure

describe('Integration: Notification Flow', () => {
  let notificationRepository: NotificationRepository;
  let emailProvider: EmailProvider;
  let notificationService: NotificationService;
  const notificationLogs: NotificationLog[] = [];

  beforeEach(() => {
    notificationLogs.length = 0;

    notificationRepository = {
      createNotificationLog: vi.fn().mockImplementation((log: Omit<NotificationLog, 'id'>) => {
        const newLog: NotificationLog = { id: `log-${notificationLogs.length + 1}`, ...log };
        notificationLogs.push(newLog);
        return Promise.resolve(newLog);
      }),
      updateNotificationLog: vi
        .fn()
        .mockImplementation((logId: string, updates: Partial<NotificationLog>) => {
          const log = notificationLogs.find((l) => l.id === logId);
          if (log) Object.assign(log, updates);
          return Promise.resolve(log || notificationLogs[0]);
        }),
      getPendingRetries: vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(notificationLogs.filter((l) => l.status === NotificationStatus.FAILED)),
        ),
      wasNotificationSentToday: vi.fn().mockResolvedValue(false),
    };

    emailProvider = {
      sendEmail: vi.fn().mockResolvedValue({ success: true }),
    };

    notificationService = new NotificationService(notificationRepository, emailProvider);
  });

  it('should complete full notification flow: trigger → compose → send', async () => {
    const context = {
      partnerUserId: PARTNER_USER_ID,
      partnerEmail: 'partner@example.com',
      primaryUserId: PRIMARY_USER_ID,
      currentPhase: CyclePhase.FOLLICULAR,
      notificationPreferences: {
        id: 'notif-prefs-001',
        partner_user_id: PARTNER_USER_ID,
        frequency: NotificationFrequency.DAILY,
        delivery_time: DeliveryTime.MORNING,
        reminders_enabled: false,
        reminder_time: '09:00',
        timezone: 'America/New_York',
        updated_at: new Date().toISOString(),
      },
      sharingPreferences: {
        id: 'prefs-001',
        primary_user_id: PRIMARY_USER_ID,
        emotional_tendencies: true,
        behavioral_patterns: true,
        energy_levels: true,
        communication_guidance: true,
        daily_summaries: true,
        phase_alerts: true,
        partner_reminders: true,
        email_notifications_enabled: true,
        updated_at: new Date().toISOString(),
      },
    };

    // Step 1: Check if notification should be sent
    const shouldSend = await notificationService.shouldSendNotification(context, 'daily');
    expect(shouldSend).toBe(true);

    // Step 2: Compose email content
    const content = notificationService.composeEmailContent(CyclePhase.FOLLICULAR);
    expect(content.phaseSummary).toContain('Follicular');
    expect(content.insights.length).toBeGreaterThanOrEqual(1);
    expect(content.insights.length).toBeLessThanOrEqual(3);
    expect(content.doRecommendations.length).toBeGreaterThanOrEqual(1);
    expect(content.doRecommendations.length).toBeLessThanOrEqual(3);
    expect(content.dontRecommendations.length).toBeGreaterThanOrEqual(1);
    expect(content.dontRecommendations.length).toBeLessThanOrEqual(3);
    expect(content.interactionGuidance).toBeDefined();

    // Step 3: Send notification
    const sendResult = await notificationService.sendNotification(context);
    expect(sendResult.success).toBe(true);
    expect(sendResult.notificationLogId).toBeDefined();
    expect(emailProvider.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'partner@example.com',
        subject: expect.stringContaining('Follicular'),
      }),
    );
  });

  it('should retry on failure up to 3 times then mark as failed', async () => {
    // Make email provider always fail
    vi.mocked(emailProvider.sendEmail).mockResolvedValue({
      success: false,
      error: 'SMTP connection refused',
    });

    const context = {
      partnerUserId: PARTNER_USER_ID,
      partnerEmail: 'partner@example.com',
      primaryUserId: PRIMARY_USER_ID,
      currentPhase: CyclePhase.MENSTRUAL,
      notificationPreferences: {
        id: 'notif-prefs-001',
        partner_user_id: PARTNER_USER_ID,
        frequency: NotificationFrequency.DAILY,
        delivery_time: DeliveryTime.MORNING,
        reminders_enabled: false,
        reminder_time: '09:00',
        timezone: 'America/New_York',
        updated_at: new Date().toISOString(),
      },
      sharingPreferences: {
        id: 'prefs-001',
        primary_user_id: PRIMARY_USER_ID,
        emotional_tendencies: true,
        behavioral_patterns: true,
        energy_levels: true,
        communication_guidance: true,
        daily_summaries: true,
        phase_alerts: true,
        partner_reminders: true,
        email_notifications_enabled: true,
        updated_at: new Date().toISOString(),
      },
    };

    // Initial send fails
    const sendResult = await notificationService.sendNotification(context);
    expect(sendResult.success).toBe(false);
    expect(sendResult.error?.code).toBe('EMAIL_DELIVERY_FAILED');

    // Simulate retry attempts (up to 3)
    const logId = sendResult.notificationLogId!;
    const retry1 = await notificationService.retryNotification(logId, context);
    expect(retry1.success).toBe(false);

    const retry2 = await notificationService.retryNotification(logId, context);
    expect(retry2.success).toBe(false);

    const retry3 = await notificationService.retryNotification(logId, context);
    expect(retry3.success).toBe(false);

    // Verify email was attempted multiple times
    expect(emailProvider.sendEmail).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  it('should not send notification when email notifications are disabled', async () => {
    const context = {
      partnerUserId: PARTNER_USER_ID,
      partnerEmail: 'partner@example.com',
      primaryUserId: PRIMARY_USER_ID,
      currentPhase: CyclePhase.OVULATION,
      notificationPreferences: {
        id: 'notif-prefs-001',
        partner_user_id: PARTNER_USER_ID,
        frequency: NotificationFrequency.DAILY,
        delivery_time: DeliveryTime.MORNING,
        reminders_enabled: false,
        reminder_time: '09:00',
        timezone: 'America/New_York',
        updated_at: new Date().toISOString(),
      },
      sharingPreferences: {
        id: 'prefs-001',
        primary_user_id: PRIMARY_USER_ID,
        emotional_tendencies: true,
        behavioral_patterns: true,
        energy_levels: true,
        communication_guidance: true,
        daily_summaries: true,
        phase_alerts: true,
        partner_reminders: true,
        email_notifications_enabled: false, // Disabled by primary user
        updated_at: new Date().toISOString(),
      },
    };

    const shouldSend = await notificationService.shouldSendNotification(context, 'daily');
    expect(shouldSend).toBe(false);
  });

  it('should validate email content structure', () => {
    const content = notificationService.composeEmailContent(CyclePhase.LATE_LUTEAL);

    const isValid = notificationService.validateEmailContent(content);
    expect(isValid).toBe(true);
  });
});

// ─── Flow 5: Admin Flow ──────────────────────────────────────────────────────
// search → suspend → cascade to partner

describe('Integration: Admin Flow', () => {
  let adminRepository: AdminRepository;
  let adminEmailService: AdminEmailService;
  let adminService: AdminService;

  const mockUsers: AdminAccountDetails[] = [
    {
      id: PRIMARY_USER_ID,
      email: 'primary@example.com',
      role: 'primary',
      status: UserStatus.ACTIVE,
      suspension_reason: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      partner_link: {
        status: PartnerLinkStatus.ACTIVE,
        partner_user_id: PARTNER_USER_ID,
        linked_at: '2024-01-15T00:00:00Z',
      },
    },
    {
      id: PARTNER_USER_ID,
      email: 'partner@example.com',
      role: 'partner',
      status: UserStatus.ACTIVE,
      suspension_reason: null,
      created_at: '2024-01-15T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z',
      partner_link: null,
    },
  ];

  beforeEach(() => {
    adminRepository = {
      searchUsers: vi.fn().mockImplementation((query: string, limit: number) => {
        const results = mockUsers.filter((u) => u.email.includes(query) || u.id.includes(query));
        return Promise.resolve(results.slice(0, limit));
      }),
      getUserById: vi
        .fn()
        .mockImplementation((userId: string) =>
          Promise.resolve(mockUsers.find((u) => u.id === userId) || null),
        ),
      getUserBasicInfo: vi.fn().mockImplementation((userId: string) => {
        const user = mockUsers.find((u) => u.id === userId);
        if (!user) return Promise.resolve(null);
        return Promise.resolve({
          id: user.id,
          email: user.email,
          status: user.status,
        });
      }),
      suspendUser: vi.fn().mockResolvedValue(undefined),
      getActivePartnerLink: vi.fn().mockImplementation((userId: string) => {
        const user = mockUsers.find((u) => u.id === userId);
        if (user?.partner_link?.status === PartnerLinkStatus.ACTIVE) {
          return Promise.resolve({
            partner_user_id: user.partner_link.partner_user_id,
            status: user.partner_link.status,
          });
        }
        return Promise.resolve(null);
      }),
      revokePartnerLink: vi.fn().mockResolvedValue(undefined),
      disableSharingPreferences: vi.fn().mockResolvedValue(undefined),
      revokeUserSessions: vi.fn().mockResolvedValue(undefined),
      deleteCycleRecords: vi.fn().mockResolvedValue(5),
      deletePersonalNotes: vi.fn().mockResolvedValue(3),
      deleteSurveyResponses: vi.fn().mockResolvedValue(6),
      deleteSharingPreferences: vi.fn().mockResolvedValue(1),
      deleteDailySummaries: vi.fn().mockResolvedValue(10),
      deleteDateRequests: vi.fn().mockResolvedValue(2),
      deactivatePartner: vi.fn().mockResolvedValue(undefined),
      deleteUser: vi.fn().mockResolvedValue(undefined),
    };

    adminEmailService = {
      sendSuspensionNotification: vi.fn().mockResolvedValue(true),
    };

    adminService = new AdminService(adminRepository, adminEmailService);
  });

  it('should complete full admin flow: search → suspend → cascade to partner', async () => {
    // Step 1: Search for user
    const searchResult = await adminService.searchUsers('primary@example.com');

    expect(searchResult.success).toBe(true);
    expect(searchResult.data).toHaveLength(1);
    expect(searchResult.data![0].id).toBe(PRIMARY_USER_ID);
    expect(searchResult.data![0].partner_link?.status).toBe(PartnerLinkStatus.ACTIVE);

    // Step 2: Suspend the primary user
    const suspendResult = await adminService.suspendAccount(
      PRIMARY_USER_ID,
      'Violation of terms of service',
    );

    expect(suspendResult.success).toBe(true);
    expect(suspendResult.data?.suspended).toBe(true);
    expect(suspendResult.data?.emailSent).toBe(true);

    // Step 3: Verify cascade to partner
    // Partner link should be revoked
    expect(adminRepository.revokePartnerLink).toHaveBeenCalledWith(PRIMARY_USER_ID);
    // Sharing preferences should be disabled
    expect(adminRepository.disableSharingPreferences).toHaveBeenCalledWith(PRIMARY_USER_ID);
    // Partner sessions should be revoked
    expect(adminRepository.revokeUserSessions).toHaveBeenCalledWith(PARTNER_USER_ID);
    // Primary user sessions should be revoked
    expect(adminRepository.revokeUserSessions).toHaveBeenCalledWith(PRIMARY_USER_ID);
    // Suspension notification email should be sent
    expect(adminEmailService.sendSuspensionNotification).toHaveBeenCalledWith(
      'primary@example.com',
      'Violation of terms of service',
    );
  });

  it('should enforce max 50 search results', async () => {
    // Create 60 mock users
    const manyUsers = Array.from({ length: 60 }, (_, i) => ({
      id: `user-${i}`,
      email: `user${i}@example.com`,
      role: 'primary',
      status: UserStatus.ACTIVE,
      suspension_reason: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      partner_link: null,
    })) as AdminAccountDetails[];

    vi.mocked(adminRepository.searchUsers).mockImplementation((_query: string, limit: number) =>
      Promise.resolve(manyUsers.slice(0, limit)),
    );

    const result = await adminService.searchUsers('example.com');

    expect(result.success).toBe(true);
    expect(result.data!.length).toBeLessThanOrEqual(50);
  });

  it('should not cascade to partner when suspending user without partner link', async () => {
    vi.mocked(adminRepository.getUserBasicInfo).mockResolvedValue({
      id: 'solo-user',
      email: 'solo@example.com',
      status: UserStatus.ACTIVE,
    });
    vi.mocked(adminRepository.getActivePartnerLink).mockResolvedValue(null);

    const result = await adminService.suspendAccount('solo-user', 'Some reason');

    expect(result.success).toBe(true);
    expect(adminRepository.revokePartnerLink).not.toHaveBeenCalled();
    expect(adminRepository.disableSharingPreferences).not.toHaveBeenCalled();
  });

  it('should delete account with full cascade including partner access revocation', async () => {
    const result = await adminService.deleteAccount(PRIMARY_USER_ID, true);

    expect(result.success).toBe(true);
    expect(result.data?.cycleRecordsDeleted).toBe(5);
    expect(result.data?.personalNotesDeleted).toBe(3);
    expect(result.data?.surveyResponsesDeleted).toBe(6);
    expect(result.data?.sharingPreferencesDeleted).toBe(1);
    expect(result.data?.dailySummariesDeleted).toBe(10);
    expect(result.data?.dateRequestsDeleted).toBe(2);
    expect(result.data?.partnerAccessRevoked).toBe(true);
    expect(adminRepository.deactivatePartner).toHaveBeenCalledWith(PARTNER_USER_ID);
    expect(adminRepository.deleteUser).toHaveBeenCalledWith(PRIMARY_USER_ID);
  });

  it('should require confirmation before deletion', async () => {
    const result = await adminService.deleteAccount(PRIMARY_USER_ID, false);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('DELETION_NOT_CONFIRMED');
    expect(adminRepository.deleteUser).not.toHaveBeenCalled();
  });
});
