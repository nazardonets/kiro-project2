import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole, CycleRecord, PhaseCustomization } from '@/lib/types';
import { AuthService } from '@/services/auth-service';
import { InsightsService } from '@/services/insights-service';
import {
  calculateCurrentPhase,
  customizationToDurations,
  scalePhaseDurations,
  calculateAverageCycleLength,
} from '@/services/phase-engine';

/**
 * GET /api/cycle/insights
 *
 * Returns phase-based insights for the Primary_User based on the current cycle phase.
 * Includes emotional, cognitive, behavioral tendencies, energy level, and communication style.
 * Applies survey calibration when available.
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 13.1, 13.2, 13.3, 13.5, 13.7
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
          message: 'You must be logged in to view insights.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PRIMARY) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only Primary_Users can access cycle insights.',
        },
        { status: 403 },
      );
    }

    const userId = contextResult.data.userId;

    // Get cycle records
    const { data: records, error: recordsError } = await supabase
      .from('cycle_record')
      .select('*')
      .eq('primary_user_id', userId)
      .order('start_date', { ascending: false });

    if (recordsError) {
      return NextResponse.json(
        {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve cycle records.',
        },
        { status: 500 },
      );
    }

    if (!records || records.length === 0) {
      return NextResponse.json(
        {
          code: 'NO_CYCLE_DATA',
          message: 'No cycle records found. Please submit a cycle start date first.',
        },
        { status: 404 },
      );
    }

    const latestRecord: CycleRecord = records[0];

    // Check for custom phase durations
    const { data: customization } = await supabase
      .from('phase_customization')
      .select('*')
      .eq('primary_user_id', userId)
      .single();

    // Determine durations to use
    let customDurations;
    if (customization) {
      customDurations = customizationToDurations(customization as PhaseCustomization);
    } else if (records.length >= 2) {
      const cycleLengths = records.map((r: CycleRecord) => r.cycle_length_days);
      const avgLength = calculateAverageCycleLength(cycleLengths);
      customDurations = scalePhaseDurations(avgLength);
    }

    // Calculate current phase
    const startDate = new Date(latestRecord.start_date);
    const currentPhase = calculateCurrentPhase(startDate, new Date(), customDurations);

    // Get survey responses for calibration
    const { data: surveyResponses } = await supabase
      .from('survey_response')
      .select('*')
      .eq('primary_user_id', userId);

    // Generate insights
    const insightsService = new InsightsService();
    const insights =
      surveyResponses && surveyResponses.length > 0
        ? insightsService.generateCalibratedInsights(currentPhase.phase, surveyResponses)
        : insightsService.generateBaseInsights(currentPhase.phase);

    // Get personal notes for the current phase
    const { data: personalNotes } = await supabase
      .from('personal_note')
      .select('content')
      .eq('primary_user_id', userId)
      .eq('phase', currentPhase.phase)
      .single();

    return NextResponse.json(
      {
        insights: {
          phase: insights.phase,
          emotionalTendencies: insights.emotionalTendencies,
          cognitiveTendencies: insights.cognitiveTendencies,
          behavioralTendencies: insights.behavioralTendencies,
          energyLevel: insights.energyLevel,
          communicationTendencies: insights.communicationTendencies,
        },
        personalNote: personalNotes?.content || null,
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
