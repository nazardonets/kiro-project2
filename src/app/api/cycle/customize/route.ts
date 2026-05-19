import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/lib/types';
import { phaseCustomizationSchema, validatePhaseDurations } from '@/lib/validation';
import { AuthService } from '@/services/auth-service';

export async function PUT(request: Request) {
  try {
    const supabase = createServerSupabaseClient();

    // Verify authentication and role
    const authService = new AuthService(supabase);
    const contextResult = await authService.getUserContext();

    if (!contextResult.success || !contextResult.data) {
      return NextResponse.json(
        {
          code: 'UNAUTHENTICATED',
          message: 'You must be logged in to customize phase durations.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PRIMARY) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only Primary_Users can customize phase durations.',
        },
        { status: 403 },
      );
    }

    const userId = contextResult.data.userId;
    const body = await request.json();

    // Validate input shape with Zod
    const parsed = phaseCustomizationSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, { message: string; constraint: string }> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.') || 'durations';
        fieldErrors[field] = {
          message: issue.message,
          constraint: issue.code,
        };
      }

      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          fields: fieldErrors,
        },
        { status: 400 },
      );
    }

    // Get the user's effective cycle length to validate sum
    const { data: records } = await supabase
      .from('cycle_record')
      .select('cycle_length_days')
      .eq('primary_user_id', userId)
      .order('start_date', { ascending: false });

    // Determine the expected cycle length
    let cycleLength: number;
    if (records && records.length >= 2) {
      const sum = records.reduce(
        (acc: number, r: { cycle_length_days: number }) => acc + r.cycle_length_days,
        0,
      );
      cycleLength = Math.round(sum / records.length);
    } else if (records && records.length === 1) {
      cycleLength = records[0].cycle_length_days;
    } else {
      cycleLength = 28; // Default
    }

    // Validate that phase durations sum to cycle length
    const durationValidation = validatePhaseDurations(parsed.data, cycleLength);
    if (!durationValidation.success) {
      const fieldErrors: Record<string, { message: string; constraint: string }> = {};
      for (const err of durationValidation.errors) {
        const key = err.field || 'total';
        fieldErrors[key] = {
          message: err.message,
          constraint: err.constraint,
        };
      }

      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          fields: fieldErrors,
        },
        { status: 400 },
      );
    }

    // Upsert phase customization
    const { data: existing } = await supabase
      .from('phase_customization')
      .select('id')
      .eq('primary_user_id', userId)
      .single();

    let customization;
    if (existing) {
      const { data, error } = await supabase
        .from('phase_customization')
        .update({
          ...parsed.data,
          updated_at: new Date().toISOString(),
        })
        .eq('primary_user_id', userId)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          {
            code: 'INTERNAL_ERROR',
            message: 'Failed to update phase customization.',
          },
          { status: 500 },
        );
      }
      customization = data;
    } else {
      const { data, error } = await supabase
        .from('phase_customization')
        .insert({
          primary_user_id: userId,
          ...parsed.data,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          {
            code: 'INTERNAL_ERROR',
            message: 'Failed to save phase customization.',
          },
          { status: 500 },
        );
      }
      customization = data;
    }

    return NextResponse.json(
      {
        message: 'Phase durations updated successfully',
        customization,
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
