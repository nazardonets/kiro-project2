import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole, CycleRecord, PhaseCustomization } from '@/lib/types';
import { AuthService } from '@/services/auth-service';
import {
  calculateCurrentPhase,
  customizationToDurations,
  scalePhaseDurations,
  calculateAverageCycleLength,
} from '@/services/phase-engine';

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
          message: 'You must be logged in to view phase information.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PRIMARY) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only Primary_Users can access cycle phase data.',
        },
        { status: 403 },
      );
    }

    const userId = contextResult.data.userId;

    // Get the most recent cycle record
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
      // Scale durations based on average cycle length
      const cycleLengths = records.map((r: CycleRecord) => r.cycle_length_days);
      const avgLength = calculateAverageCycleLength(cycleLengths);
      customDurations = scalePhaseDurations(avgLength);
    }

    // Calculate current phase
    const startDate = new Date(latestRecord.start_date);
    const phaseResult = calculateCurrentPhase(startDate, new Date(), customDurations);

    return NextResponse.json(
      {
        phase: phaseResult.phase,
        day_in_phase: phaseResult.dayInPhase,
        is_overdue: phaseResult.isOverdue,
        total_cycle_length: phaseResult.totalCycleLength,
        elapsed_days: phaseResult.elapsedDays,
        cycle_start_date: latestRecord.start_date,
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
