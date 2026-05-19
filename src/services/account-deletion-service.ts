import { UserStatus } from '@/lib/types';

/**
 * Error codes for account deletion operations.
 */
export enum AccountDeletionErrorCode {
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INVALID_CONFIRMATION = 'INVALID_CONFIRMATION',
  DELETION_TOKEN_EXPIRED = 'DELETION_TOKEN_EXPIRED',
  DELETION_ALREADY_CONFIRMED = 'DELETION_ALREADY_CONFIRMED',
}

/**
 * Result type for AccountDeletionService operations.
 */
export interface AccountDeletionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: AccountDeletionErrorCode;
    message: string;
  };
}

/**
 * Represents a pending deletion request with a confirmation token.
 */
export interface DeletionRequest {
  /** Unique token for confirming the deletion */
  confirmationToken: string;
  /** The user ID requesting deletion */
  userId: string;
  /** When the request was created */
  createdAt: string;
  /** When the token expires (15 minutes from creation) */
  expiresAt: string;
}

/**
 * Summary of what was deleted during the cascade.
 */
export interface DeletionCascadeResult {
  userId: string;
  cycleRecordsDeleted: number;
  personalNotesDeleted: number;
  surveyResponsesDeleted: number;
  sharingPreferencesDeleted: number;
  dailySummariesDeleted: number;
  dateRequestsDeleted: number;
  notificationLogsDeleted: number;
  partnerDeactivated: boolean;
}

/**
 * Typed interface for database access (dependency injection).
 * Allows the AccountDeletionService to remain framework-agnostic.
 */
export interface AccountDeletionRepository {
  /** Check if a user exists and return their status */
  getUserStatus(userId: string): Promise<{ exists: boolean; status: UserStatus } | null>;

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

  /** Delete all notification logs for the linked partner, return count deleted */
  deleteNotificationLogs(primaryUserId: string): Promise<number>;

  /** Get the linked partner user ID (if any) */
  getLinkedPartnerId(primaryUserId: string): Promise<string | null>;

  /** Deactivate the partner user (set status to deleted, revoke partner link) */
  deactivatePartner(partnerId: string): Promise<void>;

  /** Delete the primary user account */
  deleteUser(userId: string): Promise<void>;
}

/** Duration in milliseconds for which a deletion token is valid (15 minutes) */
const DELETION_TOKEN_TTL_MS = 15 * 60 * 1000;

/**
 * AccountDeletionService implements a two-step account deletion process:
 *
 * 1. requestDeletion — generates a confirmation token (explicit confirmation step per Req 2.4)
 * 2. confirmDeletion — performs the cascade deletion (per Req 2.5)
 *
 * The cascade deletes:
 * - CycleRecords
 * - PersonalNotes
 * - SurveyResponses
 * - SharingPreferences
 * - DailySummaries
 * - DateRequests
 * - NotificationLogs
 * - Deactivates linked Partner_User
 * - Deletes the Primary_User account
 *
 * Framework-agnostic: database access is injected via the AccountDeletionRepository interface.
 *
 * Validates: Requirements 2.4, 2.5
 */
export class AccountDeletionService {
  private pendingDeletions: Map<string, DeletionRequest> = new Map();

  constructor(private readonly repository: AccountDeletionRepository) {}

  /**
   * Step 1: Request account deletion.
   * Generates a confirmation token that must be provided to confirmDeletion.
   * The token expires after 15 minutes.
   *
   * @param userId - The primary user's ID
   * @returns A DeletionRequest with the confirmation token
   *
   * Validates: Requirement 2.4 (explicit confirmation step)
   */
  async requestDeletion(userId: string): Promise<AccountDeletionResult<DeletionRequest>> {
    // Verify user exists
    const userStatus = await this.repository.getUserStatus(userId);
    if (!userStatus) {
      return {
        success: false,
        error: {
          code: AccountDeletionErrorCode.USER_NOT_FOUND,
          message: 'User account not found.',
        },
      };
    }

    // Generate confirmation token
    const confirmationToken = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DELETION_TOKEN_TTL_MS);

    const request: DeletionRequest = {
      confirmationToken,
      userId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    // Store the pending deletion
    this.pendingDeletions.set(confirmationToken, request);

    return {
      success: true,
      data: request,
    };
  }

  /**
   * Step 2: Confirm account deletion and perform cascade.
   * Requires the confirmation token from requestDeletion.
   *
   * Cascade order:
   * 1. Delete CycleRecords
   * 2. Delete PersonalNotes
   * 3. Delete SurveyResponses
   * 4. Delete SharingPreferences
   * 5. Delete DailySummaries
   * 6. Delete DateRequests
   * 7. Delete NotificationLogs
   * 8. Deactivate linked Partner_User
   * 9. Delete Primary_User account
   *
   * @param confirmationToken - The token from requestDeletion
   * @returns Summary of what was deleted
   *
   * Validates: Requirement 2.5 (cascade deletion)
   */
  async confirmDeletion(
    confirmationToken: string,
  ): Promise<AccountDeletionResult<DeletionCascadeResult>> {
    // Validate the confirmation token
    const request = this.pendingDeletions.get(confirmationToken);

    if (!request) {
      return {
        success: false,
        error: {
          code: AccountDeletionErrorCode.INVALID_CONFIRMATION,
          message: 'Invalid confirmation token. Please request deletion again.',
        },
      };
    }

    // Check if token has expired
    if (new Date() > new Date(request.expiresAt)) {
      this.pendingDeletions.delete(confirmationToken);
      return {
        success: false,
        error: {
          code: AccountDeletionErrorCode.DELETION_TOKEN_EXPIRED,
          message: 'Confirmation token has expired. Please request deletion again.',
        },
      };
    }

    // Remove the pending deletion (one-time use)
    this.pendingDeletions.delete(confirmationToken);

    const userId = request.userId;

    // Verify user still exists
    const userStatus = await this.repository.getUserStatus(userId);
    if (!userStatus) {
      return {
        success: false,
        error: {
          code: AccountDeletionErrorCode.USER_NOT_FOUND,
          message: 'User account no longer exists.',
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
    const notificationLogsDeleted = await this.repository.deleteNotificationLogs(userId);

    // Deactivate linked partner
    let partnerDeactivated = false;
    const partnerId = await this.repository.getLinkedPartnerId(userId);
    if (partnerId) {
      await this.repository.deactivatePartner(partnerId);
      partnerDeactivated = true;
    }

    // Delete the primary user account
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
        notificationLogsDeleted,
        partnerDeactivated,
      },
    };
  }
}
