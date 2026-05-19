import { NextRequest, NextResponse } from 'next/server';

import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import {
  NotificationLog,
  NotificationStatus,
  NotificationType,
  PartnerLinkStatus,
  UserStatus,
} from '@/lib/types';
import {
  NotificationService,
  NotificationRepository,
  EmailProvider,
} from '@/services/notification-service';
import { calculateCurrentPhase, customizationToDurations } from '@/services/phase-engine';

import { getCurrentHourInTimezone, verifyCronAuthorization } from '../_shared';

/**
 * GET /api/cron/notifications
 *
 * Runs every 15 minutes via Vercel Cron. Dispatches email notifications
 * at configured delivery times in each partner's local timezone.
 *
 * Validates: Requirement 17.6
 * - When Notification_Frequency is set to daily, sends one Email_Notification per day
 *   at the Partner_User's configured delivery time in the Partner_User's local timezone
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuthorization(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const now = new Date();

  try {
    const supabase = createAdminSupabaseClient();

    // Query all partner users with active links and notification preferences
    const { data: partnerData, error: partnerError } = await supabase.from(
      'notification_preferences',
    ).select(`
        *,
        user:partner_user_id (id, email, status, role)
      `);

    if (partnerError) {
      console.error('[Cron:Notifications] Error fetching notification preferences:', partnerError);
      return NextResponse.json(
        { error: 'Failed to fetch notification preferences', details: partnerError.message },
        { status: 500 },
      );
    }

    if (!partnerData || partnerData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No partner users with notification preferences found',
        processed: 0,
        duration_ms: Date.now() - startTime,
      });
    }

    // Create email provider for Resend
    const emailProvider: EmailProvider = {
      async sendEmail(payload: { to: string; subject: string; html: string }) {
        try {
          const resendApiKey = process.env.RESEND_API_KEY;
          const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@knowyourwomancycle.com';

          if (!resendApiKey) {
            return { success: false, error: 'RESEND_API_KEY not configured' };
          }

          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: fromEmail,
              to: payload.to,
              subject: payload.subject,
              html: payload.html,
            }),
          });

          if (response.ok) {
            return { success: true };
          }

          const errorData = await response.text();
          return { success: false, error: `Resend API error: ${response.status} - ${errorData}` };
        } catch (err) {
          return { success: false, error: `Email send failed: ${err}` };
        }
      },
    };

    // Create notification repository
    const notificationRepository: NotificationRepository = {
      async createNotificationLog(log: Omit<NotificationLog, 'id'>) {
        const { data, error } = await supabase
          .from('notification_log')
          .insert(log)
          .select()
          .single();

        if (error) throw error;
        return data;
      },

      async updateNotificationLog(
        logId: string,
        updates: Partial<
          Pick<NotificationLog, 'status' | 'retry_count' | 'next_retry_at' | 'sent_at'>
        >,
      ) {
        const { data, error } = await supabase
          .from('notification_log')
          .update(updates)
          .eq('id', logId)
          .select()
          .single();

        if (error) throw error;
        return data;
      },

      async getPendingRetries(partnerUserId: string) {
        const { data, error } = await supabase
          .from('notification_log')
          .select('*')
          .eq('partner_user_id', partnerUserId)
          .eq('status', NotificationStatus.RETRYING);

        if (error) throw error;
        return data || [];
      },

      async wasNotificationSentToday(partnerUserId: string, type?: NotificationType) {
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        let query = supabase
          .from('notification_log')
          .select('id')
          .eq('partner_user_id', partnerUserId)
          .eq('status', NotificationStatus.SENT)
          .gte('sent_at', todayStart.toISOString());

        if (type) {
          query = query.eq('type', type);
        }

        const { data, error } = await query.limit(1);
        if (error) throw error;
        return (data?.length ?? 0) > 0;
      },
    };

    const notificationService = new NotificationService(notificationRepository, emailProvider);

    let processedCount = 0;
    let sentCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const prefs of partnerData) {
      try {
        const partnerUser = prefs.user as {
          id: string;
          email: string;
          status: string;
          role: string;
        } | null;

        // Skip inactive partners
        if (!partnerUser || partnerUser.status !== UserStatus.ACTIVE) {
          skippedCount++;
          continue;
        }

        // Check if the current time is within the delivery window for this partner's timezone
        const currentHourInPartnerTz = getCurrentHourInTimezone(prefs.timezone, now);

        if (currentHourInPartnerTz === -1) {
          // Invalid timezone
          skippedCount++;
          continue;
        }

        // Check if within delivery window
        const isInWindow = notificationService.isWithinDeliveryWindow(
          prefs,
          currentHourInPartnerTz,
        );

        if (!isInWindow) {
          skippedCount++;
          continue;
        }

        // Get the active partner link to find the primary user
        const { data: partnerLink } = await supabase
          .from('partner_link')
          .select('primary_user_id')
          .eq('partner_user_id', partnerUser.id)
          .eq('status', PartnerLinkStatus.ACTIVE)
          .single();

        if (!partnerLink) {
          skippedCount++;
          continue;
        }

        // Get sharing preferences
        const { data: sharingPrefs } = await supabase
          .from('sharing_preferences')
          .select('*')
          .eq('primary_user_id', partnerLink.primary_user_id)
          .single();

        if (!sharingPrefs || !sharingPrefs.email_notifications_enabled) {
          skippedCount++;
          continue;
        }

        // Get the most recent cycle record for the primary user
        const { data: cycleRecord } = await supabase
          .from('cycle_record')
          .select('*')
          .eq('primary_user_id', partnerLink.primary_user_id)
          .order('start_date', { ascending: false })
          .limit(1)
          .single();

        if (!cycleRecord) {
          skippedCount++;
          continue;
        }

        // Get custom phase durations
        const { data: customization } = await supabase
          .from('phase_customization')
          .select('*')
          .eq('primary_user_id', partnerLink.primary_user_id)
          .single();

        const customDurations = customization ? customizationToDurations(customization) : undefined;

        // Calculate current phase
        const phaseResult = calculateCurrentPhase(
          new Date(cycleRecord.start_date),
          now,
          customDurations,
        );

        // Get survey responses for calibration
        const { data: surveyResponses } = await supabase
          .from('survey_response')
          .select('*')
          .eq('primary_user_id', partnerLink.primary_user_id);

        // Check if notification was already sent today
        const alreadySent = await notificationRepository.wasNotificationSentToday(
          partnerUser.id,
          NotificationType.DAILY_SUMMARY,
        );

        if (alreadySent) {
          skippedCount++;
          continue;
        }

        // Build notification context and send
        const context = {
          partnerUserId: partnerUser.id,
          partnerEmail: partnerUser.email,
          primaryUserId: partnerLink.primary_user_id,
          currentPhase: phaseResult.phase,
          notificationPreferences: prefs,
          sharingPreferences: sharingPrefs,
          surveyResponses: surveyResponses || undefined,
        };

        // Determine if we should send based on frequency
        const shouldSend = await notificationService.shouldSendNotification(context, 'daily');

        if (!shouldSend) {
          skippedCount++;
          continue;
        }

        // Send the notification
        const result = await notificationService.sendNotification(context);

        if (result.success) {
          sentCount++;
        } else {
          console.warn(
            `[Cron:Notifications] Failed to send to ${partnerUser.id}: ${result.error?.message}`,
          );
        }

        processedCount++;
      } catch (err) {
        console.error(`[Cron:Notifications] Error processing partner:`, err);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Notification dispatch complete',
      processed: processedCount,
      sent: sentCount,
      skipped: skippedCount,
      errors: errorCount,
      duration_ms: Date.now() - startTime,
    });
  } catch (err) {
    console.error('[Cron:Notifications] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
