import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { UserStatus } from '@/lib/types';

import { AccountDeletionService, AccountDeletionRepository } from './account-deletion-service';

// ─── In-Memory Repository for Property Testing ──────────────────────────────

class InMemoryAccountDeletionRepository implements AccountDeletionRepository {
  private users: Map<string, { status: UserStatus }> = new Map();
  private cycleRecords: Map<string, string[]> = new Map();
  private personalNotes: Map<string, string[]> = new Map();
  private surveyResponses: Map<string, string[]> = new Map();
  private sharingPreferences: Map<string, string[]> = new Map();
  private dailySummaries: Map<string, string[]> = new Map();
  private dateRequests: Map<string, string[]> = new Map();
  private notificationLogs: Map<string, string[]> = new Map();
  private partnerLinks: Map<string, string> = new Map();

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

  getPartnerStatus(partnerId: string): UserStatus | undefined {
    return this.users.get(partnerId)?.status;
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

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const cycleRecordCountArb = fc.integer({ min: 0, max: 20 });
const personalNoteCountArb = fc.integer({ min: 0, max: 10 });
const surveyResponseCountArb = fc.integer({ min: 0, max: 6 });
const sharingPreferenceCountArb = fc.integer({ min: 0, max: 1 });
const dailySummaryCountArb = fc.integer({ min: 0, max: 30 });
const dateRequestCountArb = fc.integer({ min: 0, max: 10 });
const notificationLogCountArb = fc.integer({ min: 0, max: 20 });
const hasPartnerArb = fc.boolean();

interface DeletionScenario {
  cycleRecords: number;
  personalNotes: number;
  surveyResponses: number;
  sharingPreferences: number;
  dailySummaries: number;
  dateRequests: number;
  notificationLogs: number;
  hasPartner: boolean;
}

const deletionScenarioArb: fc.Arbitrary<DeletionScenario> = fc.record({
  cycleRecords: cycleRecordCountArb,
  personalNotes: personalNoteCountArb,
  surveyResponses: surveyResponseCountArb,
  sharingPreferences: sharingPreferenceCountArb,
  dailySummaries: dailySummaryCountArb,
  dateRequests: dateRequestCountArb,
  notificationLogs: notificationLogCountArb,
  hasPartner: hasPartnerArb,
});

function assertDefined<T>(value: T | null | undefined): asserts value is T {
  expect(value).toBeDefined();
  expect(value).not.toBeNull();
}

// ─── Property 5: Account Deletion Cascade ────────────────────────────────────

/**
 * **Validates: Requirements 2.5, 5.8**
 *
 * Property 5: Account Deletion Cascade
 *
 * For any Primary_User account deletion, all associated Cycle_Records,
 * Personal_Notes, Survey_Responses, Sharing_Preferences, Daily_Summaries,
 * Date_Requests, and the linked Partner_User's access SHALL be removed,
 * leaving zero orphaned records.
 */
describe('Property 5: Account Deletion Cascade', () => {
  it('all record counts are zero after two-step deletion (request + confirm)', async () => {
    await fc.assert(
      fc.asyncProperty(deletionScenarioArb, async (scenario) => {
        const primaryUserId = 'primary-user-1';
        const partnerUserId = 'partner-user-1';

        // Set up repository with generated record counts
        const repository = new InMemoryAccountDeletionRepository();
        repository.addUser(primaryUserId);
        repository.addCycleRecords(primaryUserId, scenario.cycleRecords);
        repository.addPersonalNotes(primaryUserId, scenario.personalNotes);
        repository.addSurveyResponses(primaryUserId, scenario.surveyResponses);
        repository.addSharingPreferences(primaryUserId, scenario.sharingPreferences);
        repository.addDailySummaries(primaryUserId, scenario.dailySummaries);
        repository.addDateRequests(primaryUserId, scenario.dateRequests);
        repository.addNotificationLogs(primaryUserId, scenario.notificationLogs);

        if (scenario.hasPartner) {
          repository.setPartnerLink(primaryUserId, partnerUserId);
        }

        // Perform two-step deletion
        const service = new AccountDeletionService(repository);
        const requestResult = await service.requestDeletion(primaryUserId);
        expect(requestResult.success).toBe(true);

        assertDefined(requestResult.data);
        const confirmResult = await service.confirmDeletion(requestResult.data.confirmationToken);
        expect(confirmResult.success).toBe(true);

        // Verify ALL record counts are zero (no orphaned records)
        expect(repository.getCycleRecordCount(primaryUserId)).toBe(0);
        expect(repository.getPersonalNoteCount(primaryUserId)).toBe(0);
        expect(repository.getSurveyResponseCount(primaryUserId)).toBe(0);
        expect(repository.getSharingPreferenceCount(primaryUserId)).toBe(0);
        expect(repository.getDailySummaryCount(primaryUserId)).toBe(0);
        expect(repository.getDateRequestCount(primaryUserId)).toBe(0);
        expect(repository.getNotificationLogCount(primaryUserId)).toBe(0);
      }),
      { numRuns: 200 },
    );
  });

  it('partner is deactivated when linked', async () => {
    await fc.assert(
      fc.asyncProperty(deletionScenarioArb, async (scenario) => {
        // Only test scenarios where a partner is linked
        fc.pre(scenario.hasPartner === true);

        const primaryUserId = 'primary-user-1';
        const partnerUserId = 'partner-user-1';

        const repository = new InMemoryAccountDeletionRepository();
        repository.addUser(primaryUserId);
        repository.addCycleRecords(primaryUserId, scenario.cycleRecords);
        repository.addPersonalNotes(primaryUserId, scenario.personalNotes);
        repository.addSurveyResponses(primaryUserId, scenario.surveyResponses);
        repository.addSharingPreferences(primaryUserId, scenario.sharingPreferences);
        repository.addDailySummaries(primaryUserId, scenario.dailySummaries);
        repository.addDateRequests(primaryUserId, scenario.dateRequests);
        repository.addNotificationLogs(primaryUserId, scenario.notificationLogs);
        repository.setPartnerLink(primaryUserId, partnerUserId);

        // Perform two-step deletion
        const service = new AccountDeletionService(repository);
        const requestResult = await service.requestDeletion(primaryUserId);
        assertDefined(requestResult.data);
        const confirmResult = await service.confirmDeletion(requestResult.data.confirmationToken);

        expect(confirmResult.success).toBe(true);
        assertDefined(confirmResult.data);
        expect(confirmResult.data.partnerDeactivated).toBe(true);
        expect(repository.getPartnerStatus(partnerUserId)).toBe(UserStatus.DELETED);
      }),
      { numRuns: 200 },
    );
  });

  it('no partner deactivation when none is linked', async () => {
    await fc.assert(
      fc.asyncProperty(deletionScenarioArb, async (scenario) => {
        // Only test scenarios where no partner is linked
        fc.pre(scenario.hasPartner === false);

        const primaryUserId = 'primary-user-1';

        const repository = new InMemoryAccountDeletionRepository();
        repository.addUser(primaryUserId);
        repository.addCycleRecords(primaryUserId, scenario.cycleRecords);
        repository.addPersonalNotes(primaryUserId, scenario.personalNotes);
        repository.addSurveyResponses(primaryUserId, scenario.surveyResponses);
        repository.addSharingPreferences(primaryUserId, scenario.sharingPreferences);
        repository.addDailySummaries(primaryUserId, scenario.dailySummaries);
        repository.addDateRequests(primaryUserId, scenario.dateRequests);
        repository.addNotificationLogs(primaryUserId, scenario.notificationLogs);

        // Perform two-step deletion
        const service = new AccountDeletionService(repository);
        const requestResult = await service.requestDeletion(primaryUserId);
        assertDefined(requestResult.data);
        const confirmResult = await service.confirmDeletion(requestResult.data.confirmationToken);

        expect(confirmResult.success).toBe(true);
        assertDefined(confirmResult.data);
        expect(confirmResult.data.partnerDeactivated).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  it('deletion result counts match the generated record counts', async () => {
    await fc.assert(
      fc.asyncProperty(deletionScenarioArb, async (scenario) => {
        const primaryUserId = 'primary-user-1';
        const partnerUserId = 'partner-user-1';

        const repository = new InMemoryAccountDeletionRepository();
        repository.addUser(primaryUserId);
        repository.addCycleRecords(primaryUserId, scenario.cycleRecords);
        repository.addPersonalNotes(primaryUserId, scenario.personalNotes);
        repository.addSurveyResponses(primaryUserId, scenario.surveyResponses);
        repository.addSharingPreferences(primaryUserId, scenario.sharingPreferences);
        repository.addDailySummaries(primaryUserId, scenario.dailySummaries);
        repository.addDateRequests(primaryUserId, scenario.dateRequests);
        repository.addNotificationLogs(primaryUserId, scenario.notificationLogs);

        if (scenario.hasPartner) {
          repository.setPartnerLink(primaryUserId, partnerUserId);
        }

        // Perform two-step deletion
        const service = new AccountDeletionService(repository);
        const requestResult = await service.requestDeletion(primaryUserId);
        assertDefined(requestResult.data);
        const confirmResult = await service.confirmDeletion(requestResult.data.confirmationToken);

        // Verify the cascade result reports correct counts
        assertDefined(confirmResult.data);
        expect(confirmResult.data.cycleRecordsDeleted).toBe(scenario.cycleRecords);
        expect(confirmResult.data.personalNotesDeleted).toBe(scenario.personalNotes);
        expect(confirmResult.data.surveyResponsesDeleted).toBe(scenario.surveyResponses);
        expect(confirmResult.data.sharingPreferencesDeleted).toBe(scenario.sharingPreferences);
        expect(confirmResult.data.dailySummariesDeleted).toBe(scenario.dailySummaries);
        expect(confirmResult.data.dateRequestsDeleted).toBe(scenario.dateRequests);
        expect(confirmResult.data.notificationLogsDeleted).toBe(scenario.notificationLogs);
        expect(confirmResult.data.partnerDeactivated).toBe(scenario.hasPartner);
      }),
      { numRuns: 200 },
    );
  });
});
