import { SharingPreferences, PartnerLinkStatus } from '@/lib/types';
import {
  SharingCategoriesInput,
  SharingNotificationsInput,
} from '@/lib/validation/sharing.schemas';

/**
 * Typed interface for database access (dependency injection).
 * Allows the SharingService to remain framework-agnostic.
 */
export interface SharingRepository {
  /** Get sharing preferences for a primary user */
  getSharingPreferences(primaryUserId: string): Promise<SharingPreferences | null>;

  /** Create default sharing preferences for a primary user (all enabled) */
  createDefaultPreferences(primaryUserId: string): Promise<SharingPreferences>;

  /** Update sharing preferences (partial update) */
  updateSharingPreferences(
    primaryUserId: string,
    updates: Partial<Omit<SharingPreferences, 'id' | 'primary_user_id' | 'updated_at'>>,
  ): Promise<SharingPreferences>;

  /** Check if a primary user has an active partner link */
  hasActivePartnerLink(primaryUserId: string): Promise<boolean>;

  /** Get the partner link status for a primary user */
  getPartnerLinkStatus(
    primaryUserId: string,
  ): Promise<{ status: PartnerLinkStatus; partner_user_id: string } | null>;

  /** Update the partner link status to 'unlinked' for a primary user */
  updatePartnerLinkStatus(primaryUserId: string, status: PartnerLinkStatus): Promise<void>;
}

/**
 * Result type for SharingService operations.
 */
export interface SharingServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Insight categories that can be toggled independently.
 */
export type InsightCategory =
  | 'emotional_tendencies'
  | 'behavioral_patterns'
  | 'energy_levels'
  | 'communication_guidance';

/**
 * Notification types that can be toggled independently.
 */
export type NotificationType = 'daily_summaries' | 'phase_alerts' | 'partner_reminders';

/**
 * All insight category keys.
 */
export const INSIGHT_CATEGORIES: InsightCategory[] = [
  'emotional_tendencies',
  'behavioral_patterns',
  'energy_levels',
  'communication_guidance',
];

/**
 * All notification type keys.
 */
export const NOTIFICATION_TYPES: NotificationType[] = [
  'daily_summaries',
  'phase_alerts',
  'partner_reminders',
];

/**
 * Default sharing preferences — all categories and notifications enabled.
 */
export const DEFAULT_SHARING_PREFERENCES: Omit<
  SharingPreferences,
  'id' | 'primary_user_id' | 'updated_at'
> = {
  emotional_tendencies: true,
  behavioral_patterns: true,
  energy_levels: true,
  communication_guidance: true,
  daily_summaries: true,
  phase_alerts: true,
  partner_reminders: true,
  email_notifications_enabled: true,
};

/**
 * SharingService manages sharing preferences between Primary_User and Partner_User.
 *
 * Responsibilities:
 * - Permission management (category toggles, notification toggles)
 * - Default initialization on partner linking
 * - Real-time propagation via Supabase Realtime (within 5 seconds)
 *
 * Framework-agnostic: database access is injected via the SharingRepository interface.
 */
export class SharingService {
  constructor(private readonly repository: SharingRepository) {}

  /**
   * Initialize default sharing preferences when a partner is linked.
   * All categories and notification types are enabled by default.
   *
   * @param primaryUserId - The primary user's ID
   * @returns The created sharing preferences
   *
   * Validates: Requirements 3.1, 3.3 (all enabled by default on partner linking)
   */
  async initializeDefaultPreferences(
    primaryUserId: string,
  ): Promise<SharingServiceResult<SharingPreferences>> {
    // Check if preferences already exist
    const existing = await this.repository.getSharingPreferences(primaryUserId);
    if (existing) {
      return {
        success: true,
        data: existing,
      };
    }

    const preferences = await this.repository.createDefaultPreferences(primaryUserId);
    return {
      success: true,
      data: preferences,
    };
  }

  /**
   * Get current sharing preferences for a primary user.
   *
   * @param primaryUserId - The primary user's ID
   * @returns Current sharing preferences or null if not found
   */
  async getPreferences(primaryUserId: string): Promise<SharingServiceResult<SharingPreferences>> {
    const preferences = await this.repository.getSharingPreferences(primaryUserId);

    if (!preferences) {
      return {
        success: false,
        error: {
          code: 'PREFERENCES_NOT_FOUND',
          message: 'Sharing preferences not found. Please link a partner first.',
        },
      };
    }

    return {
      success: true,
      data: preferences,
    };
  }

  /**
   * Toggle individual insight categories independently.
   * Only the specified categories are updated; others remain unchanged.
   *
   * Changes are persisted to the database and propagated via Supabase Realtime
   * (the database update triggers Realtime subscriptions within 5 seconds).
   *
   * @param primaryUserId - The primary user's ID
   * @param categories - Partial object with categories to toggle
   * @returns Updated sharing preferences
   *
   * Validates: Requirements 3.1, 3.2, 3.4
   */
  async updateCategories(
    primaryUserId: string,
    categories: SharingCategoriesInput,
  ): Promise<SharingServiceResult<SharingPreferences>> {
    // Verify the user has an active partner link
    const hasPartner = await this.repository.hasActivePartnerLink(primaryUserId);
    if (!hasPartner) {
      return {
        success: false,
        error: {
          code: 'NO_ACTIVE_PARTNER',
          message: 'No active partner link found. Please link a partner first.',
        },
      };
    }

    // Verify preferences exist
    const existing = await this.repository.getSharingPreferences(primaryUserId);
    if (!existing) {
      return {
        success: false,
        error: {
          code: 'PREFERENCES_NOT_FOUND',
          message: 'Sharing preferences not found.',
        },
      };
    }

    // Build update object with only the provided category fields
    const updates: Partial<Omit<SharingPreferences, 'id' | 'primary_user_id' | 'updated_at'>> = {};

    if (categories.emotional_tendencies !== undefined) {
      updates.emotional_tendencies = categories.emotional_tendencies;
    }
    if (categories.behavioral_patterns !== undefined) {
      updates.behavioral_patterns = categories.behavioral_patterns;
    }
    if (categories.energy_levels !== undefined) {
      updates.energy_levels = categories.energy_levels;
    }
    if (categories.communication_guidance !== undefined) {
      updates.communication_guidance = categories.communication_guidance;
    }

    // If no fields to update, return current preferences
    if (Object.keys(updates).length === 0) {
      return {
        success: true,
        data: existing,
      };
    }

    // Persist the update — Supabase Realtime will propagate within 5 seconds (Req 3.4)
    const updated = await this.repository.updateSharingPreferences(primaryUserId, updates);

    return {
      success: true,
      data: updated,
    };
  }

  /**
   * Toggle notification types independently.
   * Only the specified notification types are updated; others remain unchanged.
   *
   * Changes are persisted to the database and propagated via Supabase Realtime
   * (the database update triggers Realtime subscriptions within 5 seconds).
   *
   * @param primaryUserId - The primary user's ID
   * @param notifications - Partial object with notification types to toggle
   * @returns Updated sharing preferences
   *
   * Validates: Requirements 3.3, 3.4
   */
  async updateNotifications(
    primaryUserId: string,
    notifications: SharingNotificationsInput,
  ): Promise<SharingServiceResult<SharingPreferences>> {
    // Verify the user has an active partner link
    const hasPartner = await this.repository.hasActivePartnerLink(primaryUserId);
    if (!hasPartner) {
      return {
        success: false,
        error: {
          code: 'NO_ACTIVE_PARTNER',
          message: 'No active partner link found. Please link a partner first.',
        },
      };
    }

    // Verify preferences exist
    const existing = await this.repository.getSharingPreferences(primaryUserId);
    if (!existing) {
      return {
        success: false,
        error: {
          code: 'PREFERENCES_NOT_FOUND',
          message: 'Sharing preferences not found.',
        },
      };
    }

    // Build update object with only the provided notification fields
    const updates: Partial<Omit<SharingPreferences, 'id' | 'primary_user_id' | 'updated_at'>> = {};

    if (notifications.daily_summaries !== undefined) {
      updates.daily_summaries = notifications.daily_summaries;
    }
    if (notifications.phase_alerts !== undefined) {
      updates.phase_alerts = notifications.phase_alerts;
    }
    if (notifications.partner_reminders !== undefined) {
      updates.partner_reminders = notifications.partner_reminders;
    }
    if (notifications.email_notifications_enabled !== undefined) {
      updates.email_notifications_enabled = notifications.email_notifications_enabled;
    }

    // If no fields to update, return current preferences
    if (Object.keys(updates).length === 0) {
      return {
        success: true,
        data: existing,
      };
    }

    // Persist the update — Supabase Realtime will propagate within 5 seconds (Req 3.4)
    const updated = await this.repository.updateSharingPreferences(primaryUserId, updates);

    return {
      success: true,
      data: updated,
    };
  }

  /**
   * Check if all insight categories are disabled.
   * When all are disabled, the partner should see a "no shared content" message.
   *
   * @param primaryUserId - The primary user's ID
   * @returns Whether all categories are disabled
   *
   * Validates: Requirement 3.5
   */
  async areAllCategoriesDisabled(primaryUserId: string): Promise<SharingServiceResult<boolean>> {
    const preferences = await this.repository.getSharingPreferences(primaryUserId);

    if (!preferences) {
      return {
        success: false,
        error: {
          code: 'PREFERENCES_NOT_FOUND',
          message: 'Sharing preferences not found.',
        },
      };
    }

    const allDisabled =
      !preferences.emotional_tendencies &&
      !preferences.behavioral_patterns &&
      !preferences.energy_levels &&
      !preferences.communication_guidance;

    return {
      success: true,
      data: allDisabled,
    };
  }

  /**
   * Get the list of currently enabled insight categories.
   * Used by the partner dashboard to determine which content to display.
   *
   * @param primaryUserId - The primary user's ID
   * @returns Array of enabled category keys
   */
  async getEnabledCategories(
    primaryUserId: string,
  ): Promise<SharingServiceResult<InsightCategory[]>> {
    const preferences = await this.repository.getSharingPreferences(primaryUserId);

    if (!preferences) {
      return {
        success: false,
        error: {
          code: 'PREFERENCES_NOT_FOUND',
          message: 'Sharing preferences not found.',
        },
      };
    }

    const enabled: InsightCategory[] = [];
    if (preferences.emotional_tendencies) enabled.push('emotional_tendencies');
    if (preferences.behavioral_patterns) enabled.push('behavioral_patterns');
    if (preferences.energy_levels) enabled.push('energy_levels');
    if (preferences.communication_guidance) enabled.push('communication_guidance');

    return {
      success: true,
      data: enabled,
    };
  }

  /**
   * Get the list of currently enabled notification types.
   * Used by the notification service to determine which notifications to send.
   *
   * @param primaryUserId - The primary user's ID
   * @returns Array of enabled notification type keys
   */
  async getEnabledNotifications(
    primaryUserId: string,
  ): Promise<SharingServiceResult<NotificationType[]>> {
    const preferences = await this.repository.getSharingPreferences(primaryUserId);

    if (!preferences) {
      return {
        success: false,
        error: {
          code: 'PREFERENCES_NOT_FOUND',
          message: 'Sharing preferences not found.',
        },
      };
    }

    const enabled: NotificationType[] = [];
    if (preferences.daily_summaries) enabled.push('daily_summaries');
    if (preferences.phase_alerts) enabled.push('phase_alerts');
    if (preferences.partner_reminders) enabled.push('partner_reminders');

    return {
      success: true,
      data: enabled,
    };
  }

  /**
   * Check if email notifications are enabled for a primary user.
   *
   * @param primaryUserId - The primary user's ID
   * @returns Whether email notifications are enabled
   */
  async isEmailNotificationsEnabled(primaryUserId: string): Promise<SharingServiceResult<boolean>> {
    const preferences = await this.repository.getSharingPreferences(primaryUserId);

    if (!preferences) {
      return {
        success: false,
        error: {
          code: 'PREFERENCES_NOT_FOUND',
          message: 'Sharing preferences not found.',
        },
      };
    }

    return {
      success: true,
      data: preferences.email_notifications_enabled,
    };
  }

  /**
   * Unlink the Partner_User from the Primary_User.
   *
   * This operation:
   * - Updates the PartnerLink status to 'unlinked'
   * - Revokes Partner_User access to Insights_Dashboard and Guidance_Panel
   * - Preserves all Primary_User data (CycleRecords, PersonalNotes, SurveyResponses,
   *   PhaseCustomizations, SharingPreferences) unchanged
   *
   * @param primaryUserId - The primary user's ID
   * @returns Result indicating success or failure
   *
   * Validates: Requirements 2.6
   */
  async unlinkPartner(
    primaryUserId: string,
  ): Promise<SharingServiceResult<{ unlinkedPartnerId: string }>> {
    // Verify there is an active partner link
    const partnerLink = await this.repository.getPartnerLinkStatus(primaryUserId);

    if (!partnerLink || partnerLink.status !== PartnerLinkStatus.ACTIVE) {
      return {
        success: false,
        error: {
          code: 'NO_ACTIVE_PARTNER',
          message: 'No active partner link found. Cannot unlink.',
        },
      };
    }

    // Update partner link status to 'unlinked' — this revokes partner access
    await this.repository.updatePartnerLinkStatus(primaryUserId, PartnerLinkStatus.UNLINKED);

    return {
      success: true,
      data: { unlinkedPartnerId: partnerLink.partner_user_id },
    };
  }
}
