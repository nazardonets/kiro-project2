import { MAX_NOTIFICATION_RETRIES, RETRY_INTERVAL_MINUTES } from '@/lib/constants';
import {
  CyclePhase,
  DeliveryTime,
  NotificationFrequency,
  NotificationLog,
  NotificationPreferences,
  NotificationStatus,
  NotificationType,
  SharingPreferences,
  SurveyResponse,
} from '@/lib/types';
import { GuidanceService } from '@/services/guidance-service';
import { InsightsService } from '@/services/insights-service';
import type { PhaseInsights } from '@/services/insights-service';

// ─── Email Content Types ────────────────────────────────────────────────────

/**
 * Structured email content for partner notifications.
 * Contains all required sections per Requirements 17.1-17.4.
 */
export interface EmailNotificationContent {
  /** Current phase name and summary (max 3 sentences) */
  phaseSummary: string;
  /** 1-3 emotional/behavioral insights for the current phase */
  insights: string[];
  /** 1-3 "Do" recommendations */
  doRecommendations: string[];
  /** 1-3 "Don't" recommendations */
  dontRecommendations: string[];
  /** Interaction guidance (max 2 sentences) */
  interactionGuidance: string;
}

/**
 * Full email payload ready for dispatch via Resend.
 */
export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  content: EmailNotificationContent;
}

/**
 * Result of a notification dispatch attempt.
 */
export interface NotificationDispatchResult {
  success: boolean;
  notificationLogId?: string;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Context required to determine if a notification should be sent.
 */
export interface NotificationContext {
  partnerUserId: string;
  partnerEmail: string;
  primaryUserId: string;
  currentPhase: CyclePhase;
  notificationPreferences: NotificationPreferences;
  sharingPreferences: SharingPreferences;
  surveyResponses?: SurveyResponse[];
  previousPhase?: CyclePhase;
}

// ─── Notification Repository Interface ──────────────────────────────────────

/**
 * Typed interface for database access (dependency injection).
 * Allows the NotificationService to remain framework-agnostic.
 */
export interface NotificationRepository {
  /** Create a notification log entry */
  createNotificationLog(log: Omit<NotificationLog, 'id'>): Promise<NotificationLog>;

  /** Update a notification log entry */
  updateNotificationLog(
    logId: string,
    updates: Partial<Pick<NotificationLog, 'status' | 'retry_count' | 'next_retry_at' | 'sent_at'>>,
  ): Promise<NotificationLog>;

  /** Get pending retry notifications */
  getPendingRetries(partnerUserId: string): Promise<NotificationLog[]>;

  /** Check if a notification was already sent today for a given type */
  wasNotificationSentToday(partnerUserId: string, type?: NotificationType): Promise<boolean>;
}

/**
 * Interface for the email sending provider (Resend).
 * Abstracted for testability.
 */
export interface EmailProvider {
  /** Send an email and return success/failure */
  sendEmail(payload: {
    to: string;
    subject: string;
    html: string;
  }): Promise<{ success: boolean; error?: string }>;
}

// ─── Phase Summary Content ──────────────────────────────────────────────────

/**
 * Phase summaries for email notifications (max 3 sentences each).
 * Uses probabilistic framing per Requirement 19.
 */
const PHASE_SUMMARIES: Record<CyclePhase, string> = {
  [CyclePhase.MENSTRUAL]:
    "She's currently in her Menstrual Phase. Energy may be at its lowest, with tendencies toward introspection and quiet reflection. Gentle support and patience are likely to be most appreciated.",
  [CyclePhase.FOLLICULAR]:
    "She's currently in her Follicular Phase. Energy is likely building, with growing optimism and curiosity. This can be a time of renewed motivation and openness to new experiences.",
  [CyclePhase.OVULATION]:
    "She's currently in her Ovulation Phase. Energy may be at its peak, with heightened confidence and social warmth. Connection and shared activities could feel especially rewarding.",
  [CyclePhase.EARLY_LUTEAL]:
    "She's currently in her Early Luteal Phase. Energy may be steady and focused, with a preference for productivity and structure. Respecting her routines can be supportive.",
  [CyclePhase.LATE_LUTEAL]:
    "She's currently in her Late Luteal Phase. Emotional sensitivity may be heightened and energy could be lower. Extra patience and understanding may go a long way.",
};

/**
 * Interaction guidance for each phase (max 2 sentences each).
 * Uses collaborative framing per Requirement 19.
 */
const INTERACTION_GUIDANCE: Record<CyclePhase, string> = {
  [CyclePhase.MENSTRUAL]:
    'Consider keeping interactions gentle and low-pressure. Being present without demanding engagement may feel most supportive.',
  [CyclePhase.FOLLICULAR]:
    'You might match her growing energy with enthusiasm and openness. This could be a great time for collaborative planning or trying something new together.',
  [CyclePhase.OVULATION]:
    'Consider being more expressive and emotionally available. She may especially appreciate deeper conversations and quality time together.',
  [CyclePhase.EARLY_LUTEAL]:
    'You might support her focus by being clear and purposeful in communication. Respecting her need for structure can strengthen your connection.',
  [CyclePhase.LATE_LUTEAL]:
    'Consider leading with empathy and patience in all interactions. Validating her feelings without trying to fix them may be most helpful.',
};

// ─── Retry State Calculation ────────────────────────────────────────────────

/**
 * Result of calculating the retry state for a failed notification delivery.
 */
export interface DeliveryAttemptResult {
  /** The updated retry count (clamped to MAX_NOTIFICATION_RETRIES) */
  retry_count: number;
  /** The notification status after this attempt */
  status: NotificationStatus;
  /** The next retry time, or null if no more retries are allowed */
  next_retry_at: Date | null;
}

/**
 * Calculate the retry state for a failed notification delivery.
 *
 * Given the current retry count and the current time, determines:
 * - Whether more retries are allowed (max 3)
 * - The next retry time (5 minutes from current time) if retries remain
 * - The appropriate status (retrying if under limit, failed if at/over limit)
 *
 * Invariants:
 * - retry_count never exceeds MAX_NOTIFICATION_RETRIES (3)
 * - After 3 retries, status is 'failed' and next_retry_at is null
 * - Before 3 retries, next_retry_at is exactly 5 minutes from currentTime
 *
 * @param currentRetryCount - The number of retries already attempted (0-based)
 * @param currentTime - The current timestamp
 * @returns DeliveryAttemptResult with updated retry state
 *
 * Validates: Requirement 17.11
 */
export function calculateRetryState(
  currentRetryCount: number,
  currentTime: Date,
): DeliveryAttemptResult {
  // Increment the retry count for this new attempt
  const newRetryCount = Math.min(currentRetryCount + 1, MAX_NOTIFICATION_RETRIES);

  // If we've reached or exceeded the max retries, mark as permanently failed
  if (newRetryCount >= MAX_NOTIFICATION_RETRIES) {
    return {
      retry_count: MAX_NOTIFICATION_RETRIES,
      status: NotificationStatus.FAILED,
      next_retry_at: null,
    };
  }

  // Otherwise, schedule the next retry at 5-minute interval
  const nextRetryAt = new Date(currentTime.getTime() + RETRY_INTERVAL_MINUTES * 60 * 1000);

  return {
    retry_count: newRetryCount,
    status: NotificationStatus.RETRYING,
    next_retry_at: nextRetryAt,
  };
}

// ─── Partner Reminder Types ─────────────────────────────────────────────────

/**
 * Parameters for checking partner reminder eligibility.
 * Encapsulates all conditions that determine whether a reminder should be sent.
 *
 * Validates: Requirements 18.1, 18.4, 18.5, 18.6
 */
export interface PartnerReminderCheckParams {
  /** The current cycle phase */
  phase: CyclePhase;
  /** Whether the partner has reminders enabled (Req 18.2) */
  reminders_enabled: boolean;
  /** Whether the primary user has enabled partner reminders via sharing controls (Req 18.6) */
  partner_reminders: boolean;
  /** Today's reminder logs — if non-empty, a reminder was already sent today (Req 18.4) */
  todayReminderLogs: NotificationLog[];
}

/**
 * Result of a partner reminder eligibility check.
 */
export interface PartnerReminderResult {
  /** Whether the reminder should be sent */
  sent: boolean;
  /** Reason the reminder was not sent (if sent is false) */
  reason?: string;
}

/**
 * Determine whether the given cycle phase is a high-energy phase
 * (Ovulation or Follicular), which are the only phases during which
 * partner reminders are eligible to be sent.
 *
 * Validates: Requirements 18.1, 18.5
 */
export function isHighEnergyPhase(phase: CyclePhase): boolean {
  return phase === CyclePhase.OVULATION || phase === CyclePhase.FOLLICULAR;
}

/**
 * Check whether a partner reminder is eligible to be sent based on all conditions.
 *
 * A reminder is sent if and only if ALL of:
 * - The current phase is Ovulation or Follicular (high-energy) — Req 18.1, 18.5
 * - The partner has reminders enabled — Req 18.2
 * - The primary user has not disabled partner reminders via sharing controls — Req 18.6
 * - No reminder has already been sent today — Req 18.4
 *
 * Validates: Requirements 18.1, 18.4, 18.5, 18.6
 */
export function checkPartnerReminderEligibility(
  params: PartnerReminderCheckParams,
): PartnerReminderResult {
  const { phase, reminders_enabled, partner_reminders, todayReminderLogs } = params;

  if (!isHighEnergyPhase(phase)) {
    return {
      sent: false,
      reason: 'Current phase is not a high-energy phase (Ovulation or Follicular)',
    };
  }

  if (!reminders_enabled) {
    return { sent: false, reason: 'Partner has reminders disabled' };
  }

  if (!partner_reminders) {
    return {
      sent: false,
      reason: 'Primary user has disabled partner reminders via sharing controls',
    };
  }

  if (todayReminderLogs.length > 0) {
    return { sent: false, reason: 'A reminder was already sent today' };
  }

  return { sent: true };
}

// ─── NotificationService ────────────────────────────────────────────────────

/**
 * NotificationService handles email notification composition, scheduling, dispatch,
 * and retry logic.
 *
 * Responsibilities:
 * - Compose structured email content with phase summary, insights, recommendations, and guidance
 * - Support notification frequency: daily, phase-based, custom timing
 * - Respect Primary_User enable/disable of email notifications via sharing preferences
 * - Dispatch emails via Resend
 * - Track notification delivery status
 * - Retry failed deliveries up to 3 times with 5-minute intervals (Req 17.11)
 * - Mark notifications as failed after 3 unsuccessful attempts
 * - Provide undelivered notification queries for dashboard indicators
 *
 * Framework-agnostic: database access and email provider are injected via interfaces.
 *
 * Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10, 17.11
 */
export class NotificationService {
  private readonly insightsService: InsightsService;
  private readonly guidanceService: GuidanceService;

  constructor(
    private readonly repository: NotificationRepository,
    private readonly emailProvider: EmailProvider,
  ) {
    this.insightsService = new InsightsService();
    this.guidanceService = new GuidanceService();
  }

  // ─── Email Content Composition ──────────────────────────────────────────

  /**
   * Compose structured email notification content for the current phase.
   *
   * Content structure:
   * - Phase name + summary (max 3 sentences) — Req 17.1
   * - 1-3 emotional/behavioral insights — Req 17.2
   * - 1-3 "Do" recommendations — Req 17.3
   * - 1-3 "Don't" recommendations — Req 17.3
   * - Interaction guidance (max 2 sentences) — Req 17.4
   *
   * @param phase - The current cycle phase
   * @param surveyResponses - Optional survey responses for calibration
   * @returns EmailNotificationContent with all required sections
   */
  composeEmailContent(
    phase: CyclePhase,
    surveyResponses?: SurveyResponse[],
  ): EmailNotificationContent {
    // Get insights for the phase
    const insights = surveyResponses
      ? this.insightsService.generateCalibratedInsights(phase, surveyResponses)
      : this.insightsService.generateBaseInsights(phase);

    // Get guidance for the phase
    const guidance = surveyResponses
      ? this.guidanceService.generateCalibratedGuidance(phase, surveyResponses)
      : this.guidanceService.generateBaseGuidance(phase);

    // Select 1-3 insights from emotional and behavioral tendencies
    const selectedInsights = this.selectInsights(insights);

    // Select 1-3 "Do" recommendations from supportive actions
    const doRecommendations = guidance.supportiveActions.slice(0, 3);

    // Select 1-3 "Don't" recommendations from triggers to avoid
    const dontRecommendations = guidance.triggersToAvoid.slice(0, 3);

    return {
      phaseSummary: PHASE_SUMMARIES[phase],
      insights: selectedInsights,
      doRecommendations,
      dontRecommendations,
      interactionGuidance: INTERACTION_GUIDANCE[phase],
    };
  }

  /**
   * Select 1-3 insights from phase insights content.
   * Combines emotional and behavioral tendencies.
   */
  private selectInsights(insights: PhaseInsights): string[] {
    const combined = [
      ...insights.emotionalTendencies.slice(0, 2),
      ...insights.behavioralTendencies.slice(0, 1),
    ];
    return combined.slice(0, 3);
  }

  // ─── Email Formatting ───────────────────────────────────────────────────

  /**
   * Format email notification content as HTML for delivery.
   *
   * @param content - The structured email content
   * @param phase - The current cycle phase (for display name)
   * @returns HTML string for the email body
   */
  formatEmailHtml(content: EmailNotificationContent, phase: CyclePhase): string {
    const phaseName = this.formatPhaseName(phase);
    const insightsHtml = content.insights.map((i) => `<li>${i}</li>`).join('');
    const doHtml = content.doRecommendations.map((d) => `<li>${d}</li>`).join('');
    const dontHtml = content.dontRecommendations.map((d) => `<li>${d}</li>`).join('');

    return `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h1>${phaseName}</h1>
  <p>${content.phaseSummary}</p>

  <h2>Insights</h2>
  <ul>${insightsHtml}</ul>

  <h2>Do</h2>
  <ul>${doHtml}</ul>

  <h2>Don't</h2>
  <ul>${dontHtml}</ul>

  <h2>Interaction Guidance</h2>
  <p>${content.interactionGuidance}</p>
</div>`;
  }

  /**
   * Format a CyclePhase enum value as a human-readable phase name.
   */
  private formatPhaseName(phase: CyclePhase): string {
    switch (phase) {
      case CyclePhase.MENSTRUAL:
        return 'Menstrual Phase';
      case CyclePhase.FOLLICULAR:
        return 'Follicular Phase';
      case CyclePhase.OVULATION:
        return 'Ovulation Phase';
      case CyclePhase.EARLY_LUTEAL:
        return 'Early Luteal Phase';
      case CyclePhase.LATE_LUTEAL:
        return 'Late Luteal Phase';
    }
  }

  // ─── Notification Scheduling ────────────────────────────────────────────

  /**
   * Determine whether a notification should be sent based on frequency,
   * preferences, and whether one was already sent today.
   *
   * @param context - The notification context
   * @param trigger - The trigger type ('daily' or 'phase_change')
   * @returns Whether the notification should be sent
   *
   * Validates: Requirements 17.5, 17.6, 17.7, 17.8, 17.9
   */
  async shouldSendNotification(
    context: NotificationContext,
    trigger: 'daily' | 'phase_change',
  ): Promise<boolean> {
    // Check if email notifications are disabled by Primary_User (Req 17.8, 17.9)
    if (!context.sharingPreferences.email_notifications_enabled) {
      return false;
    }

    const { frequency } = context.notificationPreferences;

    if (frequency === NotificationFrequency.PHASE_BASED) {
      // Phase-based: only send on phase change (Req 17.7)
      if (trigger !== 'phase_change') {
        return false;
      }
      // Must have an actual phase change
      if (!context.previousPhase || context.previousPhase === context.currentPhase) {
        return false;
      }
      return true;
    }

    if (frequency === NotificationFrequency.DAILY || frequency === NotificationFrequency.CUSTOM) {
      // Daily/Custom: only send on daily trigger (Req 17.6)
      if (trigger !== 'daily') {
        return false;
      }
      // Check if already sent today
      const alreadySent = await this.repository.wasNotificationSentToday(context.partnerUserId);
      return !alreadySent;
    }

    return false;
  }

  /**
   * Check if the current hour falls within the delivery window for the given preferences.
   *
   * - Phase-based frequency: always eligible (send immediately on phase change)
   * - Daily/Custom with morning delivery: 6-9 AM (hours 6, 7, 8)
   * - Daily/Custom with evening delivery: 6-9 PM (hours 18, 19, 20)
   *
   * @param preferences - The notification preferences
   * @param currentHour - The current hour (0-23) in the partner's timezone
   * @returns Whether the current time is within the delivery window
   *
   * Validates: Requirements 17.5
   */
  isWithinDeliveryWindow(preferences: NotificationPreferences, currentHour: number): boolean {
    // Phase-based notifications are sent immediately regardless of time
    if (preferences.frequency === NotificationFrequency.PHASE_BASED) {
      return true;
    }

    // Daily and Custom respect delivery time windows
    if (preferences.delivery_time === DeliveryTime.MORNING) {
      return currentHour >= 6 && currentHour < 9;
    }

    if (preferences.delivery_time === DeliveryTime.EVENING) {
      return currentHour >= 18 && currentHour < 21;
    }

    return false;
  }

  // ─── Email Dispatch and Retry Logic ─────────────────────────────────────

  /**
   * Send a notification email and track the delivery status.
   *
   * On success: logs with status 'sent'.
   * On failure: logs with status 'failed' and schedules retry.
   *
   * @param context - The notification context
   * @returns Dispatch result with success flag and notification log ID
   *
   * Validates: Requirements 17.1-17.11
   */
  async sendNotification(context: NotificationContext): Promise<NotificationDispatchResult> {
    // Compose email content
    const content = this.composeEmailContent(context.currentPhase, context.surveyResponses);

    // Format HTML
    const html = this.formatEmailHtml(content, context.currentPhase);

    // Determine notification type
    const notificationType = this.getNotificationType(context.notificationPreferences.frequency);

    // Create notification log entry
    const log = await this.repository.createNotificationLog({
      partner_user_id: context.partnerUserId,
      type: notificationType,
      status: NotificationStatus.RETRYING,
      retry_count: 0,
      sent_at: new Date().toISOString(),
      next_retry_at: null,
    });

    // Dispatch email
    const phaseName = this.formatPhaseName(context.currentPhase);
    const result = await this.emailProvider.sendEmail({
      to: context.partnerEmail,
      subject: `Cycle Update: ${phaseName}`,
      html,
    });

    if (result.success) {
      // Update log to sent
      await this.repository.updateNotificationLog(log.id, {
        status: NotificationStatus.SENT,
        sent_at: new Date().toISOString(),
      });

      return {
        success: true,
        notificationLogId: log.id,
      };
    }

    // Mark for retry — schedule first retry at 5-minute interval
    const nextRetryAt = new Date(Date.now() + RETRY_INTERVAL_MINUTES * 60 * 1000).toISOString();

    await this.repository.updateNotificationLog(log.id, {
      status: NotificationStatus.FAILED,
      retry_count: 1,
      next_retry_at: nextRetryAt,
    });

    return {
      success: false,
      notificationLogId: log.id,
      error: {
        code: 'EMAIL_DELIVERY_FAILED',
        message: result.error || 'Failed to deliver email notification.',
      },
    };
  }

  /**
   * Retry a failed notification delivery.
   *
   * Retries up to MAX_NOTIFICATION_RETRIES (3) times with RETRY_INTERVAL_MINUTES (5)
   * between attempts. After all retries fail, marks as permanently failed.
   *
   * @param logId - The notification log ID to retry
   * @param context - The notification context
   * @returns Dispatch result
   *
   * Validates: Requirement 17.11
   */
  async retryNotification(
    logId: string,
    context: NotificationContext,
  ): Promise<NotificationDispatchResult> {
    // Compose and send
    const content = this.composeEmailContent(context.currentPhase, context.surveyResponses);
    const html = this.formatEmailHtml(content, context.currentPhase);
    const phaseName = this.formatPhaseName(context.currentPhase);

    const result = await this.emailProvider.sendEmail({
      to: context.partnerEmail,
      subject: `Cycle Update: ${phaseName}`,
      html,
    });

    if (result.success) {
      await this.repository.updateNotificationLog(logId, {
        status: NotificationStatus.SENT,
        sent_at: new Date().toISOString(),
        next_retry_at: null,
      });

      return {
        success: true,
        notificationLogId: logId,
      };
    }

    // Failed — schedule next retry at 5-minute interval
    const nextRetryAt = new Date(Date.now() + RETRY_INTERVAL_MINUTES * 60 * 1000).toISOString();

    await this.repository.updateNotificationLog(logId, {
      status: NotificationStatus.FAILED,
      next_retry_at: nextRetryAt,
    });

    return {
      success: false,
      notificationLogId: logId,
      error: {
        code: 'EMAIL_DELIVERY_FAILED',
        message: result.error || 'Retry failed. Will attempt again if retries remain.',
      },
    };
  }

  /**
   * Process all pending notification retries for a partner.
   *
   * Finds notifications that are due for retry and attempts redelivery.
   * - Skips retries that are not yet due (next_retry_at is in the future)
   * - Marks as permanently failed after MAX_NOTIFICATION_RETRIES (3) attempts
   * - Retries delivery for eligible notifications with 5-minute intervals
   *
   * @param context - The notification context
   * @returns Array of dispatch results
   *
   * Validates: Requirement 17.11
   */
  async processPendingRetries(context: NotificationContext): Promise<NotificationDispatchResult[]> {
    const pendingRetries = await this.repository.getPendingRetries(context.partnerUserId);
    const results: NotificationDispatchResult[] = [];
    const now = new Date();

    for (const log of pendingRetries) {
      // Check if max retries exceeded (3 retries max)
      if (log.retry_count >= MAX_NOTIFICATION_RETRIES) {
        await this.repository.updateNotificationLog(log.id, {
          status: NotificationStatus.FAILED,
          next_retry_at: null,
        });
        results.push({
          success: false,
          notificationLogId: log.id,
          error: {
            code: 'MAX_RETRIES_EXCEEDED',
            message: `Notification failed after ${MAX_NOTIFICATION_RETRIES} retry attempts.`,
          },
        });
        continue;
      }

      // Check if it's time to retry (5-minute interval)
      if (log.next_retry_at && new Date(log.next_retry_at) > now) {
        continue; // Not yet time to retry
      }

      // Attempt retry
      const result = await this.retryNotification(log.id, context);

      // Increment retry count if failed
      if (!result.success) {
        await this.repository.updateNotificationLog(log.id, {
          retry_count: log.retry_count + 1,
        });
      }

      results.push(result);
    }

    return results;
  }

  // ─── Notification Type Helpers ──────────────────────────────────────────

  /**
   * Map notification frequency to the appropriate notification type.
   */
  private getNotificationType(frequency: NotificationFrequency): NotificationType {
    switch (frequency) {
      case NotificationFrequency.PHASE_BASED:
        return NotificationType.PHASE_ALERT;
      case NotificationFrequency.DAILY:
      case NotificationFrequency.CUSTOM:
      default:
        return NotificationType.DAILY_SUMMARY;
    }
  }

  // ─── Validation Helpers ─────────────────────────────────────────────────

  /**
   * Validate that email notification content meets all structural requirements.
   *
   * Checks:
   * - Phase summary is present and max 3 sentences (Req 17.1)
   * - 1-3 insights present (Req 17.2)
   * - 1-3 "Do" recommendations present (Req 17.3)
   * - 1-3 "Don't" recommendations present (Req 17.3)
   * - Interaction guidance is present and max 2 sentences (Req 17.4)
   *
   * @param content - The email content to validate
   * @returns Whether the content meets all requirements
   */
  validateEmailContent(content: EmailNotificationContent): boolean {
    // Phase summary: present and max 3 sentences
    if (!content.phaseSummary || this.countSentences(content.phaseSummary) > 3) {
      return false;
    }

    // Insights: 1-3 items
    if (content.insights.length < 1 || content.insights.length > 3) {
      return false;
    }

    // Do recommendations: 1-3 items
    if (content.doRecommendations.length < 1 || content.doRecommendations.length > 3) {
      return false;
    }

    // Don't recommendations: 1-3 items
    if (content.dontRecommendations.length < 1 || content.dontRecommendations.length > 3) {
      return false;
    }

    // Interaction guidance: present and max 2 sentences
    if (!content.interactionGuidance || this.countSentences(content.interactionGuidance) > 2) {
      return false;
    }

    return true;
  }

  /**
   * Count sentences in a text string.
   * A sentence ends with '.', '!', or '?'.
   */
  private countSentences(text: string): number {
    const matches = text.match(/[.!?]+/g);
    return matches ? matches.length : 0;
  }
}
