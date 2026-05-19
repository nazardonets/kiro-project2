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
 * GET /api/partner/guidance
 *
 * Returns guidance panel content for the Partner_User based on the current cycle phase.
 * Includes supportive actions, triggers to avoid, communication strategies,
 * discouraged patterns, and decision support (behavioral prompts + situational recommendations).
 *
 * Only accessible by Partner_User with active sharing permissions for communication_guidance.
 *
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4, 15.6
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
          message: 'You must be logged in to access guidance.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PARTNER) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only Partner_Users can access guidance content.',
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

    // Check sharing preferences — guidance requires communication_guidance to be enabled
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

    if (!sharingPrefs.communication_guidance) {
      return NextResponse.json(
        {
          code: 'SHARING_DISABLED',
          message: 'Communication guidance sharing is currently disabled.',
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

    // Generate guidance content
    const guidanceService = new GuidanceService();
    const guidance =
      surveyResponses && surveyResponses.length > 0
        ? guidanceService.generateCalibratedGuidance(currentPhase.phase, surveyResponses)
        : guidanceService.generateBaseGuidance(currentPhase.phase);

    // Generate decision support (behavioral prompts + situational recommendations)
    const decisionSupport = guidanceService.generateDecisionSupport(currentPhase.phase);

    return NextResponse.json(
      {
        guidance: {
          phase: guidance.phase,
          supportiveActions: guidance.supportiveActions,
          triggersToAvoid: guidance.triggersToAvoid,
          communicationStrategies: guidance.communicationStrategies,
          discouragedPatterns: guidance.discouragedPatterns,
        },
        decisionSupport: {
          behavioralPrompts: decisionSupport.behavioralPrompts,
          situationalRecommendations: decisionSupport.situationalRecommendations,
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
