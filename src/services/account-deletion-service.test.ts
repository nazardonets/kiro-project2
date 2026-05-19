import { describe, it, expect, beforeEach, vi } from 'vitest';

import { UserStatus } from '@/lib/types';

import {
  AccountDeletionService,
  AccountDeletionRepository,
  AccountDeletionErrorCode,
} from './account-deletion-service';

/**
 * In-memory implementation of AccountDeletionRepository for testing.
 * Tracks all records associated with a primary user and their partner.
 */
class InMemoryAccountDeletionRepository implements AccountDeletionRepository {
  private users: Map<string, { status: UserStatus }> = new Map();
  private cycleRecords: Map<string, string[]> = new Map(); // userId -> recordIds
  private personalNotes: Map<string, string[]> = new Map();
  private surveyResponses: Map<string, string[]> = new Map();
  private sharingPreferences: Map<string, string[]> = new Map();
  private dailySummaries: Map<string, string[]> = new Map();
  private dateRequests: Map<string, string[]> = new Map();
  private notificationLogs: Map<string, string[]> = new Map();
  private partnerLinks: Map<string, string> = new Map(); // primaryUserId -> partnerUserId

  // Setup helpers
  addUser(userId: string, status: UserStatus = UserStatus.ACTIVE): void {
    this.users.set(userId, { status });
  }

  addCycleRecords(userId: string, count: number): void {
    const records = Array.from({ length: count }, (_, i) => `cycle-${userId}-${i}`);
    this.cycleRecords.set(userId, records);
  }

  addPersonalNotes(userId: string, count: number): void {
    const notes = Array.from({ length: count }, (_, i) => `note-${userId}-${i}`);
    this.personalNotes.set(userId, notes);
  }

  addSurveyResponses(userId: string, count: number): void {
    const responses = Array.from({ length: count }, (_, i) => `survey-${userId}-${i}`);
    this.surveyResponses.set(userId, responses);
  }

  addSharingPreferences(userId: string, count: number): void {
    const prefs = Array.from({ length: count }, (_, i) => `sharing-${userId}-${i}`);
    this.sharingPreferences.set(userId, prefs);
  }

  addDailySummaries(userId: string, count: number): void {
    const summaries = Array.from({ length: count }, (_, i) => `summary-${userId}-${i}`);
    this.dailySummaries.set(userId, summaries);
  }

  addDateRequests(userId: string, count: number): void {
    const requests = Array.from({ length: count }, (_, i) => `date-${userId}-${i}`);
    this.dateRequests.set(userId, requests);
  }

  addNotificationLogs(userId: string, count: number): void {
    const logs = Array.from({ length: count }, (_, i) => `notif-${userId}-${i}`);
    this.notificationLogs.set(userId, logs);
  }

  setPartnerLink(primaryUserId: string, partnerUserId: string): void {
    this.partnerLinks.set(primaryUserId, partnerUserId);
    this.addUser(partnerUserId, UserStatus.ACTIVE);
  }

  // Query helpers for assertions
  userExists(userId: string): boolean {
    return this.users.has(userId);
  }

  getUserStatusValue(userId: string): UserStatus | undefined {
    return this.users.get(userId)?.status;
  }

  getCycleRecordCount(userId: string): number {
    return this.cycleRecords.get(userId)?.length ?? 0;
  }

  getPersonalNoteCount(userId: string): number {
    return this.personalNotes.get(userId)?.length ?? 0;
  }

  getSurveyResponseCount(userId: string): number {
    return this.surveyResponses.get(userId)?.length ?? 0;
  }

  getSharingPreferenceCount(userId: string): number {
    return this.sharingPreferences.get(userId)?.length ?? 0;
  }

  getDailySummaryCount(userId: string): number {
    return this.dailySummaries.get(userId)?.length ?? 0;
  }

  getDateRequestCount(userId: string): number {
    return this.dateRequests.get(userId)?.length ?? 0;
  }

  getNotificationLogCount(userId: string): number {
    return this.notificationLogs.get(userId)?.length ?? 0;
  }

  // Repository interface implementation
  async getUserStatus(userId: string): Promise<{ exists: boolean; status: UserStatus } | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    return { exists: true, status: user.status };
  }

  async deleteCycleRecords(primaryUserId: string): Promise<number> {
    const count = this.cycleRecords.get(primaryUserId)?.length ?? 0;
    this.cycleRecords.delete(primaryUserId);
    return count;
  }

  async deletePersonalNotes(primaryUserId: string): Promise<number> {
    const count = this.personalNotes.get(primaryUserId)?.length ?? 0;
    this.personalNotes.delete(primaryUserId);
    return count;
  }

  async deleteSurveyResponses(primaryUserId: string): Promise<number> {
    const count = this.surveyResponses.get(primaryUserId)?.length ?? 0;
    this.surveyResponses.delete(primaryUserId);
    return count;
  }

  async deleteSharingPreferences(primaryUserId: string): Promise<number> {
    const count = this.sharingPreferences.get(primaryUserId)?.length ?? 0;
    this.sharingPreferences.delete(primaryUserId);
    return count;
  }

  async deleteDailySummaries(primaryUserId: string): Promise<number> {
    const count = this.dailySummaries.get(primaryUserId)?.length ?? 0;
    this.dailySummaries.delete(primaryUserId);
    return count;
  }

  async deleteDateRequests(primaryUserId: string): Promise<number> {
    const count = this.dateRequests.get(primaryUserId)?.length ?? 0;
    this.dateRequests.delete(primaryUserId);
    return count;
  }

  async deleteNotificationLogs(primaryUserId: string): Promise<number> {
    const count = this.notificationLogs.get(primaryUserId)?.length ?? 0;
    this.notificationLogs.delete(primaryUserId);
    return count;
  }

  async getLinkedPartnerId(primaryUserId: string): Promise<string | null> {
    return this.partnerLinks.get(primaryUserId) ?? null;
  }

  async deactivatePartner(partnerId: string): Promise<void> {
    const user = this.users.get(partnerId);
    if (user) {
      user.status = UserStatus.DELETED;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    this.users.delete(userId);
  }
}

function assertDefined<T>(value: T | null | undefined): asserts value is T {
  expect(value).toBeDefined();
  expect(value).not.toBeNull();
}

describe('AccountDeletionService', () => {
  let repository: InMemoryAccountDeletionRepository;
  let service: AccountDeletionService;
  const primaryUserId = 'user-primary-1';
  const partnerUserId = 'user-partner-1';

  beforeEach(() => {
    repository = new InMemoryAccountDeletionRepository();
    service = new AccountDeletionService(repository);

    // Set up a primary user with associated data
    repository.addUser(primaryUserId);
    repository.addCycleRecords(primaryUserId, 5);
    repository.addPersonalNotes(primaryUserId, 3);
    repository.addSurveyResponses(primaryUserId, 6);
    repository.addSharingPreferences(primaryUserId, 1);
    repository.addDailySummaries(primaryUserId, 10);
    repository.addDateRequests(primaryUserId, 2);
    repository.addNotificationLogs(primaryUserId, 4);
    repository.setPartnerLink(primaryUserId, partnerUserId);
  });

  describe('requestDeletion', () => {
    it('should generate a confirmation token for an existing user', async () => {
      const result = await service.requestDeletion(primaryUserId);

      expect(result.success).toBe(true);
      assertDefined(result.data);
      expect(result.data.confirmationToken).toBeDefined();
      expect(result.data.userId).toBe(primaryUserId);
      expect(result.data.createdAt).toBeDefined();
      expect(result.data.expiresAt).toBeDefined();
    });

    it('should set expiration 15 minutes from creation', async () => {
      const result = await service.requestDeletion(primaryUserId);

      assertDefined(result.data);
      const createdAt = new Date(result.data.createdAt).getTime();
      const expiresAt = new Date(result.data.expiresAt).getTime();
      const fifteenMinutesMs = 15 * 60 * 1000;

      expect(expiresAt - createdAt).toBe(fifteenMinutesMs);
    });

    it('should fail for a non-existent user', async () => {
      const result = await service.requestDeletion('non-existent-user');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AccountDeletionErrorCode.USER_NOT_FOUND);
    });

    it('should generate unique tokens for multiple requests', async () => {
      const result1 = await service.requestDeletion(primaryUserId);
      const result2 = await service.requestDeletion(primaryUserId);

      assertDefined(result1.data);
      assertDefined(result2.data);
      expect(result1.data.confirmationToken).not.toBe(result2.data.confirmationToken);
    });
  });

  describe('confirmDeletion', () => {
    it('should delete all associated records on confirmation', async () => {
      const request = await service.requestDeletion(primaryUserId);
      assertDefined(request.data);
      const result = await service.confirmDeletion(request.data.confirmationToken);

      expect(result.success).toBe(true);
      assertDefined(result.data);
      expect(result.data.cycleRecordsDeleted).toBe(5);
      expect(result.data.personalNotesDeleted).toBe(3);
      expect(result.data.surveyResponsesDeleted).toBe(6);
      expect(result.data.sharingPreferencesDeleted).toBe(1);
      expect(result.data.dailySummariesDeleted).toBe(10);
      expect(result.data.dateRequestsDeleted).toBe(2);
      expect(result.data.notificationLogsDeleted).toBe(4);
    });

    it('should deactivate the linked partner user', async () => {
      const request = await service.requestDeletion(primaryUserId);
      assertDefined(request.data);
      const result = await service.confirmDeletion(request.data.confirmationToken);

      expect(result.success).toBe(true);
      assertDefined(result.data);
      expect(result.data.partnerDeactivated).toBe(true);
      expect(repository.getUserStatusValue(partnerUserId)).toBe(UserStatus.DELETED);
    });

    it('should delete the primary user account', async () => {
      const request = await service.requestDeletion(primaryUserId);
      assertDefined(request.data);
      await service.confirmDeletion(request.data.confirmationToken);

      expect(repository.userExists(primaryUserId)).toBe(false);
    });

    it('should leave zero orphaned records after deletion', async () => {
      const request = await service.requestDeletion(primaryUserId);
      assertDefined(request.data);
      await service.confirmDeletion(request.data.confirmationToken);

      expect(repository.getCycleRecordCount(primaryUserId)).toBe(0);
      expect(repository.getPersonalNoteCount(primaryUserId)).toBe(0);
      expect(repository.getSurveyResponseCount(primaryUserId)).toBe(0);
      expect(repository.getSharingPreferenceCount(primaryUserId)).toBe(0);
      expect(repository.getDailySummaryCount(primaryUserId)).toBe(0);
      expect(repository.getDateRequestCount(primaryUserId)).toBe(0);
      expect(repository.getNotificationLogCount(primaryUserId)).toBe(0);
    });

    it('should fail with an invalid confirmation token', async () => {
      const result = await service.confirmDeletion('invalid-token');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AccountDeletionErrorCode.INVALID_CONFIRMATION);
    });

    it('should fail with an expired confirmation token', async () => {
      const request = await service.requestDeletion(primaryUserId);
      assertDefined(request.data);

      // Simulate token expiration by advancing time
      vi.useFakeTimers();
      vi.setSystemTime(new Date(Date.now() + 16 * 60 * 1000)); // 16 minutes later

      const result = await service.confirmDeletion(request.data.confirmationToken);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AccountDeletionErrorCode.DELETION_TOKEN_EXPIRED);

      vi.useRealTimers();
    });

    it('should not allow reuse of a confirmation token', async () => {
      const request = await service.requestDeletion(primaryUserId);
      assertDefined(request.data);
      await service.confirmDeletion(request.data.confirmationToken);

      // Try to use the same token again
      const result = await service.confirmDeletion(request.data.confirmationToken);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AccountDeletionErrorCode.INVALID_CONFIRMATION);
    });

    it('should handle deletion when no partner is linked', async () => {
      // Set up a user without a partner
      const soloUserId = 'user-solo-1';
      repository.addUser(soloUserId);
      repository.addCycleRecords(soloUserId, 3);
      repository.addPersonalNotes(soloUserId, 2);

      const request = await service.requestDeletion(soloUserId);
      assertDefined(request.data);
      const result = await service.confirmDeletion(request.data.confirmationToken);

      expect(result.success).toBe(true);
      assertDefined(result.data);
      expect(result.data.partnerDeactivated).toBe(false);
      expect(result.data.cycleRecordsDeleted).toBe(3);
      expect(result.data.personalNotesDeleted).toBe(2);
      expect(repository.userExists(soloUserId)).toBe(false);
    });

    it('should handle deletion when user has no associated records', async () => {
      const emptyUserId = 'user-empty-1';
      repository.addUser(emptyUserId);

      const request = await service.requestDeletion(emptyUserId);
      assertDefined(request.data);
      const result = await service.confirmDeletion(request.data.confirmationToken);

      expect(result.success).toBe(true);
      assertDefined(result.data);
      expect(result.data.cycleRecordsDeleted).toBe(0);
      expect(result.data.personalNotesDeleted).toBe(0);
      expect(result.data.surveyResponsesDeleted).toBe(0);
      expect(result.data.sharingPreferencesDeleted).toBe(0);
      expect(result.data.dailySummariesDeleted).toBe(0);
      expect(result.data.dateRequestsDeleted).toBe(0);
      expect(result.data.notificationLogsDeleted).toBe(0);
      expect(result.data.partnerDeactivated).toBe(false);
      expect(repository.userExists(emptyUserId)).toBe(false);
    });
  });

  describe('two-step confirmation flow', () => {
    it('should require explicit confirmation before deleting (Req 2.4)', async () => {
      // After requesting deletion, data should still exist
      await service.requestDeletion(primaryUserId);

      expect(repository.userExists(primaryUserId)).toBe(true);
      expect(repository.getCycleRecordCount(primaryUserId)).toBe(5);
      expect(repository.getPersonalNoteCount(primaryUserId)).toBe(3);
    });

    it('should only delete after confirmation token is provided (Req 2.5)', async () => {
      const request = await service.requestDeletion(primaryUserId);

      // Data still exists before confirmation
      expect(repository.userExists(primaryUserId)).toBe(true);

      // Confirm deletion
      assertDefined(request.data);
      await service.confirmDeletion(request.data.confirmationToken);

      // Now data is gone
      expect(repository.userExists(primaryUserId)).toBe(false);
      expect(repository.getCycleRecordCount(primaryUserId)).toBe(0);
    });
  });
});
