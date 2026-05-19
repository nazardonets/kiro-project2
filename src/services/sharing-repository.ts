import { SupabaseClient } from '@supabase/supabase-js';

import { PartnerLinkStatus, SharingPreferences } from '@/lib/types';

import { SharingRepository } from './sharing-service';

/**
 * Supabase-backed implementation of SharingRepository.
 * Used by API routes to wire the SharingService to the database.
 */
export class SupabaseSharingRepository implements SharingRepository {
  constructor(private supabase: SupabaseClient) {}

  async getSharingPreferences(primaryUserId: string): Promise<SharingPreferences | null> {
    const { data, error } = await this.supabase
      .from('sharing_preferences')
      .select('*')
      .eq('primary_user_id', primaryUserId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as SharingPreferences;
  }

  async createDefaultPreferences(primaryUserId: string): Promise<SharingPreferences> {
    const { data, error } = await this.supabase
      .from('sharing_preferences')
      .insert({
        primary_user_id: primaryUserId,
        emotional_tendencies: true,
        behavioral_patterns: true,
        energy_levels: true,
        communication_guidance: true,
        daily_summaries: true,
        phase_alerts: true,
        partner_reminders: true,
        email_notifications_enabled: true,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create default sharing preferences: ${error?.message}`);
    }

    return data as SharingPreferences;
  }

  async updateSharingPreferences(
    primaryUserId: string,
    updates: Partial<Omit<SharingPreferences, 'id' | 'primary_user_id' | 'updated_at'>>,
  ): Promise<SharingPreferences> {
    const { data, error } = await this.supabase
      .from('sharing_preferences')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('primary_user_id', primaryUserId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to update sharing preferences: ${error?.message}`);
    }

    return data as SharingPreferences;
  }

  async hasActivePartnerLink(primaryUserId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('partner_link')
      .select('id')
      .eq('primary_user_id', primaryUserId)
      .eq('status', PartnerLinkStatus.ACTIVE)
      .single();

    return !!data;
  }

  async getPartnerLinkStatus(
    primaryUserId: string,
  ): Promise<{ status: PartnerLinkStatus; partner_user_id: string } | null> {
    const { data, error } = await this.supabase
      .from('partner_link')
      .select('status, partner_user_id')
      .eq('primary_user_id', primaryUserId)
      .eq('status', PartnerLinkStatus.ACTIVE)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      status: data.status as PartnerLinkStatus,
      partner_user_id: data.partner_user_id,
    };
  }

  async updatePartnerLinkStatus(primaryUserId: string, status: PartnerLinkStatus): Promise<void> {
    const { error } = await this.supabase
      .from('partner_link')
      .update({
        status,
        revoked_at: status === PartnerLinkStatus.REVOKED ? new Date().toISOString() : null,
      })
      .eq('primary_user_id', primaryUserId)
      .eq('status', PartnerLinkStatus.ACTIVE);

    if (error) {
      throw new Error(`Failed to update partner link status: ${error.message}`);
    }
  }
}
