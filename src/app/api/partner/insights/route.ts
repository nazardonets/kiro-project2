import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole, PartnerLinkStatus, PhaseCustomization, CycleRecord } from '@/lib/types';
import { AuthService } from '@/services/auth-service';
import { InsightsService } from '@/services/insights-service';
import {
  calculateCurrentPhase,
  customizationToDurations,
  scalePhaseDurations,
  calculateAverageCycleLength,
} from '@/services/phase-engine';

/**
 * GET /api/partner/insights
 *
 * Returns shared insights for the Partner_User based on the current cycle phase.
 * Only accessible by Partner_User with active sharing permissions.
 *
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4
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
          message: 'You must be logged in to access insights.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PARTNER) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only Partner_Users can access shared insights.',
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

    // Check sharing preferences
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

    // Check if any insight categories are shared
    const hasSharedCategories =
      sharingPrefs.emotional_tendencies ||
      sharingPrefs.behavioral_patterns ||
      sharingPrefs.energy_levels;

    if (!hasSharedCategories) {
      return NextResponse.json(
        {
          code: 'SHARING_DISABLED',
          message: 'No insight categories are currently shared.',
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

    // Get survey responses for calibration
    const { data: surveyResponses } = await supabase
      .from('survey_response')
      .select('*')
      .eq('primary_user_id', primaryUserId);

    // Generate insights
    const insightsService = new InsightsService();
    const insights =
      surveyResponses && surveyResponses.length > 0
        ? insightsService.generateCalibratedInsights(currentPhase.phase, surveyResponses)
        : insightsService.generateBaseInsights(currentPhase.phase);

    // Filter insights based on sharing preferences
    const filteredInsights = {
      phase: insights.phase,
      emotionalTendencies: sharingPrefs.emotional_tendencies ? insights.emotionalTendencies : [],
      cognitiveTendencies: sharingPrefs.emotional_tendencies ? insights.cognitiveTendencies : [],
      behavioralTendencies: sharingPrefs.behavioral_patterns ? insights.behavioralTendencies : [],
      energyLevel: sharingPrefs.energy_levels ? insights.energyLevel : null,
      communicationTendencies: sharingPrefs.communication_guidance
        ? insights.communicationTendencies
        : [],
    };

    // Get personal notes for the current phase if available
    const { data: personalNotes } = await supabase
      .from('personal_note')
      .select('content')
      .eq('primary_user_id', primaryUserId)
      .eq('phase', currentPhase.phase)
      .single();

    return NextResponse.json(
      {
        insights: filteredInsights,
        personalNote: personalNotes?.content || null,
        primaryUserId,
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
