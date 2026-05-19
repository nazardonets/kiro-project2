import {
  CyclePhase,
  DateRequest,
  DateRequestStatus,
  NotificationLog,
  NotificationStatus,
  NotificationType,
  PartnerLink,
  SharingPreferences,
} from '@/lib/types';
import { dateRequestSchema, DateRequestInput } from '@/lib/validation/date-request.schemas';
import type { EmailProvider } from '@/services/notification-service';

// ─── Date Request Types ─────────────────────────────────────────────────────

/**
 * Input for submitting a date request.
 */
export interface DateRequestSubmission {
  primaryUserId: string;
  location?: string | null;
  mood?: string | null;
  preferredDate?: string | null;
  windowStart?: string | null;
  windowEnd?: string | null;
  personalNotes?: string | null;
}

/**
 * Structured email content for a date request.
 * Contains labeled sections for each specified field and a phase-context section.
 */
export interface DateRequestEmailContent {
  /** Labeled sections for each specified field */
  sections: DateRequestEmailSection[];
  /** Phase-context section describing current cycle phase tendencies */
  phaseContext: string;
}

/**
 * A labeled section in the date request email.
 */
export interface DateRequestEmailSection {
  label: string;
  content: string;
}

/**
 * Result of a date request submission.
 */
export interface DateRequestResult {
  success: boolean;
  dateRequest?: DateRequest;
  error?: {
    code: string;
    message: string;
    retainedDetails?: DateRequestSubmission;
  };
}

// ─── Date Request Repository Interface ──────────────────────────────────────

/**
 * Typed interface for database access (dependency injection).
 */
export interface DateRequestRepository {
  /** Get the active partner link for a primary user */
  getActivePartnerLink(primaryUserId: string): Promise<PartnerLink | null>;

  /** Get sharing preferences for a primary user */
  getSharingPreferences(primaryUserId: string): Promise<SharingPreferences | null>;

  /** Get the partner's email address */
  getPartnerEmail(partnerUserId: string): Promise<string | null>;

  /** Get the current cycle phase for a primary user */
  getCurrentCyclePhase(primaryUserId: string): Promise<CyclePhase | null>;

  /** Create a date request record */
  createDateRequest(request: Omit<DateRequest, 'id' | 'created_at'>): Promise<DateRequest>;

  /** Update a date request status */
  updateDateRequestStatus(requestId: string, status: DateRequestStatus): Promise<void>;

  /** Create a notification log entry */
  createNotificationLog(log: Omit<NotificationLog, 'id'>): Promise<NotificationLog>;
}

// ─── Phase Context Content ──────────────────────────────────────────────────

/**
 * Phase-context descriptions for date request emails.
 * Uses probabilistic framing and partnership-focused language per Requirement 19.
 * Describes current cycle phase tendencies and suggested activity alignment.
 */
const PHASE_CONTEXT_DESCRIPTIONS: Record<CyclePhase, string> = {
  [CyclePhase.MENSTRUAL]:
    'She may be in a quieter, more reflective space right now. Energy could be lower than usual, ' +
    'so low-key, cozy activities might feel most comfortable. Consider something gentle and ' +
    'intimate — a relaxed evening at home or a calm, familiar setting could align well with ' +
    'her current tendencies. Each person experiences this phase uniquely.',
  [CyclePhase.FOLLICULAR]:
    'Her energy may be building, with growing curiosity and openness to new experiences. ' +
    'This could be a great time for trying something fresh together — a new restaurant, ' +
    'an outdoor adventure, or a creative activity. She might appreciate novelty and ' +
    'lighthearted fun. Individual experiences may vary.',
  [CyclePhase.OVULATION]:
    'She may be feeling more social, confident, and connected right now. Energy could be ' +
    'at its peak, making this potentially a wonderful time for more active or social plans. ' +
    'Deeper conversations and quality time together might feel especially rewarding. ' +
    'Her personal experience may differ from general patterns.',
  [CyclePhase.EARLY_LUTEAL]:
    'She may be in a focused, productive headspace. Structured plans and purposeful activities ' +
    'could feel most aligned with her current energy. Consider something that respects her ' +
    'rhythm — a planned outing or a meaningful shared activity might work well. ' +
    'Every person is different in how they experience this phase.',
  [CyclePhase.LATE_LUTEAL]:
    'Emotional sensitivity may be heightened and energy could be lower during this time. ' +
    'Gentle, low-pressure plans might feel most supportive — think comfort, warmth, and ' +
    'patience. A quiet dinner or relaxed evening together could be especially appreciated. ' +
    'Her unique experience may vary from these general tendencies.',
};

// ─── Email Formatting ───────────────────────────────────────────────────────

/**
 * Formats a CyclePhase enum value as a human-readable phase name.
 */
function formatPhaseName(phase: CyclePhase): string {
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

/**
 * Formats timing information from a date request into a human-readable string.
 */
function formatTiming(
  preferredDate?: string | null,
  windowStart?: string | null,
  windowEnd?: string | null,
): string | null {
  if (preferredDate) {
    return preferredDate;
  }
  if (windowStart && windowEnd) {
    return `${windowStart} to ${windowEnd}`;
  }
  if (windowStart) {
    return `From ${windowStart}`;
  }
  if (windowEnd) {
    return `By ${windowEnd}`;
  }
  return null;
}

/**
 * Builds the labeled sections for the date request email based on specified fields.
 * Only includes sections for fields that are provided (non-null, non-empty).
 *
 * Validates: Requirement 11.7 — labeled sections for each specified detail
 */
export function buildEmailSections(submission: DateRequestSubmission): DateRequestEmailSection[] {
  const sections: DateRequestEmailSection[] = [];

  if (submission.location) {
    sections.push({
      label: 'Preferred Location',
      content: submission.location,
    });
  }

  if (submission.mood) {
    sections.push({
      label: 'Desired Mood & Vibe',
      content: submission.mood,
    });
  }

  const timing = formatTiming(
    submission.preferredDate,
    submission.windowStart,
    submission.windowEnd,
  );
  if (timing) {
    sections.push({
      label: 'Timing',
      content: timing,
    });
  }

  if (submission.personalNotes) {
    sections.push({
      label: 'Personal Notes',
      content: submission.personalNotes,
    });
  }

  return sections;
}

/**
 * Generates the phase-context section for the date request email.
 * Describes the Primary_User's current Cycle_Phase tendencies and suggested activity alignment.
 * Uses probabilistic framing and partnership-focused language per Requirement 19.
 *
 * Validates: Requirement 11.7 — phase-context section describing current Cycle_Phase tendencies
 */
export function generatePhaseContext(phase: CyclePhase): string {
  return PHASE_CONTEXT_DESCRIPTIONS[phase];
}

/**
 * Formats the complete date request email content.
 * Includes labeled sections for each specified field and a phase-context section.
 *
 * Validates: Requirements 11.7, 11.8
 */
export function formatDateRequestEmailContent(
  submission: DateRequestSubmission,
  currentPhase: CyclePhase,
): DateRequestEmailContent {
  const sections = buildEmailSections(submission);
  const phaseContext = generatePhaseContext(currentPhase);

  return {
    sections,
    phaseContext,
  };
}

/**
 * Formats the date request email as HTML for delivery via Resend.
 * Uses tone and language guidelines: probabilistic framing, partnership-focused, non-deterministic.
 *
 * Validates: Requirements 11.6, 11.7, 11.8
 */
export function formatDateRequestEmailHtml(
  content: DateRequestEmailContent,
  currentPhase: CyclePhase,
): string {
  const phaseName = formatPhaseName(currentPhase);

  const sectionsHtml = content.sections
    .map(
      (section) =>
        `<div style="margin-bottom: 16px;">
    <h3 style="margin: 0 0 4px 0; color: #555;">${section.label}</h3>
    <p style="margin: 0;">${section.content}</p>
  </div>`,
    )
    .join('\n  ');

  return `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h1 style="color: #333;">Date Request</h1>
  <p style="color: #666;">Your partner would love to spend some quality time with you. Here are the details:</p>

  ${sectionsHtml}

  <div style="margin-top: 24px; padding: 16px; background-color: #f9f5ff; border-radius: 8px;">
    <h2 style="margin: 0 0 8px 0; color: #6b21a8;">Phase Context — ${phaseName}</h2>
    <p style="margin: 0; color: #555;">${content.phaseContext}</p>
  </div>

  <p style="margin-top: 24px; font-size: 12px; color: #999;">
    This date request was sent through Know Your Woman Cycle. The phase context above
    reflects general tendencies and may not match her exact experience today.
  </p>
</div>`;
}

// ─── DateRequestService ─────────────────────────────────────────────────────

/**
 * DateRequestService handles date request submission, validation, email formatting,
 * and delivery.
 *
 * Responsibilities:
 * - Validate input fields (location max 200, mood max 200, personal notes max 500)
 * - Check if a partner is linked and sharing is active
 * - Format the email with labeled sections for each specified field
 * - Include a phase-context section with current cycle phase tendencies
 * - Apply tone and language guidelines (probabilistic framing, non-deterministic)
 * - Send the email via the email provider (Resend)
 * - Handle delivery failures with appropriate error responses
 * - Retain entered details for resubmission when partner is not linked or sharing is revoked
 *
 * Framework-agnostic: database access and email provider are injected via interfaces.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10
 */
export class DateRequestService {
  constructor(
    private readonly repository: DateRequestRepository,
    private readonly emailProvider: EmailProvider,
  ) {}

  /**
   * Submit a date request.
   *
   * Flow:
   * 1. Validate input fields
   * 2. Check partner link and sharing status
   * 3. Get current cycle phase
   * 4. Format email with labeled sections and phase context
   * 5. Send email via provider
   * 6. Handle success/failure
   *
   * @param submission - The date request submission data
   * @returns DateRequestResult with success flag and details
   *
   * Validates: Requirements 11.1-11.10
   */
  async submitDateRequest(submission: DateRequestSubmission): Promise<DateRequestResult> {
    // 1. Validate input fields
    const validationResult = this.validateInput(submission);
    if (!validationResult.valid) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validationResult.message ?? 'Invalid input',
          retainedDetails: submission,
        },
      };
    }

    // 2. Check partner link and sharing status
    const partnerCheck = await this.checkPartnerEligibility(submission.primaryUserId);
    if (!partnerCheck.eligible) {
      return {
        success: false,
        error: {
          code: partnerCheck.errorCode ?? 'UNKNOWN_ERROR',
          message: partnerCheck.message ?? 'An unknown error occurred',
          retainedDetails: submission,
        },
      };
    }

    // 3. Get current cycle phase
    const currentPhase = await this.repository.getCurrentCyclePhase(submission.primaryUserId);
    const phase = currentPhase ?? CyclePhase.FOLLICULAR; // Default to follicular if no data

    // 4. Create date request record
    const dateRequest = await this.repository.createDateRequest({
      primary_user_id: submission.primaryUserId,
      location: submission.location ?? null,
      mood: submission.mood ?? null,
      preferred_date: submission.preferredDate ?? null,
      window_start: submission.windowStart ?? null,
      window_end: submission.windowEnd ?? null,
      personal_notes: submission.personalNotes ?? null,
      status: DateRequestStatus.PENDING,
    });

    // 5. Format email content
    const emailContent = formatDateRequestEmailContent(submission, phase);
    const emailHtml = formatDateRequestEmailHtml(emailContent, phase);

    // 6. Send email
    const sendResult = await this.emailProvider.sendEmail({
      to: partnerCheck.partnerEmail ?? '',
      subject: 'Date Request — Your Partner Would Love to Spend Time With You',
      html: emailHtml,
    });

    if (sendResult.success) {
      // Update status to sent
      await this.repository.updateDateRequestStatus(dateRequest.id, DateRequestStatus.SENT);

      // Log notification
      await this.repository.createNotificationLog({
        partner_user_id: partnerCheck.partnerUserId ?? '',
        type: NotificationType.DATE_REQUEST,
        status: NotificationStatus.SENT,
        retry_count: 0,
        sent_at: new Date().toISOString(),
        next_retry_at: null,
      });

      return {
        success: true,
        dateRequest: { ...dateRequest, status: DateRequestStatus.SENT },
      };
    }

    // 7. Handle delivery failure (Requirement 11.10)
    await this.repository.updateDateRequestStatus(dateRequest.id, DateRequestStatus.FAILED);

    await this.repository.createNotificationLog({
      partner_user_id: partnerCheck.partnerUserId ?? '',
      type: NotificationType.DATE_REQUEST,
      status: NotificationStatus.FAILED,
      retry_count: 0,
      sent_at: new Date().toISOString(),
      next_retry_at: null,
    });

    return {
      success: false,
      dateRequest: { ...dateRequest, status: DateRequestStatus.FAILED },
      error: {
        code: 'EMAIL_DELIVERY_FAILED',
        message: 'Your date request could not be delivered. You can retry submission.',
        retainedDetails: submission,
      },
    };
  }

  /**
   * Retry a failed date request submission.
   *
   * @param dateRequestId - The ID of the failed date request
   * @param submission - The original submission data
   * @returns DateRequestResult
   *
   * Validates: Requirement 11.10
   */
  async retryDateRequest(
    dateRequestId: string,
    submission: DateRequestSubmission,
  ): Promise<DateRequestResult> {
    // Re-check partner eligibility
    const partnerCheck = await this.checkPartnerEligibility(submission.primaryUserId);
    if (!partnerCheck.eligible) {
      return {
        success: false,
        error: {
          code: partnerCheck.errorCode ?? 'UNKNOWN_ERROR',
          message: partnerCheck.message ?? 'An unknown error occurred',
          retainedDetails: submission,
        },
      };
    }

    // Get current cycle phase
    const currentPhase = await this.repository.getCurrentCyclePhase(submission.primaryUserId);
    const phase = currentPhase ?? CyclePhase.FOLLICULAR;

    // Format and send email
    const emailContent = formatDateRequestEmailContent(submission, phase);
    const emailHtml = formatDateRequestEmailHtml(emailContent, phase);

    const sendResult = await this.emailProvider.sendEmail({
      to: partnerCheck.partnerEmail ?? '',
      subject: 'Date Request — Your Partner Would Love to Spend Time With You',
      html: emailHtml,
    });

    if (sendResult.success) {
      await this.repository.updateDateRequestStatus(dateRequestId, DateRequestStatus.SENT);
      return {
        success: true,
      };
    }

    return {
      success: false,
      error: {
        code: 'EMAIL_DELIVERY_FAILED',
        message: 'Your date request could not be delivered. You can retry submission.',
        retainedDetails: submission,
      },
    };
  }

  // ─── Validation ─────────────────────────────────────────────────────────

  /**
   * Validates date request input fields.
   * - location: max 200 characters
   * - mood: max 200 characters
   * - personal_notes: max 500 characters
   *
   * Validates: Requirements 11.2, 11.3, 11.5
   */
  private validateInput(submission: DateRequestSubmission): { valid: boolean; message?: string } {
    const input: DateRequestInput = {
      location: submission.location,
      mood: submission.mood,
      preferred_date: submission.preferredDate,
      window_start: submission.windowStart,
      window_end: submission.windowEnd,
      personal_notes: submission.personalNotes,
    };

    const result = dateRequestSchema.safeParse(input);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return {
        valid: false,
        message: firstIssue?.message ?? 'Invalid input',
      };
    }

    return { valid: true };
  }

  // ─── Partner Eligibility Check ──────────────────────────────────────────

  /**
   * Checks if a partner is linked and sharing is active.
   * Returns partner details if eligible, or error info if not.
   *
   * Validates: Requirement 11.9
   */
  private async checkPartnerEligibility(primaryUserId: string): Promise<{
    eligible: boolean;
    partnerUserId?: string;
    partnerEmail?: string;
    errorCode?: string;
    message?: string;
  }> {
    // Check for active partner link
    const partnerLink = await this.repository.getActivePartnerLink(primaryUserId);

    if (!partnerLink) {
      return {
        eligible: false,
        errorCode: 'NO_PARTNER_LINKED',
        message:
          'Your date request cannot be sent because no partner is currently linked to your account. ' +
          'Your entered details have been retained for resubmission once a partner is linked.',
      };
    }

    // Check sharing preferences
    const sharingPrefs = await this.repository.getSharingPreferences(primaryUserId);

    if (sharingPrefs && !sharingPrefs.email_notifications_enabled) {
      return {
        eligible: false,
        errorCode: 'SHARING_REVOKED',
        message:
          'Your date request cannot be sent because email sharing permissions are currently revoked. ' +
          'Your entered details have been retained for resubmission once sharing is re-enabled.',
      };
    }

    // Get partner email
    const partnerEmail = await this.repository.getPartnerEmail(partnerLink.partner_user_id);

    if (!partnerEmail) {
      return {
        eligible: false,
        errorCode: 'PARTNER_EMAIL_NOT_FOUND',
        message:
          'Your date request cannot be sent because the partner email could not be found. ' +
          'Your entered details have been retained for resubmission.',
      };
    }

    return {
      eligible: true,
      partnerUserId: partnerLink.partner_user_id,
      partnerEmail,
    };
  }
}
