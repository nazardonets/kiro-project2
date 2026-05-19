import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole, CycleRecord, PhaseCustomization } from '@/lib/types';
import { AuthService } from '@/services/auth-service';
import { generatePredictions, customizationToDurations } from '@/services/phase-engine';

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
          message: 'You must be logged in to view predictions.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PRIMARY) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only Primary_Users can access cycle predictions.',
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

    // Build options for prediction generation
    const options: {
      customDurations?: ReturnType<typeof customizationToDurations>;
      historicalCycleLengths?: number[];
    } = {};

    if (customization) {
      options.customDurations = customizationToDurations(customization as PhaseCustomization);
    } else if (records.length >= 2) {
      options.historicalCycleLengths = records.map((r: CycleRecord) => r.cycle_length_days);
    }

    // Generate 60-day predictions
    const startDate = new Date(latestRecord.start_date);
    const currentDate = new Date();
    const predictions = generatePredictions(startDate, currentDate, options);

    // Serialize predictions (convert Date objects to ISO strings)
    const serializedPredictions = predictions.map((p) => ({
      phase: p.phase,
      start_date: p.startDate.toISOString().split('T')[0],
      end_date: p.endDate.toISOString().split('T')[0],
      start_day: p.startDay,
      end_day: p.endDay,
    }));

    return NextResponse.json(
      {
        predictions: serializedPredictions,
        cycle_start_date: latestRecord.start_date,
        generated_at: new Date().toISOString(),
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
