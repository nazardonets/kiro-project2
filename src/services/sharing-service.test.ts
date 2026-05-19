import { describe, it, expect, beforeEach } from 'vitest';

import { SharingPreferences, PartnerLinkStatus } from '@/lib/types';

import {
  SharingService,
  SharingRepository,
  DEFAULT_SHARING_PREFERENCES,
  INSIGHT_CATEGORIES,
  NOTIFICATION_TYPES,
} from './sharing-service';

/**
 * In-memory implementation of SharingRepository for testing.
 */
class InMemorySharingRepository implements SharingRepository {
  private preferences: Map<string, SharingPreferences> = new Map();
  private partnerLinks: Map<string, { status: PartnerLinkStatus; partner_user_id: string }> =
    new Map();

  setPartnerLink(primaryUserId: string, status: PartnerLinkStatus, partnerUserId: string): void {
    this.partnerLinks.set(primaryUserId, { status, partner_user_id: partnerUserId });
  }

  async getSharingPreferences(primaryUserId: string): Promise<SharingPreferences | null> {
    return this.preferences.get(primaryUserId) ?? null;
  }

  async createDefaultPreferences(primaryUserId: string): Promise<SharingPreferences> {
    const prefs: SharingPreferences = {
      id: crypto.randomUUID(),
      primary_user_id: primaryUserId,
      ...DEFAULT_SHARING_PREFERENCES,
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

function assertDefined<T>(value: T | null | undefined): asserts value is T {
  expect(value).toBeDefined();
  expect(value).not.toBeNull();
}

describe('SharingService', () => {
  let repository: InMemorySharingRepository;
  let service: SharingService;
  const primaryUserId = 'user-primary-1';
  const partnerUserId = 'user-partner-1';

  beforeEach(() => {
    repository = new InMemorySharingRepository();
    service = new SharingService(repository);
    repository.setPartnerLink(primaryUserId, PartnerLinkStatus.ACTIVE, partnerUserId);
  });

  describe('initializeDefaultPreferences', () => {
    it('should create default preferences with all categories and notifications enabled', async () => {
      const result = await service.initializeDefaultPreferences(primaryUserId);

      expect(result.success).toBe(true);
      assertDefined(result.data);
      expect(result.data.emotional_tendencies).toBe(true);
      expect(result.data.behavioral_patterns).toBe(true);
      expect(result.data.energy_levels).toBe(true);
      expect(result.data.communication_guidance).toBe(true);
      expect(result.data.daily_summaries).toBe(true);
      expect(result.data.phase_alerts).toBe(true);
      expect(result.data.partner_reminders).toBe(true);
      expect(result.data.email_notifications_enabled).toBe(true);
    });

    it('should return existing preferences if already initialized', async () => {
      const first = await service.initializeDefaultPreferences(primaryUserId);
      const second = await service.initializeDefaultPreferences(primaryUserId);

      expect(second.success).toBe(true);
      assertDefined(second.data);
      assertDefined(first.data);
      expect(second.data.id).toBe(first.data.id);
    });
  });

  describe('getPreferences', () => {
    it('should return preferences when they exist', async () => {
      await service.initializeDefaultPreferences(primaryUserId);
      const result = await service.getPreferences(primaryUserId);

      expect(result.success).toBe(true);
      assertDefined(result.data);
      expect(result.data.primary_user_id).toBe(primaryUserId);
    });

    it('should return error when preferences do not exist', async () => {
      const result = await service.getPreferences('non-existent-user');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PREFERENCES_NOT_FOUND');
    });
  });

  describe('updateCategories', () => {
    beforeEach(async () => {
      await service.initializeDefaultPreferences(primaryUserId);
    });

    it('should toggle a single category independently without affecting others', async () => {
      const result = await service.updateCategories(primaryUserId, {
        emotional_tendencies: false,
      });

      expect(result.success).toBe(true);
      expect(result.data.emotional_tendencies).toBe(false);
      // Other categories remain unchanged
      expect(result.data.behavioral_patterns).toBe(true);
      expect(result.data.energy_levels).toBe(true);
      expect(result.data.communication_guidance).toBe(true);
    });

    it('should toggle multiple categories at once', async () => {
      const result = await service.updateCategories(primaryUserId, {
        emotional_tendencies: false,
        energy_levels: false,
      });

      expect(result.success).toBe(true);
      expect(result.data.emotional_tendencies).toBe(false);
      expect(result.data.energy_levels).toBe(false);
      expect(result.data.behavioral_patterns).toBe(true);
      expect(result.data.communication_guidance).toBe(true);
    });

    it('should re-enable a previously disabled category', async () => {
      await service.updateCategories(primaryUserId, { behavioral_patterns: false });
      const result = await service.updateCategories(primaryUserId, { behavioral_patterns: true });

      expect(result.success).toBe(true);
      expect(result.data.behavioral_patterns).toBe(true);
    });

    it('should return current preferences when no fields are provided', async () => {
      const result = await service.updateCategories(primaryUserId, {});

      expect(result.success).toBe(true);
      expect(result.data.emotional_tendencies).toBe(true);
    });

    it('should fail when no active partner link exists', async () => {
      repository.setPartnerLink(primaryUserId, PartnerLinkStatus.UNLINKED, partnerUserId);
      const result = await service.updateCategories(primaryUserId, {
        emotional_tendencies: false,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_ACTIVE_PARTNER');
    });

    it('should not affect notification types when toggling categories', async () => {
      const result = await service.updateCategories(primaryUserId, {
        emotional_tendencies: false,
        behavioral_patterns: false,
        energy_levels: false,
        communication_guidance: false,
      });

      expect(result.success).toBe(true);
      // Notification types remain unchanged
      expect(result.data.daily_summaries).toBe(true);
      expect(result.data.phase_alerts).toBe(true);
      expect(result.data.partner_reminders).toBe(true);
      expect(result.data.email_notifications_enabled).toBe(true);
    });
  });

  describe('updateNotifications', () => {
    beforeEach(async () => {
      await service.initializeDefaultPreferences(primaryUserId);
    });

    it('should toggle a single notification type independently without affecting others', async () => {
      const result = await service.updateNotifications(primaryUserId, {
        daily_summaries: false,
      });

      expect(result.success).toBe(true);
      expect(result.data.daily_summaries).toBe(false);
      // Other notification types remain unchanged
      expect(result.data.phase_alerts).toBe(true);
      expect(result.data.partner_reminders).toBe(true);
      expect(result.data.email_notifications_enabled).toBe(true);
    });

    it('should toggle multiple notification types at once', async () => {
      const result = await service.updateNotifications(primaryUserId, {
        phase_alerts: false,
        partner_reminders: false,
      });

      expect(result.success).toBe(true);
      expect(result.data.phase_alerts).toBe(false);
      expect(result.data.partner_reminders).toBe(false);
      expect(result.data.daily_summaries).toBe(true);
    });

    it('should toggle email_notifications_enabled independently', async () => {
      const result = await service.updateNotifications(primaryUserId, {
        email_notifications_enabled: false,
      });

      expect(result.success).toBe(true);
      expect(result.data.email_notifications_enabled).toBe(false);
      expect(result.data.daily_summaries).toBe(true);
      expect(result.data.phase_alerts).toBe(true);
      expect(result.data.partner_reminders).toBe(true);
    });

    it('should re-enable a previously disabled notification type', async () => {
      await service.updateNotifications(primaryUserId, { phase_alerts: false });
      const result = await service.updateNotifications(primaryUserId, { phase_alerts: true });

      expect(result.success).toBe(true);
      expect(result.data.phase_alerts).toBe(true);
    });

    it('should return current preferences when no fields are provided', async () => {
      const result = await service.updateNotifications(primaryUserId, {});

      expect(result.success).toBe(true);
      expect(result.data.daily_summaries).toBe(true);
    });

    it('should fail when no active partner link exists', async () => {
      repository.setPartnerLink(primaryUserId, PartnerLinkStatus.REVOKED, partnerUserId);
      const result = await service.updateNotifications(primaryUserId, {
        daily_summaries: false,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_ACTIVE_PARTNER');
    });

    it('should not affect insight categories when toggling notifications', async () => {
      const result = await service.updateNotifications(primaryUserId, {
        daily_summaries: false,
        phase_alerts: false,
        partner_reminders: false,
        email_notifications_enabled: false,
      });

      expect(result.success).toBe(true);
      // Insight categories remain unchanged
      expect(result.data.emotional_tendencies).toBe(true);
      expect(result.data.behavioral_patterns).toBe(true);
      expect(result.data.energy_levels).toBe(true);
      expect(result.data.communication_guidance).toBe(true);
    });
  });

  describe('areAllCategoriesDisabled', () => {
    beforeEach(async () => {
      await service.initializeDefaultPreferences(primaryUserId);
    });

    it('should return false when any category is enabled', async () => {
      await service.updateCategories(primaryUserId, {
        emotional_tendencies: false,
        behavioral_patterns: false,
        energy_levels: false,
      });

      const result = await service.areAllCategoriesDisabled(primaryUserId);
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });

    it('should return true when all categories are disabled', async () => {
      await service.updateCategories(primaryUserId, {
        emotional_tendencies: false,
        behavioral_patterns: false,
        energy_levels: false,
        communication_guidance: false,
      });

      const result = await service.areAllCategoriesDisabled(primaryUserId);
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('should return false when all categories are enabled (default)', async () => {
      const result = await service.areAllCategoriesDisabled(primaryUserId);
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });

    it('should return error when preferences do not exist', async () => {
      const result = await service.areAllCategoriesDisabled('non-existent-user');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PREFERENCES_NOT_FOUND');
    });
  });

  describe('getEnabledCategories', () => {
    beforeEach(async () => {
      await service.initializeDefaultPreferences(primaryUserId);
    });

    it('should return all categories when all are enabled', async () => {
      const result = await service.getEnabledCategories(primaryUserId);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(INSIGHT_CATEGORIES);
    });

    it('should return only enabled categories', async () => {
      await service.updateCategories(primaryUserId, {
        emotional_tendencies: false,
        communication_guidance: false,
      });

      const result = await service.getEnabledCategories(primaryUserId);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(['behavioral_patterns', 'energy_levels']);
    });

    it('should return empty array when all categories are disabled', async () => {
      await service.updateCategories(primaryUserId, {
        emotional_tendencies: false,
        behavioral_patterns: false,
        energy_levels: false,
        communication_guidance: false,
      });

      const result = await service.getEnabledCategories(primaryUserId);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('getEnabledNotifications', () => {
    beforeEach(async () => {
      await service.initializeDefaultPreferences(primaryUserId);
    });

    it('should return all notification types when all are enabled', async () => {
      const result = await service.getEnabledNotifications(primaryUserId);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(NOTIFICATION_TYPES);
    });

    it('should return only enabled notification types', async () => {
      await service.updateNotifications(primaryUserId, {
        daily_summaries: false,
      });

      const result = await service.getEnabledNotifications(primaryUserId);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(['phase_alerts', 'partner_reminders']);
    });

    it('should return empty array when all notification types are disabled', async () => {
      await service.updateNotifications(primaryUserId, {
        daily_summaries: false,
        phase_alerts: false,
        partner_reminders: false,
      });

      const result = await service.getEnabledNotifications(primaryUserId);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('isEmailNotificationsEnabled', () => {
    beforeEach(async () => {
      await service.initializeDefaultPreferences(primaryUserId);
    });

    it('should return true by default', async () => {
      const result = await service.isEmailNotificationsEnabled(primaryUserId);
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('should return false when disabled', async () => {
      await service.updateNotifications(primaryUserId, {
        email_notifications_enabled: false,
      });

      const result = await service.isEmailNotificationsEnabled(primaryUserId);
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });
  });

  describe('unlinkPartner', () => {
    beforeEach(async () => {
      await service.initializeDefaultPreferences(primaryUserId);
    });

    it('should update partner link status to unlinked', async () => {
      const result = await service.unlinkPartner(primaryUserId);

      expect(result.success).toBe(true);
      expect(result.data?.unlinkedPartnerId).toBe(partnerUserId);

      // Verify the partner link status is now 'unlinked'
      const linkStatus = await repository.getPartnerLinkStatus(primaryUserId);
      expect(linkStatus?.status).toBe(PartnerLinkStatus.UNLINKED);
    });

    it('should preserve all primary user data after unlinking', async () => {
      // Set up some preferences (simulating existing primary user data)
      await service.updateCategories(primaryUserId, {
        emotional_tendencies: false,
        energy_levels: true,
      });

      // Capture preferences before unlinking
      const prefsBefore = await repository.getSharingPreferences(primaryUserId);

      // Perform the unlink
      const result = await service.unlinkPartner(primaryUserId);
      expect(result.success).toBe(true);

      // Verify preferences are preserved unchanged after unlinking
      const prefsAfter = await repository.getSharingPreferences(primaryUserId);
      expect(prefsAfter).toEqual(prefsBefore);
    });

    it('should revoke partner access (partner can no longer access shared content)', async () => {
      // Unlink the partner
      await service.unlinkPartner(primaryUserId);

      // After unlinking, hasActivePartnerLink should return false
      const hasPartner = await repository.hasActivePartnerLink(primaryUserId);
      expect(hasPartner).toBe(false);

      // Operations that require an active partner link should fail
      const categoriesResult = await service.updateCategories(primaryUserId, {
        emotional_tendencies: true,
      });
      expect(categoriesResult.success).toBe(false);
      expect(categoriesResult.error?.code).toBe('NO_ACTIVE_PARTNER');

      const notificationsResult = await service.updateNotifications(primaryUserId, {
        daily_summaries: false,
      });
      expect(notificationsResult.success).toBe(false);
      expect(notificationsResult.error?.code).toBe('NO_ACTIVE_PARTNER');
    });

    it('should return error when no active partner link exists', async () => {
      // Set partner link to already unlinked
      repository.setPartnerLink(primaryUserId, PartnerLinkStatus.UNLINKED, partnerUserId);

      const result = await service.unlinkPartner(primaryUserId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_ACTIVE_PARTNER');
      expect(result.error?.message).toContain('No active partner link found');
    });

    it('should return error when partner link status is revoked', async () => {
      repository.setPartnerLink(primaryUserId, PartnerLinkStatus.REVOKED, partnerUserId);

      const result = await service.unlinkPartner(primaryUserId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_ACTIVE_PARTNER');
    });

    it('should return error when no partner link exists at all', async () => {
      const noPartnerUserId = 'user-no-partner';
      const result = await service.unlinkPartner(noPartnerUserId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_ACTIVE_PARTNER');
    });
  });
});
