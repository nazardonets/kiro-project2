import { ADMIN_SEARCH_RESULT_LIMIT } from '@/lib/constants';
import { UserStatus, PartnerLinkStatus } from '@/lib/types';
import { adminSearchSchema, suspendAccountSchema } from '@/lib/validation/admin.schemas';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Result type for AdminService operations.
 */
export interface AdminServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    fields?: Record<string, { message: string; constraint: string }>;
  };
}

/**
 * Account details visible to admin users.
 */
export interface AdminAccountDetails {
  id: string;
  email: string;
  role: string;
  status: UserStatus;
  suspension_reason: string | null;
  created_at: string;
  updated_at: string;
  partner_link: {
    status: PartnerLinkStatus;
    partner_user_id: string;
    linked_at: string;
  } | null;
}

/**
 * Summary of what was deleted during admin account deletion cascade.
 */
export interface AdminDeletionCascadeResult {
  userId: string;
  cycleRecordsDeleted: number;
  personalNotesDeleted: number;
  surveyResponsesDeleted: number;
  sharingPreferencesDeleted: number;
  dailySummariesDeleted: number;
  dateRequestsDeleted: number;
  partnerAccessRevoked: boolean;
}

/**
 * Email service interface for sending suspension notifications.
 */
export interface AdminEmailService {
  /** Send a suspension notification email to the affected user */
  sendSuspensionNotification(email: string, reason: string): Promise<boolean>;
}

/**
 * Typed interface for database access (dependency injection).
 * Allows the AdminService to remain framework-agnostic.
 */
export interface AdminRepository {
  /** Search users by email or account ID, limited to maxResults */
  searchUsers(query: string, limit: number): Promise<AdminAccountDetails[]>;

  /** Get a single user's account details by ID */
  getUserById(userId: string): Promise<AdminAccountDetails | null>;

  /** Get a single user's basic info (for email sending) */
  getUserBasicInfo(
    userId: string,
  ): Promise<{ id: string; email: string; status: UserStatus } | null>;

  /** Suspend a user account with a reason */
  suspendUser(userId: string, reason: string): Promise<void>;

  /** Get the active partner link for a primary user */
  getActivePartnerLink(primaryUserId: string): Promise<{
    partner_user_id: string;
    status: PartnerLinkStatus;
  } | null>;

  /** Revoke partner link (set status to 'revoked') */
  revokePartnerLink(primaryUserId: string): Promise<void>;

  /** Disable all sharing preferences for a primary user (sets all categories to false) */
  disableSharingPreferences(primaryUserId: string): Promise<void>;

  /** Revoke a user's active sessions (invalidate tokens) */
  revokeUserSessions(userId: string): Promise<void>;

  /** Delete all cycle records for a user, return count deleted */
  deleteCycleRecords(primaryUserId: string): Promise<number>;

  /** Delete all personal notes for a user, return count deleted */
  deletePersonalNotes(primaryUserId: string): Promise<number>;

  /** Delete all survey responses for a user, return count deleted */
  deleteSurveyResponses(primaryUserId: string): Promise<number>;

  /** Delete sharing preferences for a user, return count deleted */
  deleteSharingPreferences(primaryUserId: string): Promise<number>;

  /** Delete all daily summaries for a user, return count deleted */
  deleteDailySummaries(primaryUserId: string): Promise<number>;

  /** Delete all date requests for a user, return count deleted */
  deleteDateRequests(primaryUserId: string): Promise<number>;

  /** Deactivate the partner user (set status to deleted, revoke partner link) */
  deactivatePartner(partnerId: string): Promise<void>;

  /** Delete the user account (mark as deleted) */
  deleteUser(userId: string): Promise<void>;
}

// ─── Error Codes ─────────────────────────────────────────────────────────────

export enum AdminErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  ALREADY_SUSPENDED = 'ALREADY_SUSPENDED',
  ALREADY_DELETED = 'ALREADY_DELETED',
  DELETION_NOT_CONFIRMED = 'DELETION_NOT_CONFIRMED',
  SESSION_REVOCATION_FAILED = 'SESSION_REVOCATION_FAILED',
  EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED',
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * AdminService handles user management operations for admin users.
 *
 * Responsibilities:
 * - Search users by email or account ID (max 50 results)
 * - View account details (status, creation date, partner link status)
 * - Suspend accounts with recorded reason (1-500 chars)
 * - Delete accounts with confirmation and cascade
 * - Revoke access within 30 seconds of suspension
 * - Notify affected user via email on suspension
 *
 * Framework-agnostic: database access is injected via the AdminRepository interface.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
 */
export class AdminService {
  constructor(
    private readonly repository: AdminRepository,
    private readonly emailService: AdminEmailService,
  ) {}

  /**
   * Search for user accounts by email address or account identifier.
   * Returns a maximum of 50 matching results per query.
   *
   * @param query - Search string (email or account ID)
   * @param limit - Maximum number of results (default: 50, max: 50)
   * @returns Array of matching account details
   *
   * Validates: Requirement 5.2
   */
  async searchUsers(
    query: string,
    limit?: number,
  ): Promise<AdminServiceResult<AdminAccountDetails[]>> {
    // Validate input
    const validation = adminSearchSchema.safeParse({ query, limit });
    if (!validation.success) {
      const fieldErrors: Record<string, { message: string; constraint: string }> = {};
      for (const issue of validation.error.issues) {
        const field = issue.path.join('.');
        fieldErrors[field] = {
          message: issue.message,
          constraint: issue.code,
        };
      }
      return {
        success: false,
        error: {
          code: AdminErrorCode.VALIDATION_ERROR,
          message: 'Invalid search parameters',
          fields: fieldErrors,
        },
      };
    }

    const effectiveLimit = Math.min(
      validation.data.limit ?? ADMIN_SEARCH_RESULT_LIMIT,
      ADMIN_SEARCH_RESULT_LIMIT,
    );

    const results = await this.repository.searchUsers(validation.data.query, effectiveLimit);

    return {
      success: true,
      data: results,
    };
  }

  /**
   * View account details for a specific user.
   * Includes account status, creation date, and partner link status.
   *
   * @param userId - The user's ID
   * @returns Account details or error if not found
   *
   * Validates: Requirement 5.3
   */
  async getAccountDetails(userId: string): Promise<AdminServiceResult<AdminAccountDetails>> {
    const user = await this.repository.getUserById(userId);

    if (!user) {
      return {
        success: false,
        error: {
          code: AdminErrorCode.USER_NOT_FOUND,
          message: 'User account not found',
        },
      };
    }

    return {
      success: true,
      data: user,
    };
  }

  /**
   * Suspend a user account with a recorded reason.
   *
   * This operation:
   * 1. Validates the suspension reason (1-500 chars)
   * 2. Updates the user status to 'suspended' with the reason
   * 3. Revokes all active sessions (access revoked within 30 seconds)
   * 4. If the user is a primary user with a linked partner, revokes partner access
   * 5. Sends a suspension notification email to the affected user
   *
   * @param userId - The user's ID to suspend
   * @param reason - Suspension reason (1-500 characters)
   * @returns Result indicating success or failure
   *
   * Validates: Requirements 5.4, 5.7, 5.9
   */
  async suspendAccount(
    userId: string,
    reason: string,
  ): Promise<AdminServiceResult<{ suspended: true; emailSent: boolean }>> {
    // Validate suspension reason
    const validation = suspendAccountSchema.safeParse({ reason });
    if (!validation.success) {
      const fieldErrors: Record<string, { message: string; constraint: string }> = {};
      for (const issue of validation.error.issues) {
        const field = issue.path.join('.');
        fieldErrors[field] = {
          message: issue.message,
          constraint: issue.code,
        };
      }
      return {
        success: false,
        error: {
          code: AdminErrorCode.VALIDATION_ERROR,
          message: 'Invalid suspension reason',
          fields: fieldErrors,
        },
      };
    }

    // Verify user exists and is not already suspended/deleted
    const user = await this.repository.getUserBasicInfo(userId);
    if (!user) {
      return {
        success: false,
        error: {
          code: AdminErrorCode.USER_NOT_FOUND,
          message: 'User account not found',
        },
      };
    }

    if (user.status === UserStatus.SUSPENDED) {
      return {
        success: false,
        error: {
          code: AdminErrorCode.ALREADY_SUSPENDED,
          message: 'User account is already suspended',
        },
      };
    }

    if (user.status === UserStatus.DELETED) {
      return {
        success: false,
        error: {
          code: AdminErrorCode.ALREADY_DELETED,
          message: 'User account has already been deleted',
        },
      };
    }

    // Suspend the user account
    await this.repository.suspendUser(userId, validation.data.reason);

    // Revoke all active sessions (ensures access is revoked within 30 seconds)
    await this.repository.revokeUserSessions(userId);

    // If this is a primary user with a linked partner, revoke partner access (Req 5.9)
    const partnerLink = await this.repository.getActivePartnerLink(userId);
    if (partnerLink) {
      await this.repository.revokePartnerLink(userId);
      // Disable sharing preferences so partner cannot access Insights_Dashboard or Guidance_Panel
      await this.repository.disableSharingPreferences(userId);
      // Also revoke partner's sessions so they lose access immediately
      await this.repository.revokeUserSessions(partnerLink.partner_user_id);
    }

    // Send suspension notification email (Req 5.7)
    let emailSent = false;
    try {
      emailSent = await this.emailService.sendSuspensionNotification(
        user.email,
        validation.data.reason,
      );
    } catch {
      // Email failure should not block the suspension operation
      emailSent = false;
    }

    return {
      success: true,
      data: { suspended: true, emailSent },
    };
  }

  /**
   * Delete a user account with confirmation and cascade.
   *
   * This operation requires explicit confirmation (confirmed = true) before proceeding.
   * On deletion, all associated data is cascaded:
   * - CycleRecords
   * - PersonalNotes
   * - SurveyResponses
   * - SharingPreferences
   * - DailySummaries
   * - DateRequests
   * - Linked Partner_User access is revoked
   *
   * @param userId - The user's ID to delete
   * @param confirmed - Must be true to proceed with deletion
   * @returns Summary of what was deleted
   *
   * Validates: Requirements 5.5, 5.8
   */
  async deleteAccount(
    userId: string,
    confirmed: boolean,
  ): Promise<AdminServiceResult<AdminDeletionCascadeResult>> {
    // Require explicit confirmation (Req 5.5)
    if (!confirmed) {
      return {
        success: false,
        error: {
          code: AdminErrorCode.DELETION_NOT_CONFIRMED,
          message: 'Account deletion requires explicit confirmation',
        },
      };
    }

    // Verify user exists
    const user = await this.repository.getUserBasicInfo(userId);
    if (!user) {
      return {
        success: false,
        error: {
          code: AdminErrorCode.USER_NOT_FOUND,
          message: 'User account not found',
        },
      };
    }

    if (user.status === UserStatus.DELETED) {
      return {
        success: false,
        error: {
          code: AdminErrorCode.ALREADY_DELETED,
          message: 'User account has already been deleted',
        },
      };
    }

    // Perform cascade deletion
    const cycleRecordsDeleted = await this.repository.deleteCycleRecords(userId);
    const personalNotesDeleted = await this.repository.deletePersonalNotes(userId);
    const surveyResponsesDeleted = await this.repository.deleteSurveyResponses(userId);
    const sharingPreferencesDeleted = await this.repository.deleteSharingPreferences(userId);
    const dailySummariesDeleted = await this.repository.deleteDailySummaries(userId);
    const dateRequestsDeleted = await this.repository.deleteDateRequests(userId);

    // Revoke linked partner access (Req 5.8)
    let partnerAccessRevoked = false;
    const partnerLink = await this.repository.getActivePartnerLink(userId);
    if (partnerLink) {
      await this.repository.deactivatePartner(partnerLink.partner_user_id);
      partnerAccessRevoked = true;
    }

    // Delete the user account
    await this.repository.deleteUser(userId);

    return {
      success: true,
      data: {
        userId,
        cycleRecordsDeleted,
        personalNotesDeleted,
        surveyResponsesDeleted,
        sharingPreferencesDeleted,
        dailySummariesDeleted,
        dateRequestsDeleted,
        partnerAccessRevoked,
      },
    };
  }
}
