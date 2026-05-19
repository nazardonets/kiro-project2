import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole, PartnerLinkStatus, PhaseCustomization, CycleRecord } from '@/lib/types';
import { AuthService } from '@/services/auth-service';
import { GuidanceService } from '@/services/guidance-service';
import {
  calculateCurrentPhase,
  customizationToDurations,
  scalePhaseDurations,
  calculateAverageCycleLength,
} from '@/services/phase-engine';

/**
 * GET /api/partner/daily-summary
 *
 * Returns the daily summary for the Partner_User.
 * Contains "Today's State", "Best Approach", and "Avoid This" sections.
 *
 * Only accessible by Partner_User with active sharing permissions for daily_summaries.
 *
 * Validates: Requirements 15.1, 15.2, 15.3, 15.6
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    // Verify authentication and role
    const authService = new AuthService(supabase);
    const contextResult = await authService.getUserContext();

    if (!contextResult.success || !contextResult.data) {
      return NextResponse.json(
        {
          code: 'UNAUTHENTICATED',
          message: 'You must be logged in to access the daily summary.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PARTNER) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only Partner_Users can access the daily summary.',
        },
        { status: 403 },
      );
    }

    const partnerId = contextResult.data.userId;

    // Get the active partner link to find the primary user
    const { data: partnerLink, error: linkError } = await supabase
      .from('partner_link')
      .select('primary_user_id')
      .eq('partner_user_id', partnerId)
      .eq('status', PartnerLinkStatus.ACTIVE)
      .single();

    if (linkError || !partnerLink) {
      return NextResponse.json(
        {
          code: 'NO_ACTIVE_LINK',
          message: 'No active partner link found. Sharing may have been revoked.',
        },
        { status: 403 },
      );
    }

    const primaryUserId = partnerLink.primary_user_id;

    // Check sharing preferences — daily summary requires daily_summaries to be enabled
    const { data: sharingPrefs, error: sharingError } = await supabase
      .from('sharing_preferences')
      .select('*')
      .eq('primary_user_id', primaryUserId)
      .single();

    if (sharingError || !sharingPrefs) {
      return NextResponse.json(
        {
          code: 'SHARING_UNAVAILABLE',
          message: 'Sharing preferences are not configured.',
        },
        { status: 403 },
      );
    }

    if (!sharingPrefs.daily_summaries) {
      return NextResponse.json(
        {
          code: 'SHARING_DISABLED',
          message: 'Daily summary sharing is currently disabled.',
        },
        { status: 403 },
      );
    }

    // Get cycle data to determine current phase
    const { data: cycleRecords, error: cycleError } = await supabase
      .from('cycle_record')
      .select('*')
      .eq('primary_user_id', primaryUserId)
      .order('start_date', { ascending: false });

    if (cycleError || !cycleRecords || cycleRecords.length === 0) {
      return NextResponse.json(
        {
          code: 'NO_CYCLE_DATA',
          message: 'Cycle data is not yet available.',
        },
        { status: 200 },
      );
    }

    // Calculate current phase
    const latestCycle = cycleRecords[0];

    // Check for custom phase durations
    const { data: customization } = await supabase
      .from('phase_customization')
      .select('*')
      .eq('primary_user_id', primaryUserId)
      .single();

    // Determine durations to use
    let customDurations;
    if (customization) {
      customDurations = customizationToDurations(customization as PhaseCustomization);
    } else if (cycleRecords.length >= 2) {
      const cycleLengths = cycleRecords.map((r: CycleRecord) => r.cycle_length_days);
      const avgLength = calculateAverageCycleLength(cycleLengths);
      customDurations = scalePhaseDurations(avgLength);
    }

    const startDate = new Date(latestCycle.start_date);
    const currentPhase = calculateCurrentPhase(startDate, new Date(), customDurations);

    // Check if a pre-generated daily summary exists for today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingSummary } = await supabase
      .from('daily_summary')
      .select('*')
      .eq('primary_user_id', primaryUserId)
      .eq('summary_date', today)
      .single();

    if (existingSummary) {
      return NextResponse.json(
        {
          dailySummary: {
            todaysState: existingSummary.todays_state,
            bestApproach: existingSummary.best_approach,
            avoidThis: existingSummary.avoid_this,
            phase: existingSummary.phase_at_generation,
            summaryDate: existingSummary.summary_date,
          },
          phaseInfo: {
            currentPhase: currentPhase.phase,
            dayInPhase: currentPhase.dayInPhase,
            isOverdue: currentPhase.isOverdue,
          },
        },
        { status: 200 },
      );
    }

    // Generate daily summary on-the-fly if no pre-generated one exists
    const { data: surveyResponses } = await supabase
      .from('survey_response')
      .select('*')
      .eq('primary_user_id', primaryUserId);

    const guidanceService = new GuidanceService();
    const dailySummary =
      surveyResponses && surveyResponses.length > 0
        ? guidanceService.generateCalibratedDailySummary(currentPhase.phase, surveyResponses)
        : guidanceService.generateDailySummary(currentPhase.phase);

    return NextResponse.json(
      {
        dailySummary: {
          todaysState: dailySummary.todaysState,
          bestApproach: dailySummary.bestApproach,
          avoidThis: dailySummary.avoidThis,
          phase: dailySummary.phase,
          summaryDate: today,
        },
        phaseInfo: {
          currentPhase: currentPhase.phase,
          dayInPhase: currentPhase.dayInPhase,
          isOverdue: currentPhase.isOverdue,
        },
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
      { status: 500 },
    );
  }
}
