import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/lib/types';
import { submitCycleStartDateSchema } from '@/lib/validation';
import { AuthService } from '@/services/auth-service';
import { CycleService, CycleRepository } from '@/services/cycle-service';

function createSupabaseCycleRepository(
  supabase: ReturnType<typeof createServerSupabaseClient>,
): CycleRepository {
  return {
    async getCycleRecords(userId: string) {
      const { data, error } = await supabase
        .from('cycle_record')
        .select('*')
        .eq('primary_user_id', userId)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    async getCycleRecordById(id: string) {
      const { data, error } = await supabase.from('cycle_record').select('*').eq('id', id).single();

      if (error) return null;
      return data;
    },
    async createCycleRecord(record) {
      const { data, error } = await supabase.from('cycle_record').insert(record).select().single();

      if (error) throw error;
      return data;
    },
    async deleteCycleRecord(id: string) {
      const { error } = await supabase.from('cycle_record').delete().eq('id', id);

      if (error) throw error;
    },
  };
}

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient();

    // Verify authentication and role
    const authService = new AuthService(supabase);
    const contextResult = await authService.getUserContext();

    if (!contextResult.success || !contextResult.data) {
      return NextResponse.json(
        {
          code: 'UNAUTHENTICATED',
          message: 'You must be logged in to submit cycle data.',
        },
        { status: 401 },
      );
    }

    if (contextResult.data.role !== UserRole.PRIMARY) {
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          message: 'Only Primary_Users can modify cycle data.',
        },
        { status: 403 },
      );
    }

    const body = await request.json();

    // Validate input with Zod
    const parsed = submitCycleStartDateSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, { message: string; constraint: string }> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.') || 'start_date';
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

    const { start_date, cycle_length_days } = parsed.data;
    const forceCreate = body.force === true;

    // Create cycle record via service
    const repository = createSupabaseCycleRepository(supabase);
    const cycleService = new CycleService(repository);
    const result = await cycleService.createCycleRecord(
      contextResult.data.userId,
      start_date,
      cycle_length_days,
      forceCreate,
    );

    if (!result.success) {
      if (result.conflict?.hasConflict) {
        return NextResponse.json(
          {
            code: 'CONFLICT',
            message: result.error,
            conflict: {
              conflicting_record_id: result.conflict.conflictingRecord?.id,
              conflicting_start_date: result.conflict.conflictingRecord?.start_date,
              details: result.conflict.message,
            },
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: result.error,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        message: 'Cycle record saved successfully',
        record: result.record,
      },
      { status: 201 },
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
