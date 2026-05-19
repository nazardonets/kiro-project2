import { SupabaseClient } from '@supabase/supabase-js';

import { PartnerLinkStatus, UserStatus } from '@/lib/types';
import { AdminRepository, AdminAccountDetails, AdminEmailService } from '@/services/admin-service';

/**
 * Creates an AdminRepository backed by Supabase.
 */
export function createAdminRepository(supabase: SupabaseClient): AdminRepository {
  return {
    async searchUsers(query: string, limit: number): Promise<AdminAccountDetails[]> {
      // Search by email (ilike) or exact ID match
      const { data: byEmail } = await supabase
        .from('user')
        .select('id, email, role, status, suspension_reason, created_at, updated_at')
        .ilike('email', `%${query}%`)
        .limit(limit);

      const { data: byId } = await supabase
        .from('user')
        .select('id, email, role, status, suspension_reason, created_at, updated_at')
        .eq('id', query)
        .limit(1);

      // Merge results, deduplicate by id
      const allResults = [...(byEmail ?? []), ...(byId ?? [])];
      const uniqueMap = new Map<string, (typeof allResults)[0]>();
      for (const user of allResults) {
        uniqueMap.set(user.id, user);
      }

      const users = Array.from(uniqueMap.values()).slice(0, limit);

      // Enrich with partner link info
      const enriched: AdminAccountDetails[] = await Promise.all(
        users.map(async (user) => {
          const { data: link } = await supabase
            .from('partner_link')
            .select('partner_user_id, status, linked_at')
            .eq('primary_user_id', user.id)
            .eq('status', PartnerLinkStatus.ACTIVE)
            .single();

          return {
            id: user.id,
            email: user.email,
            role: user.role,
            status: user.status,
            suspension_reason: user.suspension_reason,
            created_at: user.created_at,
            updated_at: user.updated_at,
            partner_link: link
              ? {
                  status: link.status,
                  partner_user_id: link.partner_user_id,
                  linked_at: link.linked_at,
                }
              : null,
          };
        }),
      );

      return enriched;
    },

    async getUserById(userId: string): Promise<AdminAccountDetails | null> {
      const { data: user, error } = await supabase
        .from('user')
        .select('id, email, role, status, suspension_reason, created_at, updated_at')
        .eq('id', userId)
        .single();

      if (error || !user) return null;

      const { data: link } = await supabase
        .from('partner_link')
        .select('partner_user_id, status, linked_at')
        .eq('primary_user_id', userId)
        .eq('status', PartnerLinkStatus.ACTIVE)
        .single();

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        suspension_reason: user.suspension_reason,
        created_at: user.created_at,
        updated_at: user.updated_at,
        partner_link: link
          ? {
              status: link.status,
              partner_user_id: link.partner_user_id,
              linked_at: link.linked_at,
            }
          : null,
      };
    },

    async getUserBasicInfo(userId: string) {
      const { data, error } = await supabase
        .from('user')
        .select('id, email, status')
        .eq('id', userId)
        .single();

      if (error || !data) return null;
      return { id: data.id, email: data.email, status: data.status };
    },

    async suspendUser(userId: string, reason: string): Promise<void> {
      await supabase
        .from('user')
        .update({
          status: UserStatus.SUSPENDED,
          suspension_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    },

    async getActivePartnerLink(primaryUserId: string) {
      const { data } = await supabase
        .from('partner_link')
        .select('partner_user_id, status')
        .eq('primary_user_id', primaryUserId)
        .eq('status', PartnerLinkStatus.ACTIVE)
        .single();

      if (!data) return null;
      return { partner_user_id: data.partner_user_id, status: data.status };
    },

    async revokePartnerLink(primaryUserId: string): Promise<void> {
      await supabase
        .from('partner_link')
        .update({
          status: PartnerLinkStatus.REVOKED,
          revoked_at: new Date().toISOString(),
        })
        .eq('primary_user_id', primaryUserId)
        .eq('status', PartnerLinkStatus.ACTIVE);
    },

    async disableSharingPreferences(primaryUserId: string): Promise<void> {
      await supabase
        .from('sharing_preferences')
        .update({
          emotional_tendencies: false,
          behavioral_patterns: false,
          energy_levels: false,
          communication_guidance: false,
          daily_summaries: false,
          phase_alerts: false,
          partner_reminders: false,
          email_notifications_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq('primary_user_id', primaryUserId);
    },

    async revokeUserSessions(userId: string): Promise<void> {
      await supabase.auth.admin.deleteUser(userId, false);
      // Note: In production, this would use a more targeted session revocation.
      // Supabase doesn't have a direct "revoke sessions" API, so we rely on
      // short-lived tokens and the user status check in middleware.
    },

    async deleteCycleRecords(primaryUserId: string): Promise<number> {
      const { data } = await supabase
        .from('cycle_record')
        .delete()
        .eq('primary_user_id', primaryUserId)
        .select('id');
      return data?.length ?? 0;
    },

    async deletePersonalNotes(primaryUserId: string): Promise<number> {
      const { data } = await supabase
        .from('personal_note')
        .delete()
        .eq('primary_user_id', primaryUserId)
        .select('id');
      return data?.length ?? 0;
    },

    async deleteSurveyResponses(primaryUserId: string): Promise<number> {
      const { data } = await supabase
        .from('survey_response')
        .delete()
        .eq('primary_user_id', primaryUserId)
        .select('id');
      return data?.length ?? 0;
    },

    async deleteSharingPreferences(primaryUserId: string): Promise<number> {
      const { data } = await supabase
        .from('sharing_preferences')
        .delete()
        .eq('primary_user_id', primaryUserId)
        .select('id');
      return data?.length ?? 0;
    },

    async deleteDailySummaries(primaryUserId: string): Promise<number> {
      const { data } = await supabase
        .from('daily_summary')
        .delete()
        .eq('primary_user_id', primaryUserId)
        .select('id');
      return data?.length ?? 0;
    },

    async deleteDateRequests(primaryUserId: string): Promise<number> {
      const { data } = await supabase
        .from('date_request')
        .delete()
        .eq('primary_user_id', primaryUserId)
        .select('id');
      return data?.length ?? 0;
    },

    async deactivatePartner(partnerId: string): Promise<void> {
      await supabase
        .from('user')
        .update({
          status: UserStatus.DELETED,
          updated_at: new Date().toISOString(),
        })
        .eq('id', partnerId);

      await supabase
        .from('partner_link')
        .update({
          status: PartnerLinkStatus.REVOKED,
          revoked_at: new Date().toISOString(),
        })
        .eq('partner_user_id', partnerId)
        .eq('status', PartnerLinkStatus.ACTIVE);
    },

    async deleteUser(userId: string): Promise<void> {
      await supabase
        .from('user')
        .update({
          status: UserStatus.DELETED,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    },
  };
}

/**
 * Creates an AdminEmailService (placeholder implementation).
 * In production, this would use Resend or another email provider.
 */
export function createAdminEmailService(): AdminEmailService {
  return {
    async sendSuspensionNotification(_email: string, _reason: string): Promise<boolean> {
      // TODO: Integrate with Resend email service
      return true;
    },
  };
}
