import { NextRequest, NextResponse } from 'next/server';

import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { UserRole, UserStatus } from '@/lib/types';
import { GuidanceService } from '@/services/guidance-service';
import { calculateCurrentPhase, customizationToDurations } from '@/services/phase-engine';

import { getTimezonesMidnight, verifyCronAuthorization } from '../_shared';

/**
 * GET /api/cron/daily-summary
 *
 * Runs hourly via Vercel Cron. Regenerates daily summaries for users
 * whose timezone midnight has passed.
 *
 * Validates: Requirements 15.4, 15.5
 * - Regenerates Daily_Summary once per day at midnight in the Primary_User's local timezone
 * - When the Cycle_Phase changes, updates the Daily_Summary content to reflect the new phase
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuthorization(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  try {
    const supabase = createAdminSupabaseClient();
    const guidanceService = new GuidanceService();

    // Find timezones where it's currently midnight
    const midnightTimezones = getTimezonesMidnight(now);

    if (midnightTimezones.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No timezones at midnight currently',
        processed: 0,
        duration_ms: Date.now() - startTime,
      });
    }

    // Query all active primary users
    const { data: primaryUsers, error: usersError } = await supabase
      .from('user')
      .select('id, email')
      .eq('role', UserRole.PRIMARY)
      .eq('status', UserStatus.ACTIVE);

    if (usersError) {
      console.error('[Cron:DailySummary] Error fetching users:', usersError);
      return NextResponse.json(
        { error: 'Failed to fetch users', details: usersError.message },
        { status: 500 },
      );
    }

    if (!primaryUsers || primaryUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active primary users found',
        processed: 0,
        duration_ms: Date.now() - startTime,
      });
    }

    let processedCount = 0;
    let errorCount = 0;

    for (const user of primaryUsers) {
      try {
        // Determine user's timezone via their partner's notification preferences
        const { data: partnerLink } = await supabase
          .from('partner_link')
          .select('partner_user_id')
          .eq('primary_user_id', user.id)
          .eq('status', 'active')
          .single();

        let userTimezone = 'UTC';

        if (partnerLink) {
          const { data: notifPrefs } = await supabase
            .from('notification_preferences')
            .select('timezone')
            .eq('partner_user_id', partnerLink.partner_user_id)
            .single();

          if (notifPrefs?.timezone) {
            userTimezone = notifPrefs.timezone;
          }
        }

        // Check if it's midnight in the user's timezone
        if (!midnightTimezones.includes(userTimezone)) {
          continue;
        }

        // Get the most recent cycle record
        const { data: cycleRecord } = await supabase
          .from('cycle_record')
          .select('*')
          .eq('primary_user_id', user.id)
          .order('start_date', { ascending: false })
          .limit(1)
          .single();

        if (!cycleRecord) {
          continue; // No cycle data, skip summary generation
        }

        // Get custom phase durations if any
        const { data: customization } = await supabase
          .from('phase_customization')
          .select('*')
          .eq('primary_user_id', user.id)
          .single();

        // Calculate current phase
        const customDurations = customization ? customizationToDurations(customization) : undefined;

        const phaseResult = calculateCurrentPhase(
          new Date(cycleRecord.start_date),
          now,
          customDurations,
        );

        // Get survey responses for calibration
        const { data: surveyResponses } = await supabase
          .from('survey_response')
          .select('*')
          .eq('primary_user_id', user.id);

        // Generate daily summary content
        const summaryContent =
          surveyResponses && surveyResponses.length > 0
            ? guidanceService.generateCalibratedDailySummary(phaseResult.phase, surveyResponses)
            : guidanceService.generateDailySummary(phaseResult.phase);

        // Check if a summary already exists for today
        const { data: existingSummary } = await supabase
          .from('daily_summary')
          .select('id, phase_at_generation')
          .eq('primary_user_id', user.id)
          .eq('summary_date', todayStr)
          .single();

        if (existingSummary) {
          // Update existing summary (Req 15.5: update when phase changes)
          await supabase
            .from('daily_summary')
            .update({
              todays_state: summaryContent.todaysState,
              best_approach: summaryContent.bestApproach,
              avoid_this: summaryContent.avoidThis,
              phase_at_generation: phaseResult.phase,
              generated_at: now.toISOString(),
            })
            .eq('id', existingSummary.id);
        } else {
          // Insert new daily summary
          await supabase.from('daily_summary').insert({
            primary_user_id: user.id,
            summary_date: todayStr,
            todays_state: summaryContent.todaysState,
            best_approach: summaryContent.bestApproach,
            avoid_this: summaryContent.avoidThis,
            phase_at_generation: phaseResult.phase,
            generated_at: now.toISOString(),
          });
        }

        console.log(
          `[Cron:DailySummary] User ${user.id}: Generated summary for phase=${phaseResult.phase}`,
        );

        processedCount++;
      } catch (err) {
        console.error(`[Cron:DailySummary] Error processing user ${user.id}:`, err);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Daily summary regeneration complete',
      processed: processedCount,
      errors: errorCount,
      midnight_timezones: midnightTimezones.length,
      duration_ms: Date.now() - startTime,
    });
  } catch (err) {
    console.error('[Cron:DailySummary] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
