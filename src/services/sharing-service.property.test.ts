import * as fc from 'fast-check';
import { describe, it, expect, beforeEach } from 'vitest';

import { SharingPreferences, PartnerLinkStatus } from '@/lib/types';

import {
  SharingService,
  SharingRepository,
  INSIGHT_CATEGORIES,
  NOTIFICATION_TYPES,
  InsightCategory,
  NotificationType,
} from './sharing-service';

// ─── In-Memory Repository for Property Testing ──────────────────────────────

class InMemorySharingRepository implements SharingRepository {
  private preferences: Map<string, SharingPreferences> = new Map();
  private partnerLinks: Map<string, { status: PartnerLinkStatus; partner_user_id: string }> =
    new Map();

  setPartnerLink(primaryUserId: string, status: PartnerLinkStatus, partnerUserId: string): void {
    this.partnerLinks.set(primaryUserId, { status, partner_user_id: partnerUserId });
  }

  setPreferences(primaryUserId: string, prefs: SharingPreferences): void {
    this.preferences.set(primaryUserId, prefs);
  }

  async getSharingPreferences(primaryUserId: string): Promise<SharingPreferences | null> {
    return this.preferences.get(primaryUserId) ?? null;
  }

  async createDefaultPreferences(primaryUserId: string): Promise<SharingPreferences> {
    const prefs: SharingPreferences = {
      id: crypto.randomUUID(),
      primary_user_id: primaryUserId,
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
    this.preferences.set(primaryUserId, prefs);
    return prefs;
  }

  async updateSharingPreferences(
    primaryUserId: string,
    updates: Partial<Omit<SharingPreferences, 'id' | 'primary_user_id' | 'updated_at'>>,
  ): Promise<SharingPreferences> {
    const existing = this.preferences.get(primaryUserId);
    if (!existing) {
      throw new Error('Preferences not found');
    }
    const updated: SharingPreferences = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.preferences.set(primaryUserId, updated);
    return updated;
  }

  async hasActivePartnerLink(primaryUserId: string): Promise<boolean> {
    const link = this.partnerLinks.get(primaryUserId);
    return link?.status === PartnerLinkStatus.ACTIVE;
  }

  async getPartnerLinkStatus(
    primaryUserId: string,
  ): Promise<{ status: PartnerLinkStatus; partner_user_id: string } | null> {
    return this.partnerLinks.get(primaryUserId) ?? null;
  }
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** All toggleable fields in sharing preferences */
const ALL_FIELDS = [
  ...INSIGHT_CATEGORIES,
  ...NOTIFICATION_TYPES,
  'email_notifications_enabled',
] as const;

type ToggleableField = (typeof ALL_FIELDS)[number];

/** Generate a random initial state for all sharing preference boolean fields */
const sharingStateArb = fc.record({
  emotional_tendencies: fc.boolean(),
  behavioral_patterns: fc.boolean(),
  energy_levels: fc.boolean(),
  communication_guidance: fc.boolean(),
  daily_summaries: fc.boolean(),
  phase_alerts: fc.boolean(),
  partner_reminders: fc.boolean(),
  email_notifications_enabled: fc.boolean(),
});

/** Generate a random single field to toggle (category or notification type) */
const singleFieldArb: fc.Arbitrary<ToggleableField> = fc.constantFrom(...ALL_FIELDS);

// ─── Helper ──────────────────────────────────────────────────────────────────

function assertDefined<T>(value: T | null | undefined): asserts value is T {
  expect(value).toBeDefined();
  expect(value).not.toBeNull();
}

// ─── Property 7: Independent Sharing Toggle ──────────────────────────────────

/**
 * **Validates: Requirements 3.1, 3.3**
 *
 * Property 7: Independent Sharing Toggle
 *
 * For any Sharing_Preferences configuration, toggling a single Insight_Category
 * or notification type SHALL affect only that specific category/type and leave
 * all other categories/types unchanged.
 */
describe('Property 7: Independent Sharing Toggle', () => {
  let repository: InMemorySharingRepository;
  let service: SharingService;
  const primaryUserId = 'user-primary-prop';
  const partnerUserId = 'user-partner-prop';

  beforeEach(() => {
    repository = new InMemorySharingRepository();
    service = new SharingService(repository);
    repository.setPartnerLink(primaryUserId, PartnerLinkStatus.ACTIVE, partnerUserId);
  });

  it('toggling a single insight category affects only that category and leaves all others unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        sharingStateArb,
        fc.constantFrom(...INSIGHT_CATEGORIES),
        async (initialState, targetCategory: InsightCategory) => {
          // Set up initial preferences with the random state
          const prefs: SharingPreferences = {
            id: crypto.randomUUID(),
            primary_user_id: primaryUserId,
            ...initialState,
            updated_at: new Date().toISOString(),
          };
          repository.setPreferences(primaryUserId, prefs);

          // Toggle the target category to the opposite value
          const newValue = !initialState[targetCategory];
          const result = await service.updateCategories(primaryUserId, {
            [targetCategory]: newValue,
          });

          expect(result.success).toBe(true);
          expect(result.data).toBeDefined();

          const updated = result.data as SharingPreferences;

          // The targeted field should have the new value
          expect(updated[targetCategory]).toBe(newValue);

          // All other fields should remain unchanged
          for (const field of ALL_FIELDS) {
            if (field !== targetCategory) {
              expect(updated[field]).toBe(initialState[field]);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('toggling a single notification type affects only that type and leaves all others unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        sharingStateArb,
        fc.constantFrom(...NOTIFICATION_TYPES, 'email_notifications_enabled' as const),
        async (
          initialState,
          targetNotification: NotificationType | 'email_notifications_enabled',
        ) => {
          // Set up initial preferences with the random state
          const prefs: SharingPreferences = {
            id: crypto.randomUUID(),
            primary_user_id: primaryUserId,
            ...initialState,
            updated_at: new Date().toISOString(),
          };
          repository.setPreferences(primaryUserId, prefs);

          // Toggle the target notification type to the opposite value
          const newValue = !initialState[targetNotification];
          const result = await service.updateNotifications(primaryUserId, {
            [targetNotification]: newValue,
          });

          expect(result.success).toBe(true);
          expect(result.data).toBeDefined();

          const updated = result.data as SharingPreferences;

          // The targeted field should have the new value
          expect(updated[targetNotification]).toBe(newValue);

          // All other fields should remain unchanged
          for (const field of ALL_FIELDS) {
            if (field !== targetNotification) {
              expect(updated[field]).toBe(initialState[field]);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('toggling any single field (category or notification) leaves all other fields unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        sharingStateArb,
        singleFieldArb,
        async (initialState, targetField: ToggleableField) => {
          // Set up initial preferences with the random state
          const prefs: SharingPreferences = {
            id: crypto.randomUUID(),
            primary_user_id: primaryUserId,
            ...initialState,
            updated_at: new Date().toISOString(),
          };
          repository.setPreferences(primaryUserId, prefs);

          // Toggle the target field to the opposite value
          const newValue = !initialState[targetField];

          // Determine whether to use updateCategories or updateNotifications
          const isCategory = (INSIGHT_CATEGORIES as readonly string[]).includes(targetField);

          let result;
          if (isCategory) {
            result = await service.updateCategories(primaryUserId, {
              [targetField]: newValue,
            });
          } else {
            result = await service.updateNotifications(primaryUserId, {
              [targetField]: newValue,
            });
          }

          expect(result.success).toBe(true);
          expect(result.data).toBeDefined();

          const updated = result.data as SharingPreferences;

          // The targeted field should have the new value
          expect(updated[targetField]).toBe(newValue);

          // All other fields should remain unchanged
          for (const field of ALL_FIELDS) {
            if (field !== targetField) {
              expect(updated[field]).toBe(initialState[field]);
            }
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});

// ─── Property 6: Unlink Preserves Primary Data ───────────────────────────────

/**
 * **Validates: Requirements 2.6**
 *
 * Property 6: Unlink Preserves Primary Data
 *
 * For any Primary_User who unlinks their Partner_User, all Primary_User data
 * (Cycle_Records, Personal_Notes, Survey_Responses, Phase_Customizations) SHALL
 * remain unchanged, while the Partner_User's access to Insights_Dashboard and
 * Guidance_Panel SHALL be revoked.
 */
describe('Property 6: Unlink Preserves Primary Data', () => {
  /**
   * Extended in-memory repository that supports updatePartnerLinkStatus
   * (required for the unlinkPartner operation).
   */
  class UnlinkTestRepository implements SharingRepository {
    private preferences: Map<string, SharingPreferences> = new Map();
    private partnerLinks: Map<string, { status: PartnerLinkStatus; partner_user_id: string }> =
      new Map();

    setPartnerLink(primaryUserId: string, status: PartnerLinkStatus, partnerUserId: string): void {
      this.partnerLinks.set(primaryUserId, { status, partner_user_id: partnerUserId });
    }

    setPreferences(primaryUserId: string, prefs: SharingPreferences): void {
      this.preferences.set(primaryUserId, prefs);
    }

    async getSharingPreferences(primaryUserId: string): Promise<SharingPreferences | null> {
      return this.preferences.get(primaryUserId) ?? null;
    }

    async createDefaultPreferences(primaryUserId: string): Promise<SharingPreferences> {
      const prefs: SharingPreferences = {
        id: crypto.randomUUID(),
        primary_user_id: primaryUserId,
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
      this.preferences.set(primaryUserId, prefs);
      return prefs;
    }

    async updateSharingPreferences(
      primaryUserId: string,
      updates: Partial<Omit<SharingPreferences, 'id' | 'primary_user_id' | 'updated_at'>>,
    ): Promise<SharingPreferences> {
      const existing = this.preferences.get(primaryUserId);
      if (!existing) {
        throw new Error('Preferences not found');
      }
      const updated: SharingPreferences = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      this.preferences.set(primaryUserId, updated);
      return updated;
    }

    async hasActivePartnerLink(primaryUserId: string): Promise<boolean> {
      const link = this.partnerLinks.get(primaryUserId);
      return link?.status === PartnerLinkStatus.ACTIVE;
    }

    async getPartnerLinkStatus(
      primaryUserId: string,
    ): Promise<{ status: PartnerLinkStatus; partner_user_id: string } | null> {
      return this.partnerLinks.get(primaryUserId) ?? null;
    }

    async updatePartnerLinkStatus(primaryUserId: string, status: PartnerLinkStatus): Promise<void> {
      const existing = this.partnerLinks.get(primaryUserId);
      if (!existing) {
        throw new Error('Partner link not found');
      }
      this.partnerLinks.set(primaryUserId, { ...existing, status });
    }
  }

  let repository: UnlinkTestRepository;
  let service: SharingService;
  const primaryUserId = 'user-primary-unlink';
  const partnerUserId = 'user-partner-unlink';

  beforeEach(() => {
    repository = new UnlinkTestRepository();
    service = new SharingService(repository);
  });

  it('unlinking preserves all sharing preferences (primary user data) exactly unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(sharingStateArb, async (initialState) => {
        // Set up an active partner link
        repository.setPartnerLink(primaryUserId, PartnerLinkStatus.ACTIVE, partnerUserId);

        // Set up preferences with the random state
        const prefs: SharingPreferences = {
          id: crypto.randomUUID(),
          primary_user_id: primaryUserId,
          ...initialState,
          updated_at: new Date().toISOString(),
        };
        repository.setPreferences(primaryUserId, prefs);

        // Capture preferences before unlinking
        const prefsBefore = await repository.getSharingPreferences(primaryUserId);

        // Perform the unlink operation
        const result = await service.unlinkPartner(primaryUserId);
        expect(result.success).toBe(true);

        // Verify all sharing preferences remain exactly unchanged
        const prefsAfter = await repository.getSharingPreferences(primaryUserId);
        expect(prefsAfter).not.toBeNull();
        assertDefined(prefsAfter);
        assertDefined(prefsBefore);
        expect(prefsAfter.id).toBe(prefsBefore.id);
        expect(prefsAfter.primary_user_id).toBe(prefsBefore.primary_user_id);
        expect(prefsAfter.emotional_tendencies).toBe(prefsBefore.emotional_tendencies);
        expect(prefsAfter.behavioral_patterns).toBe(prefsBefore.behavioral_patterns);
        expect(prefsAfter.energy_levels).toBe(prefsBefore.energy_levels);
        expect(prefsAfter.communication_guidance).toBe(prefsBefore.communication_guidance);
        expect(prefsAfter.daily_summaries).toBe(prefsBefore.daily_summaries);
        expect(prefsAfter.phase_alerts).toBe(prefsBefore.phase_alerts);
        expect(prefsAfter.partner_reminders).toBe(prefsBefore.partner_reminders);
        expect(prefsAfter.email_notifications_enabled).toBe(
          prefsBefore.email_notifications_enabled,
        );
        expect(prefsAfter.updated_at).toBe(prefsBefore.updated_at);
      }),
      { numRuns: 200 },
    );
  });

  it('unlinking revokes partner access (partner link status becomes unlinked)', async () => {
    await fc.assert(
      fc.asyncProperty(sharingStateArb, async (initialState) => {
        // Set up an active partner link
        repository.setPartnerLink(primaryUserId, PartnerLinkStatus.ACTIVE, partnerUserId);

        // Set up preferences with the random state
        const prefs: SharingPreferences = {
          id: crypto.randomUUID(),
          primary_user_id: primaryUserId,
          ...initialState,
          updated_at: new Date().toISOString(),
        };
        repository.setPreferences(primaryUserId, prefs);

        // Perform the unlink operation
        const result = await service.unlinkPartner(primaryUserId);
        expect(result.success).toBe(true);

        // Verify partner link status is 'unlinked' (access revoked)
        const linkStatus = await repository.getPartnerLinkStatus(primaryUserId);
        expect(linkStatus).not.toBeNull();
        assertDefined(linkStatus);
        expect(linkStatus.status).toBe(PartnerLinkStatus.UNLINKED);

        // Verify hasActivePartnerLink returns false
        const hasActive = await repository.hasActivePartnerLink(primaryUserId);
        expect(hasActive).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  it('after unlinking, operations requiring active partner link fail with NO_ACTIVE_PARTNER', async () => {
    await fc.assert(
      fc.asyncProperty(sharingStateArb, async (initialState) => {
        // Set up an active partner link
        repository.setPartnerLink(primaryUserId, PartnerLinkStatus.ACTIVE, partnerUserId);

        // Set up preferences with the random state
        const prefs: SharingPreferences = {
          id: crypto.randomUUID(),
          primary_user_id: primaryUserId,
          ...initialState,
          updated_at: new Date().toISOString(),
        };
        repository.setPreferences(primaryUserId, prefs);

        // Perform the unlink operation
        const unlinkResult = await service.unlinkPartner(primaryUserId);
        expect(unlinkResult.success).toBe(true);

        // Subsequent updateCategories should fail with NO_ACTIVE_PARTNER
        const categoriesResult = await service.updateCategories(primaryUserId, {
          emotional_tendencies: !initialState.emotional_tendencies,
        });
        expect(categoriesResult.success).toBe(false);
        expect(categoriesResult.error?.code).toBe('NO_ACTIVE_PARTNER');
      }),
      { numRuns: 200 },
    );
  });
});
