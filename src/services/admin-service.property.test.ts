import * as fc from 'fast-check';
import { describe, it, expect, beforeEach } from 'vitest';

import { ADMIN_SEARCH_RESULT_LIMIT } from '@/lib/constants';
import { UserStatus, PartnerLinkStatus } from '@/lib/types';

import {
  AdminService,
  AdminRepository,
  AdminEmailService,
  AdminAccountDetails,
} from './admin-service';

// ─── In-Memory Repository for Property Testing ──────────────────────────────

/**
 * A controllable in-memory repository that can return any number of results
 * from searchUsers, simulating databases of various sizes.
 */
class InMemoryAdminRepository implements AdminRepository {
  private usersToReturn: AdminAccountDetails[] = [];

  /** Configure how many users the repository will return (before service capping) */
  setSearchResults(users: AdminAccountDetails[]): void {
    this.usersToReturn = users;
  }

  async searchUsers(query: string, limit: number): Promise<AdminAccountDetails[]> {
    // Simulate a real repository that respects the limit parameter
    return this.usersToReturn.slice(0, limit);
  }

  async getUserById(): Promise<AdminAccountDetails | null> {
    return null;
  }

  async getUserBasicInfo(): Promise<{ id: string; email: string; status: UserStatus } | null> {
    return null;
  }

  async suspendUser(): Promise<void> {}
  async getActivePartnerLink(): Promise<{
    partner_user_id: string;
    status: PartnerLinkStatus;
  } | null> {
    return null;
  }
  async revokePartnerLink(): Promise<void> {}
  async revokeUserSessions(): Promise<void> {}
  async deleteCycleRecords(): Promise<number> {
    return 0;
  }
  async deletePersonalNotes(): Promise<number> {
    return 0;
  }
  async deleteSurveyResponses(): Promise<number> {
    return 0;
  }
  async deleteSharingPreferences(): Promise<number> {
    return 0;
  }
  async deleteDailySummaries(): Promise<number> {
    return 0;
  }
  async deleteDateRequests(): Promise<number> {
    return 0;
  }
  async deactivatePartner(): Promise<void> {}
  async deleteUser(): Promise<void> {}
}

class MockEmailService implements AdminEmailService {
  async sendSuspensionNotification(): Promise<boolean> {
    return true;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generate a fake AdminAccountDetails for testing */
function createFakeUser(index: number): AdminAccountDetails {
  return {
    id: `user-${index}`,
    email: `user${index}@example.com`,
    role: 'primary',
    status: UserStatus.ACTIVE,
    suspension_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    partner_link: null,
  };
}

/** Generate an array of fake users of a given size */
function createFakeUsers(count: number): AdminAccountDetails[] {
  return Array.from({ length: count }, (_, i) => createFakeUser(i));
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Arbitrary for non-empty search query strings */
const searchQueryArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

/** Arbitrary for database sizes including edge cases around the limit */
const databaseSizeArb = fc.oneof(
  fc.constant(0),
  fc.constant(1),
  fc.constant(49),
  fc.constant(50),
  fc.constant(51),
  fc.constant(100),
  fc.constant(1000),
  fc.integer({ min: 0, max: 2000 }),
);

// ─── Arbitraries for Property 10 ─────────────────────────────────────────────

/** Arbitrary for valid user IDs (UUIDs or similar identifiers) */
const userIdArb = fc.uuid();

/** Arbitrary for valid partner user IDs */
const partnerUserIdArb = fc.uuid();

/** Arbitrary for valid suspension reasons (1-500 chars) */
const suspensionReasonArb = fc
  .string({ minLength: 1, maxLength: 500 })
  .filter((s) => s.trim().length > 0);

// ─── Property 9: Admin Search Result Limit ───────────────────────────────────

/**
 * **Validates: Requirements 5.2**
 *
 * Property 9: Admin Search Result Limit
 *
 * For any admin user search query against any size user database, the number
 * of returned results SHALL never exceed 50.
 */
describe('Property 9: Admin Search Result Limit', () => {
  let repository: InMemoryAdminRepository;
  let emailService: MockEmailService;
  let service: AdminService;

  beforeEach(() => {
    repository = new InMemoryAdminRepository();
    emailService = new MockEmailService();
    service = new AdminService(repository, emailService);
  });

  it('searchUsers never returns more than 50 results regardless of query or database size', async () => {
    await fc.assert(
      fc.asyncProperty(searchQueryArb, databaseSizeArb, async (query, dbSize) => {
        // Set up the repository with the given number of users
        repository.setSearchResults(createFakeUsers(dbSize));

        // Call searchUsers without specifying a limit (should default to 50)
        const result = await service.searchUsers(query);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect((result.data ?? []).length).toBeLessThanOrEqual(ADMIN_SEARCH_RESULT_LIMIT);
      }),
      { numRuns: 200 },
    );
  });

  it('searchUsers never returns more than 50 results even when a higher limit is requested', async () => {
    await fc.assert(
      fc.asyncProperty(
        searchQueryArb,
        databaseSizeArb,
        fc.integer({ min: 1, max: 1000 }),
        async (query, dbSize, requestedLimit) => {
          // Set up the repository with the given number of users
          repository.setSearchResults(createFakeUsers(dbSize));

          // Call searchUsers with an arbitrary limit value
          const result = await service.searchUsers(query, requestedLimit);

          if (result.success) {
            // When the call succeeds, results must be capped at 50
            expect(result.data).toBeDefined();
            expect((result.data ?? []).length).toBeLessThanOrEqual(ADMIN_SEARCH_RESULT_LIMIT);
          } else {
            // If validation rejects the limit (e.g., > 50), that's also acceptable
            // as it prevents exceeding the limit
            expect(result.error).toBeDefined();
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ─── Property 10: Primary Suspension Cascades to Partner ─────────────────────

/**
 * **Validates: Requirements 5.9**
 *
 * Property 10: Primary Suspension Cascades to Partner
 *
 * For any Primary_User account that has a linked Partner_User, suspending the
 * Primary_User SHALL also revoke the Partner_User's access to the
 * Insights_Dashboard and Guidance_Panel.
 *
 * This is verified by checking that:
 * 1. The partner link is revoked (revokePartnerLink called)
 * 2. Sharing preferences are disabled (disableSharingPreferences called)
 * 3. The partner's sessions are revoked (revokeUserSessions called with partner ID)
 */
describe('Property 10: Primary Suspension Cascades to Partner', () => {
  it('suspending a primary user with an active partner link always cascades to revoke partner access', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        partnerUserIdArb,
        suspensionReasonArb,
        async (primaryUserId, partnerUserId, reason) => {
          // Track which repository methods were called and with what arguments
          const calls: {
            revokePartnerLink: string[];
            disableSharingPreferences: string[];
            revokeUserSessions: string[];
          } = {
            revokePartnerLink: [],
            disableSharingPreferences: [],
            revokeUserSessions: [],
          };

          // Create a repository that simulates an active primary user with a partner link
          const trackingRepository: AdminRepository = {
            async searchUsers() {
              return [];
            },
            async getUserById() {
              return null;
            },
            async getUserBasicInfo(userId: string) {
              if (userId === primaryUserId) {
                return {
                  id: primaryUserId,
                  email: `${primaryUserId}@example.com`,
                  status: UserStatus.ACTIVE,
                };
              }
              return null;
            },
            async suspendUser() {},
            async getActivePartnerLink(userId: string) {
              if (userId === primaryUserId) {
                return {
                  partner_user_id: partnerUserId,
                  status: PartnerLinkStatus.ACTIVE,
                };
              }
              return null;
            },
            async revokePartnerLink(userId: string) {
              calls.revokePartnerLink.push(userId);
            },
            async disableSharingPreferences(userId: string) {
              calls.disableSharingPreferences.push(userId);
            },
            async revokeUserSessions(userId: string) {
              calls.revokeUserSessions.push(userId);
            },
            async deleteCycleRecords() {
              return 0;
            },
            async deletePersonalNotes() {
              return 0;
            },
            async deleteSurveyResponses() {
              return 0;
            },
            async deleteSharingPreferences() {
              return 0;
            },
            async deleteDailySummaries() {
              return 0;
            },
            async deleteDateRequests() {
              return 0;
            },
            async deactivatePartner() {},
            async deleteUser() {},
          };

          const emailService: AdminEmailService = {
            async sendSuspensionNotification() {
              return true;
            },
          };

          const service = new AdminService(trackingRepository, emailService);

          // Act: suspend the primary user
          const result = await service.suspendAccount(primaryUserId, reason);

          // Assert: suspension succeeded
          expect(result.success).toBe(true);

          // Assert: partner link was revoked for the primary user
          expect(calls.revokePartnerLink).toContain(primaryUserId);

          // Assert: sharing preferences were disabled for the primary user
          expect(calls.disableSharingPreferences).toContain(primaryUserId);

          // Assert: the partner's sessions were revoked (using the correct partner ID)
          expect(calls.revokeUserSessions).toContain(partnerUserId);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('suspension cascades to the correct partner regardless of partner user ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        partnerUserIdArb,
        suspensionReasonArb,
        async (primaryUserId, partnerUserId, reason) => {
          // Ensure primary and partner IDs are different
          fc.pre(primaryUserId !== partnerUserId);

          let revokedPartnerSessionId: string | null = null;

          const trackingRepository: AdminRepository = {
            async searchUsers() {
              return [];
            },
            async getUserById() {
              return null;
            },
            async getUserBasicInfo(userId: string) {
              if (userId === primaryUserId) {
                return {
                  id: primaryUserId,
                  email: `${primaryUserId}@example.com`,
                  status: UserStatus.ACTIVE,
                };
              }
              return null;
            },
            async suspendUser() {},
            async getActivePartnerLink(userId: string) {
              if (userId === primaryUserId) {
                return {
                  partner_user_id: partnerUserId,
                  status: PartnerLinkStatus.ACTIVE,
                };
              }
              return null;
            },
            async revokePartnerLink() {},
            async disableSharingPreferences() {},
            async revokeUserSessions(userId: string) {
              // Track the last session revocation that isn't the primary user
              if (userId !== primaryUserId) {
                revokedPartnerSessionId = userId;
              }
            },
            async deleteCycleRecords() {
              return 0;
            },
            async deletePersonalNotes() {
              return 0;
            },
            async deleteSurveyResponses() {
              return 0;
            },
            async deleteSharingPreferences() {
              return 0;
            },
            async deleteDailySummaries() {
              return 0;
            },
            async deleteDateRequests() {
              return 0;
            },
            async deactivatePartner() {},
            async deleteUser() {},
          };

          const emailService: AdminEmailService = {
            async sendSuspensionNotification() {
              return true;
            },
          };

          const service = new AdminService(trackingRepository, emailService);

          const result = await service.suspendAccount(primaryUserId, reason);

          expect(result.success).toBe(true);

          // The partner session revocation must target the exact partner user ID
          expect(revokedPartnerSessionId).toBe(partnerUserId);
        },
      ),
      { numRuns: 200 },
    );
  });
});
